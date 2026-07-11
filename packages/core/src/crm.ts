// CRM — motor PURO de campanhas de relacionamento (WhatsApp Cloud API).
// Telefone E.164 BR, segmentação com consentimento LGPD obrigatório no envio,
// janela de atendimento de 24h e resumo de campanha para a UI.
//
// REGRAS DO MOTOR (invariantes):
//   - 100% determinístico: SEM IO, SEM Date.now() — o "agora" sempre chega
//     como parâmetro ISO.
//   - LGPD invariante: segmento de envio (apenasComConsentimento !== false)
//     NUNCA casa contato sem consentimento de marketing registrado. Quem nem
//     casa com os critérios sai como "fora_do_segmento" (números honestos:
//     "sem_consentimento"/"sem_telefone" só entre os que CASAM).
//   - Telefone: nunca chuta número — 10–11 dígitos ganham o DDI 55; 12–13
//     dígitos só valem se já começarem com 55; o resto é null.
//   - Janela de 24h do WhatsApp: conta a partir da última mensagem RECEBIDA
//     do cliente; fora dela, só template aprovado pela Meta.

// ---------------------------------------------------------------------------
// Telefone E.164 BR
// ---------------------------------------------------------------------------

/**
 * Normaliza um telefone brasileiro com formatação livre para E.164 ("+55...").
 *   - 10–11 dígitos (DDD + número) ⇒ prefixa o DDI 55;
 *   - 12–13 dígitos JÁ começando com 55 ⇒ usa como está;
 *   - qualquer outra coisa ⇒ null (nunca chuta o número).
 */
export function normalizarTelefoneE164BR(v: string): string | null {
  const digitos = v.replace(/\D/g, "");
  if (digitos.length === 10 || digitos.length === 11) return `+55${digitos}`;
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55")) {
    return `+${digitos}`;
  }
  return null;
}

/**
 * Formata um telefone E.164 BR para exibição: "(11) 98888-7777".
 * Aceita com ou sem "+"; se o valor não normalizar, devolve o texto original
 * aparado (a UI nunca perde o dado por causa da máscara).
 */
export function formatarTelefoneBR(e164: string): string {
  const normalizado = normalizarTelefoneE164BR(e164);
  if (normalizado === null) return e164.trim();
  const local = normalizado.slice(3); // remove "+55"
  const ddd = local.slice(0, 2);
  const numero = local.slice(2);
  const corte = numero.length - 4;
  return `(${ddd}) ${numero.slice(0, corte)}-${numero.slice(corte)}`;
}

// ---------------------------------------------------------------------------
// Segmentação
// ---------------------------------------------------------------------------

/** Critérios de um segmento de campanha. Campos ausentes não filtram. */
export interface Segmento {
  /** Etapas do funil aceitas (o contato precisa ter negócio aberto em alguma). */
  etapas?: string[];
  /** Temperaturas do termômetro aceitas ("quente", "morno", "frio"...). */
  temperaturas?: string[];
  /** Tags aceitas (basta o contato ter UMA delas). */
  tags?: string[];
  /**
   * Segmento de ENVIO exige consentimento + telefone. Default true SEMPRE;
   * só passe false para segmentos analíticos que nunca disparam mensagem.
   */
  apenasComConsentimento?: boolean;
  /** Mínimo de dias sem movimento (reativação). Sem dado conhecido ⇒ não casa. */
  diasSemMovimentoMin?: number;
}

/** Por que o contato ficou fora do segmento. */
export type MotivoExclusao = "sem_consentimento" | "sem_telefone" | "fora_do_segmento";

/** Dados do contato usados na segmentação. */
export interface ContatoSegmentavel {
  tags: string[];
  /** Quando o contato consentiu marketing (ISO) — null = nunca consentiu. */
  consentimentoMarketingEm: string | null;
  telefone: string | null;
}

/** Dados derivados (negócios/termômetro) que chegam de fora do contato. */
export interface ExtrasSegmentacao {
  /** Etapas dos negócios ABERTOS do contato. */
  etapasAbertas?: string[];
  temperatura?: string | null;
  diasSemMovimento?: number | null;
}

const FORA = { casa: false, motivoExclusao: "fora_do_segmento" } as const;

