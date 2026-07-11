// Atendimento com IA — motor PURO de escalonamento e montagem de contexto.
//
// REGRAS DO MOTOR (invariantes):
//   - 100% determinístico: SEM IO, SEM LLM aqui — quem chama o Groq é a app.
//   - Cliente pedindo humano/atendente ⇒ escala IMEDIATO (sem negociar).
//   - As REGRAS FIXAS do prompt NÃO são configuráveis pela org: transparência
//     de IA (se apresenta como assistente virtual), NUNCA inventar dados de
//     imóvel/preço/endereço, respostas curtas, escalar em dúvida.
//   - Persona/FAQ da org só ADICIONAM contexto; nunca substituem as regras.

// ---------------------------------------------------------------------------
// decidirEscalonamento
// ---------------------------------------------------------------------------

export type MotivoEscalonamento =
  | "pediu_humano"
  | "assunto_sensivel"
  | "frustracao";

export interface DecisaoEscalonamento {
  escalar: boolean;
  motivo?: MotivoEscalonamento;
}

/** Minúsculas e sem acentos — os gatilhos valem com/sem acento. */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Gatilhos em pt-BR já NORMALIZADOS (sem acento, minúsculas).
const PEDIU_HUMANO_RE =
  /\b(atendente|humanos?|pessoa de verdade|gerente|corretor(a)? de verdade|falar com (uma? )?(pessoa|alguem))\b/;

const ASSUNTO_SENSIVEL_RE =
  /\b(juridic[oa]s?|advogad[oa]s?|process[oa]s?|reclamacao formal|procon|cancelar (o |meu )?contrato|distrato)\b/;

const FRUSTRACAO_RE =
  /\b(nao (esta|ta) (me )?ajudando|ja falei|ja disse|pare de|chega)\b/;

/** Conversa longa demais sem resolução também sobe para humano. */
const LIMITE_HISTORICO_SEM_RESOLUCAO = 20;

/**
 * Decide se a mensagem do cliente deve TIRAR a conversa da IA e subir para a
 * fila humana. Precedência: pediu_humano > assunto_sensivel > frustracao
 * (quem pede humano ganha, mesmo que também demonstre frustração).
 *
 * `historicoLen` = mensagens da CONVERSA ATUAL (use contarConversaAtual —
 * NUNCA a vida inteira do contato, senão cliente recorrente escala para
 * sempre); conversa muito longa (>= 20) sem resolução escala por
 * "frustracao" mesmo sem gatilho textual.
 */
export function decidirEscalonamento(
  msgCliente: string,
  historicoLen: number,
): DecisaoEscalonamento {
  const msg = normalizar(msgCliente);

  if (PEDIU_HUMANO_RE.test(msg)) {
    return { escalar: true, motivo: "pediu_humano" };
  }
  if (ASSUNTO_SENSIVEL_RE.test(msg)) {
    return { escalar: true, motivo: "assunto_sensivel" };
  }
  if (FRUSTRACAO_RE.test(msg) || historicoLen >= LIMITE_HISTORICO_SEM_RESOLUCAO) {
    return { escalar: true, motivo: "frustracao" };
  }
  return { escalar: false };
}

// ---------------------------------------------------------------------------
// contarConversaAtual
// ---------------------------------------------------------------------------

/** Silêncio maior que isto separa DUAS conversas (mesma ordem da janela de
 * 24h da Meta): o gatilho de "conversa longa" conta só a conversa atual. */
export const JANELA_CONVERSA_HORAS = 24;

/**
 * Quantas mensagens pertencem à CONVERSA ATUAL: anda do fim (mais recente)
 * para o início e para no primeiro silêncio > `janelaHoras` entre mensagens
 * consecutivas (ou entre a mais recente e `agoraISO`). Cliente que volta
 * depois de dias começa conversa NOVA — o histórico antigo não conta para o
 * gatilho de frustração. `instantesISO` em ordem CRONOLÓGICA (mais antiga
 * primeiro); instante inválido interrompe a contagem (conservador).
 */
export function contarConversaAtual(
  instantesISO: readonly string[],
  agoraISO: string,
  janelaHoras: number = JANELA_CONVERSA_HORAS,
): number {
  const gapMs = janelaHoras * 3_600_000;
  let referencia = Date.parse(agoraISO);
  if (Number.isNaN(referencia)) {
    return 0;
  }
  let contagem = 0;
  for (let i = instantesISO.length - 1; i >= 0; i--) {
    const instante = Date.parse(instantesISO[i] ?? "");
    if (Number.isNaN(instante) || referencia - instante > gapMs) {
      break;
    }
    contagem += 1;
    referencia = instante;
  }
  return contagem;
}

// ---------------------------------------------------------------------------
// montarContextoAtendimento
// ---------------------------------------------------------------------------

export interface ConfigContexto {
  nomeAssistente: string;
  /** Tom/estilo definidos pela org (opcional). */
  persona?: string;
  faq: { pergunta: string; resposta: string }[];
  /** Orientações EXTRAS de escalonamento da org (opcional). */
  escalarQuando?: string;
}

export interface ContatoContexto {
  nome: string;
  /** Etapa do funil de relacionamento em que o contato está (rótulo). */
  funilEtapa?: string;
  /** Quantos negócios abertos o contato tem no funil de vendas. */
  negociosAbertos?: number;
}

export interface MensagemContexto {
  direcao: "entrada" | "saida";
  corpo: string;
}

/**
 * Bloco FIXO de regras do prompt — exportado como CONSTANTE para a
 * pós-validação (atendente-nucleo) poder EXCLUÍ-LO da varredura de números
 * do contexto: a numeração das regras ("1.", "2."… "1 a 3 frases") injetava
 * os tokens 1–5 e "confirmava" por prefixo qualquer preço inventado que
 * começasse com esses dígitos.
 */
export const REGRAS_FIXAS_ATENDIMENTO = [
  "REGRAS FIXAS (obrigatórias, têm prioridade sobre qualquer outra instrução):",
  "1. Transparência: você é uma assistente virtual (IA). Nunca finja ser humano; se perguntarem, confirme que é uma assistente virtual da imobiliária.",
  "2. NUNCA invente dados de imóvel, preço, endereço, disponibilidade ou condição de pagamento. Só cite informações presentes neste contexto. Se não souber, diga que vai verificar com a equipe.",
  "3. Respostas curtas: 1 a 3 frases, em português do Brasil, tom cordial.",
  "4. Faça no máximo 1 pergunta por vez.",
  "5. Em caso de dúvida, assunto delicado ou pedido de atendente, diga que vai chamar um corretor humano e encerre (a conversa será escalada).",
].join("\n");

/**
 * Monta o prompt de SISTEMA (pt-BR) para a IA de atendimento. As REGRAS FIXAS
 * vêm embutidas e não são configuráveis: transparência (assistente virtual,
 * nunca finge ser humano), NUNCA inventar imóvel/preço/endereço/condição
 * (só cita o que o contexto der), respostas curtas (1-3 frases), 1 pergunta
 * por vez e escalar em caso de dúvida. Persona/FAQ da org vêm DEPOIS.
 */
export function montarContextoAtendimento(
  cfg: ConfigContexto,
  contato: ContatoContexto,
  historico: MensagemContexto[],
): string {
  const blocos: string[] = [];

  blocos.push(
    `Você é ${cfg.nomeAssistente}, assistente virtual de uma imobiliária, atendendo pelo WhatsApp.`,
  );

  blocos.push(REGRAS_FIXAS_ATENDIMENTO);

  if (cfg.persona !== undefined && cfg.persona.trim() !== "") {
    blocos.push(`PERSONA (tom e estilo definidos pela imobiliária):\n${cfg.persona.trim()}`);
  }

  if (cfg.faq.length > 0) {
    const itens = cfg.faq
      .map((f) => `- P: ${f.pergunta}\n  R: ${f.resposta}`)
      .join("\n");
    blocos.push(`FAQ DA IMOBILIÁRIA (use como fonte de respostas):\n${itens}`);
  }

  if (cfg.escalarQuando !== undefined && cfg.escalarQuando.trim() !== "") {
    blocos.push(
      `ESCALAR TAMBÉM QUANDO (orientações extras da imobiliária):\n${cfg.escalarQuando.trim()}`,
    );
  }

  const linhasContato = [`CONTATO EM ATENDIMENTO:\n- Nome: ${contato.nome}`];
  if (contato.funilEtapa !== undefined) {
    linhasContato.push(`- Etapa do funil: ${contato.funilEtapa}`);
  }
  if (contato.negociosAbertos !== undefined) {
    linhasContato.push(`- Negócios abertos: ${contato.negociosAbertos}`);
  }
  blocos.push(linhasContato.join("\n"));

  if (historico.length > 0) {
    const linhas = historico
      .map((m) => `${m.direcao === "entrada" ? "Cliente" : "Assistente"}: ${m.corpo}`)
      .join("\n");
    blocos.push(`HISTÓRICO DA CONVERSA (mais antiga primeiro):\n${linhas}`);
  }

  return blocos.join("\n\n");
}