/**
 * Decide se o contato casa com o segmento. Os CRITÉRIOS do segmento vêm
 * primeiro: quem não casa sai como "fora_do_segmento", mesmo sem consentimento
 * ou telefone — só quem CASA é classificado como "sem_consentimento" /
 * "sem_telefone" (números de auditoria honestos). Em segmento de envio
 * (apenasComConsentimento !== false), consentimento e telefone válido seguem
 * OBRIGATÓRIOS para casar — a invariante LGPD não muda.
 */
export function contatoCasaSegmento(
  contato: ContatoSegmentavel,
  extras: ExtrasSegmentacao,
  seg: Segmento,
): { casa: boolean; motivoExclusao?: MotivoExclusao } {
  if (seg.etapas && seg.etapas.length > 0) {
    const abertas = extras.etapasAbertas ?? [];
    if (!abertas.some((e) => seg.etapas!.includes(e))) return FORA;
  }

  if (seg.temperaturas && seg.temperaturas.length > 0) {
    const t = extras.temperatura;
    if (!t || !seg.temperaturas.includes(t)) return FORA;
  }

  if (seg.tags && seg.tags.length > 0) {
    if (!contato.tags.some((t) => seg.tags!.includes(t))) return FORA;
  }

  if (typeof seg.diasSemMovimentoMin === "number") {
    const d = extras.diasSemMovimento;
    if (typeof d !== "number" || !Number.isFinite(d) || d < seg.diasSemMovimentoMin) {
      return FORA;
    }
  }

  // LGPD: o contato CASA com os critérios — em segmento de envio, ainda
  // precisa de consentimento de marketing e telefone válido para virar alvo.
  const exigeConsentimento = seg.apenasComConsentimento !== false;
  if (exigeConsentimento) {
    if (!contato.consentimentoMarketingEm) {
      return { casa: false, motivoExclusao: "sem_consentimento" };
    }
    if (contato.telefone === null || normalizarTelefoneE164BR(contato.telefone) === null) {
      return { casa: false, motivoExclusao: "sem_telefone" };
    }
  }

  return { casa: true };
}

// ---------------------------------------------------------------------------
// Janela de atendimento (24h do WhatsApp)
// ---------------------------------------------------------------------------

const JANELA_24H_MS = 24 * 60 * 60 * 1000;

/**
 * Janela de 24h do WhatsApp: aberta enquanto NÃO se passaram 24h desde a
 * última mensagem RECEBIDA do cliente. Exatamente 24h depois ⇒ fechada.
 * Sem mensagem recebida (null) ou ISO inválido ⇒ fechada, sem expiração.
 * Fora da janela, o envio só pode usar template aprovado pela Meta.
 */
export function janelaAtendimento(
  ultimaEntradaISO: string | null,
  agoraISO: string,
): { aberta: boolean; expiraEmISO: string | null } {
  if (!ultimaEntradaISO) return { aberta: false, expiraEmISO: null };
  const inicio = Date.parse(ultimaEntradaISO);
  const agora = Date.parse(agoraISO);
  if (Number.isNaN(inicio) || Number.isNaN(agora)) {
    return { aberta: false, expiraEmISO: null };
  }
  const expira = inicio + JANELA_24H_MS;
  return { aberta: agora < expira, expiraEmISO: new Date(expira).toISOString() };
}

// ---------------------------------------------------------------------------
// Resumo de campanha
// ---------------------------------------------------------------------------

/** Números da campanha para a UI. `alvo` é o total de contatos segmentados. */
export interface ResumoCampanha {
  alvo: number;
  enviados: number;
  falhas: number;
  excluidos: number;
}

const STATUS_ENVIADO = new Set(["enviado", "entregue", "lido"]);
const STATUS_FALHA = new Set(["falha", "falhou", "erro"]);
const STATUS_EXCLUIDO = new Set(["excluido"]);

/**
 * Soma os envios por status: "enviado"/"entregue"/"lido" contam como
 * enviados; "falha"/"falhou"/"erro" como falhas; "excluido" como excluídos.
 * Qualquer outro status (ex.: "pendente") só entra no alvo.
 */
export function resumoCampanha(envios: { status: string }[]): ResumoCampanha {
  const resumo: ResumoCampanha = { alvo: envios.length, enviados: 0, falhas: 0, excluidos: 0 };
  for (const envio of envios) {
    if (STATUS_ENVIADO.has(envio.status)) resumo.enviados += 1;
    else if (STATUS_FALHA.has(envio.status)) resumo.falhas += 1;
    else if (STATUS_EXCLUIDO.has(envio.status)) resumo.excluidos += 1;
  }
  return resumo;
}
