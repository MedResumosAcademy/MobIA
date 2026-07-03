// Assistente de comandos — motor PURO de interpretação de frases pt-BR
// (voz ou texto) em comandos estruturados do CRM.
//
// REGRAS DO MOTOR (invariantes):
//   - 100% determinístico: SEM IO, SEM Date.now()/new Date() "de agora" —
//     o instante de referência (`agoraISO`) é SEMPRE injetado por parâmetro.
//   - Sem mágica de timezone: trabalha textualmente com os componentes locais
//     do ISO recebido e devolve ISOs com o MESMO offset do `agoraISO`.
//     (Date.UTC é usado apenas como aritmética de calendário, nunca como
//     relógio.)
//   - Normalização (minúsculas + remoção de acentos) preserva o comprimento
//     caractere a caractere, então os índices dos casamentos no texto
//     normalizado valem no texto original — campos extraídos (contato, local,
//     título, nota) mantêm caixa e acentos digitados pelo usuário.
//
// DECISÕES DOCUMENTADAS (heurísticas):
//   - Dias da semana: SEMPRE a próxima ocorrência FUTURA ("sexta" numa
//     sexta-feira ⇒ daqui a 7 dias, nunca hoje).
//   - "dia N": se N >= dia atual fica no mês corrente, senão vira o mês.
//   - Evento/lembrete sem hora explícita ⇒ 9h; sem data explícita ⇒ hoje.
//   - Valores: "450 mil", "1,2 milhão", "2 milhões e meio", "meio milhão",
//     "R$ 380.000", "380.000,00" e inteiro "cru" com 4+ dígitos (lido como
//     reais). Composições aditivas ("1 milhão e 200 mil") NÃO são somadas —
//     vale o primeiro termo reconhecido.
//   - "registra que a <contato> ...": o contato é UMA palavra (nomes compostos
//     exigem a forma "anota no negócio da <contato>: ..." ou "... que ...").
//   - Valor monetário devolvido em CENTAVOS (convenção do produto).
//   - Gestão do negócio (mudar_etapa, marcar_resultado, atualizar_valor,
//     atualizar_contato_info, concluir_tarefa): contexto de lembrete ("me
//     lembra de/que…") tem prioridade e devolve o comando ao interpretador de
//     lembrete; "anota NO negócio da X: …" continua nota, "anota o email do
//     X: …" vira atualizar_contato_info; telefone é normalizado para dígitos.

import { formatarReais } from "./modalidades";
import type { ObjetivoMensagem } from "./whatsapp";

/** Tipos de evento que o assistente sabe criar (subconjunto da agenda). */
export type TipoEventoAssistente = "visita" | "reuniao" | "compromisso";

/** Hora local extraída de um comando ("15h30" ⇒ { h: 15, m: 30 }). */
export interface HoraMinuto {
  h: number;
  m: number;
}

/** Resultado de `extrairDataHora` — só preenche o que o texto trouxer. */
export interface DataHoraExtraida {
  /** Data explícita (YYYY-MM-DD), se o texto trouxe alguma referência. */
  dataISO?: string;
  /** Hora explícita, se o texto trouxe alguma. */
  horaMin?: HoraMinuto;
  /**
   * Instante combinado (com o offset do `agoraISO`). Definido quando há data
   * OU hora no texto; a parte ausente é defaultada (data ⇒ hoje, hora ⇒ 9h).
   */
  inicioISO?: string;
}

/** Etapas do funil de negócios (mesmo domínio do kanban). */
export type EtapaNegocioAssistente = "novo" | "contato" | "visita" | "proposta" | "fechamento";

/** União discriminada de tudo que o assistente entende. */
export type ComandoInterpretado =
  | { intencao: "consultar_agenda"; dia: string }
  | {
      intencao: "criar_evento";
      titulo: string;
      tipo: TipoEventoAssistente;
      inicioISO: string;
      local?: string;
      contato?: string;
    }
  | { intencao: "criar_lembrete"; titulo: string; inicioISO: string }
  | { intencao: "criar_tarefa"; titulo: string; contato?: string; venceEm?: string }
  | { intencao: "criar_negocio"; contato: string; valor?: number; origem?: string }
  | { intencao: "registrar_nota"; contato: string; nota: string }
  | { intencao: "mudar_etapa"; contato: string; etapa: EtapaNegocioAssistente | "proxima" }
  | { intencao: "marcar_resultado"; contato: string; resultado: "ganho" | "perdido"; valor?: number }
  | { intencao: "atualizar_valor"; contato: string; valor: number }
  | { intencao: "atualizar_contato_info"; contato: string; telefone?: string; email?: string }
  | { intencao: "concluir_tarefa"; contato?: string; titulo?: string }
  | { intencao: "gerar_mensagem"; contato: string; objetivo: ObjetivoMensagem }
  | { intencao: "consultar_avisos" }
  | { intencao: "ajuda"; motivo?: string };

// ---------------------------------------------------------------------------
// Normalização e utilidades de texto
// ---------------------------------------------------------------------------

/**
 * Minúsculas sem acentos, PRESERVANDO o comprimento ("Térreo" ⇒ "terreo").
 * Caracteres cuja normalização mudaria o comprimento ficam como estão, para
 * que índices no normalizado continuem válidos no original.
 */
function normalizar(texto: string): string {
  let saida = "";
  for (const ch of texto) {
    const semAcento = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const base = semAcento.length === ch.length ? semAcento : ch;
    const minusculo = base.toLowerCase();
    saida += minusculo.length === base.length ? minusculo : base;
  }
  return saida;
}

const RE_BORDAS = /^[\s,.:;!?"'()[\]–—-]+|[\s,.:;!?"'()[\]–—-]+$/g;
const RE_CONECTOR_FINAL =
  /\s+(?:de|do|da|dos|das|no|na|nos|nas|em|para|pra|com|a|as|o|os|e|que|um|uma)$/;
const RE_ARTIGO_INICIAL = /^(?:o|a|os|as|um|uma)\s+/;
const SOBRAS = new Set([
  "de", "do", "da", "no", "na", "em", "para", "pra", "com",
  "a", "o", "e", "que", "um", "uma", "as", "os",
]);

/** Apara pontuação e conectores pendurados nas bordas de um campo extraído. */
function polir(bruto: string, opcoes?: { tirarArtigo?: boolean }): string {
  let s = bruto.replace(RE_BORDAS, "");
  while (RE_CONECTOR_FINAL.test(normalizar(s))) {
    s = s.replace(/\s+\S+$/, "").replace(RE_BORDAS, "");
  }
  if (opcoes?.tirarArtigo) {
    const artigo = RE_ARTIGO_INICIAL.exec(normalizar(s));
    if (artigo) s = s.slice(artigo[0].length);
  }
  return SOBRAS.has(normalizar(s)) ? "" : s;
}

// Tokens que ENCERRAM um campo livre (nome, título, local…).
const CORTES_TEMPO: readonly RegExp[] = [
  /\b(?:hoje|amanha|depois\s+de\s+amanha)\b/,
  /\b(?:domingo|segunda|terca|quarta|quinta|sexta|sabado)(?:-feira)?\b/,
  /\bmeio[- ]dia\b/,
  /\bmeia[- ]noite\b/,
  /\bdia\s+\d{1,2}\b/,
  /\bas\s+\d{1,2}\b/,
  /\b\d{1,2}\s*h(?:\d{2}|oras?)?\b/,
  /\b\d{1,2}:\d{2}\b/,
];
const CORTES_PONTUACAO: readonly RegExp[] = [/[,:;!?]/];
const CORTES_LUGAR: readonly RegExp[] = [/\b(?:no|na|em)\b/];

/** Índice do primeiro corte encontrado em `trecho` (ou o comprimento todo). */
function cortar(trecho: string, cortes: readonly RegExp[]): number {
  let corte = trecho.length;
  for (const re of cortes) {
    const m = re.exec(trecho);
    if (m && m.index < corte) corte = m.index;
  }
  return corte;
}

/**
 * Extrai o grupo nomeado `nome` de `re` (flag `d` obrigatória) casado sobre o
 * texto NORMALIZADO, devolvendo o trecho equivalente do texto ORIGINAL,
 * truncado no primeiro token de corte e polido. Com a flag `g`, tenta os
 * próximos casamentos quando um candidato fica vazio após o corte.
 */
function extrairCampo(
  original: string,
  norm: string,
  re: RegExp,
  nome: string,
  cortes: readonly RegExp[],
  opcoes?: { tirarArtigo?: boolean },
): string | undefined {
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(norm)) !== null) {
    const faixa = m.indices?.groups?.[nome];
    if (faixa) {
      const [ini, fim] = faixa;
      const corte = cortar(norm.slice(ini, fim), cortes);
      const valor = polir(original.slice(ini, ini + corte), opcoes);
      if (valor) return valor;
    }
    if (!re.global) break;
    re.lastIndex = m.index + 1; // padrões ancorados em $: avança na mão
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Calendário (aritmética pura — Date.UTC nunca lê o relógio da máquina)
// ---------------------------------------------------------------------------

interface InstanteLocal {
  ano: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  /** Offset textual do ISO recebido ("-03:00", "Z" ou "" se ausente). */
  offset: string;
}

const RE_ISO =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?/;

function parseInstante(iso: string): InstanteLocal {
  const m = RE_ISO.exec(iso.trim());
  if (!m || !m[1] || !m[2] || !m[3]) {
    throw new Error(`assistente: agoraISO inválido: "${iso}"`);
  }
  return {
    ano: Number(m[1]),
    mes: Number(m[2]),
    dia: Number(m[3]),
    hora: m[4] !== undefined ? Number(m[4]) : 0,
    minuto: m[5] !== undefined ? Number(m[5]) : 0,
    offset: m[6] ?? "",
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** YYYY-MM-DD normalizando estouros de mês/ano (dia 32 ⇒ mês seguinte). */
function paraDataISO(ano: number, mes: number, dia: number): string {
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** Dia da semana (0=domingo … 6=sábado) de uma data local. */
function diaDaSemana(ano: number, mes: number, dia: number): number {
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
}

function montarISO(dataISO: string, hm: HoraMinuto, offset: string): string {
  return `${dataISO}T${pad2(hm.h)}:${pad2(hm.m)}:00${offset}`;
}

function hojeISO(agora: InstanteLocal): string {
  return paraDataISO(agora.ano, agora.mes, agora.dia);
}

// ---------------------------------------------------------------------------
// extrairDataHora
// ---------------------------------------------------------------------------

const DIA_SEMANA_POR_NOME: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  terca: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6,
};

/**
 * Extrai referências de data ("hoje", "amanhã", "depois de amanhã", dias da
 * semana, "dia N") e de hora ("às 15h", "15h30", "às 9", "meio-dia") de um
 * texto pt-BR, ancoradas no instante injetado `agoraISO`.
 */
export function extrairDataHora(texto: string, agoraISO: string): DataHoraExtraida {
  const norm = normalizar(texto);
  const agora = parseInstante(agoraISO);

  let dataISO: string | undefined;
  if (/\bdepois\s+de\s+amanha\b/.test(norm)) {
    dataISO = paraDataISO(agora.ano, agora.mes, agora.dia + 2);
  } else if (/\bamanha\b/.test(norm)) {
    dataISO = paraDataISO(agora.ano, agora.mes, agora.dia + 1);
  } else if (/\bhoje\b/.test(norm)) {
    dataISO = hojeISO(agora);
  } else {
    const mSemana = /\b(domingo|segunda|terca|quarta|quinta|sexta|sabado)(?:-feira)?\b/.exec(norm);
    const nomeDia = mSemana?.[1];
    if (nomeDia !== undefined) {
      const alvo = DIA_SEMANA_POR_NOME[nomeDia];
      if (alvo !== undefined) {
        const atual = diaDaSemana(agora.ano, agora.mes, agora.dia);
        const delta = (alvo - atual + 7) % 7 || 7; // sempre futura
        dataISO = paraDataISO(agora.ano, agora.mes, agora.dia + delta);
      }
    } else {
      const mDia = /\bdia\s+(\d{1,2})\b/.exec(norm);
      const n = mDia?.[1] !== undefined ? Number(mDia[1]) : NaN;
      if (n >= 1 && n <= 31) {
        const mes = n >= agora.dia ? agora.mes : agora.mes + 1;
        dataISO = paraDataISO(agora.ano, mes, n);
      }
    }
  }

  let horaMin: HoraMinuto | undefined;
  if (/\bmeio[- ]dia\b/.test(norm)) {
    horaMin = { h: 12, m: 0 };
  } else if (/\bmeia[- ]noite\b/.test(norm)) {
    horaMin = { h: 0, m: 0 };
  } else {
    const mHora =
      /\b(\d{1,2})\s*h(?:oras?)?\s*(\d{2})?\b/.exec(norm) ??
      /\bas\s+(\d{1,2})(?::(\d{2}))?\b/.exec(norm) ??
      /\b(\d{1,2}):(\d{2})\b/.exec(norm);
    if (mHora?.[1] !== undefined) {
      const h = Number(mHora[1]);
      const m = mHora[2] !== undefined ? Number(mHora[2]) : 0;
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) horaMin = { h, m };
    }
  }

  let inicioISO: string | undefined;
  if (dataISO !== undefined || horaMin !== undefined) {
    inicioISO = montarISO(dataISO ?? hojeISO(agora), horaMin ?? { h: 9, m: 0 }, agora.offset);
  }
  return { dataISO, horaMin, inicioISO };
}

// ---------------------------------------------------------------------------
// extrairValorMonetario
// ---------------------------------------------------------------------------

function numeroPt(s: string): number {
  return Number(s.replace(",", "."));
}

function montarCentavos(inteiroComPontos: string, centavos?: string): number {
  const reais = Number(inteiroComPontos.replace(/\./g, ""));
  const cent = centavos !== undefined ? Number(centavos.padEnd(2, "0")) : 0;
  return reais * 100 + cent;
}

/**
 * Valor monetário em CENTAVOS, ou null se o texto não trouxer nenhum.
 * Suporta: "450 mil", "1,2 milhão", "2 milhões e meio", "meio milhão",
 * "R$ 380.000", "380.000,00", "380,50" e inteiros crus com 4+ dígitos
 * (lidos como reais). Ver limitações no cabeçalho do módulo.
 */
export function extrairValorMonetario(texto: string): number | null {
  const norm = normalizar(texto);

  const mMilhaoEMeio = /\b(\d+(?:[.,]\d+)?)\s*milh(?:ao|oes)\s+e\s+meio\b/.exec(norm);
  if (mMilhaoEMeio?.[1] !== undefined) {
    return Math.round((numeroPt(mMilhaoEMeio[1]) + 0.5) * 100_000_000);
  }
  const mMilhao = /\b(\d+(?:[.,]\d+)?)\s*(?:milhao|milhoes|mi)\b/.exec(norm);
  if (mMilhao?.[1] !== undefined) {
    return Math.round(numeroPt(mMilhao[1]) * 100_000_000);
  }
  if (/\bmeio\s+milhao\b/.test(norm)) return 50_000_000;

  const mMil = /\b(\d+(?:[.,]\d+)?)\s*mil\b/.exec(norm);
  if (mMil?.[1] !== undefined) {
    return Math.round(numeroPt(mMil[1]) * 100_000);
  }

  const mReal = /r\$\s*(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?/.exec(norm);
  if (mReal?.[1] !== undefined) return montarCentavos(mReal[1], mReal[2]);

  const mAgrupado = /\b(\d{1,3}(?:\.\d{3})+)(?:,(\d{1,2}))?\b/.exec(norm);
  if (mAgrupado?.[1] !== undefined) return montarCentavos(mAgrupado[1], mAgrupado[2]);

  const mDecimal = /\b(\d+),(\d{2})\b/.exec(norm);
  if (mDecimal?.[1] !== undefined) return montarCentavos(mDecimal[1], mDecimal[2]);

  const mInteiro = /\b(\d{4,})\b/.exec(norm);
  if (mInteiro?.[1] !== undefined) return Number(mInteiro[1]) * 100;

  return null;
}

// ---------------------------------------------------------------------------
// Intenções
// ---------------------------------------------------------------------------

interface Contexto {
  original: string;
  norm: string;
  agoraISO: string;
  agora: InstanteLocal;
}

// --- registrar_nota ---------------------------------------------------------

const RE_NOTA_DOIS_PONTOS =
  /\b(?:anot|registr)\w*\s+(?:ai\s+)?(?:no|na)\s+(?:negocio|negociacao|ficha|cliente)\s+(?:d[aoe]s?\s+)?(?<c>[^:]+?)\s*:\s*(?<n>.+)$/d;
const RE_NOTA_QUE =
  /\b(?:anot|registr)\w*\s+(?:ai\s+)?(?:no|na)\s+(?:negocio|negociacao|ficha|cliente)\s+(?:d[aoe]s?\s+)?(?<c>.+?)\s+que\s+(?<n>.+)$/d;
const RE_NOTA_SUJEITO = /\b(?:anot|registr)\w*\s+que\s+(?:[oa]\s+)?(?<c>\S+)\s+(?<n>.+)$/d;

function interpretarNota(ctx: Contexto): ComandoInterpretado | null {
  for (const re of [RE_NOTA_DOIS_PONTOS, RE_NOTA_QUE, RE_NOTA_SUJEITO]) {
    const m = re.exec(ctx.norm);
    const faixaC = m?.indices?.groups?.["c"];
    const faixaN = m?.indices?.groups?.["n"];
    if (faixaC && faixaN) {
      const contato = polir(ctx.original.slice(faixaC[0], faixaC[1]), { tirarArtigo: true });
      const nota = polir(ctx.original.slice(faixaN[0], faixaN[1]));
      if (contato && nota) return { intencao: "registrar_nota", contato, nota };
    }
  }
  return null;
}

// --- criar_tarefa ------------------------------------------------------------

const RES_TAREFA: readonly RegExp[] = [
  /\b(?:criar|cria|crie|nova|novo|adicionar|adiciona|adicione)\s+(?:uma\s+)?tarefa\s*[:,-]?\s*(?:de\s+)?(?<t>.+)$/d,
  /^\s*tarefa\s*[:,-]?\s*(?<t>.+)$/d,
];
const RE_TAREFA_CONTATO_NEGOCIO = /\bno\s+negocio\s+(?:d[aoe]s?\s+)?(?<c>.+)$/d;
const RE_TAREFA_CONTATO_LIGAR =
  /\b(?:ligar|telefonar|falar|retornar|cobrar)\s+(?:para|pra|com)\s+(?<c>.+)$/d;

function interpretarTarefa(ctx: Contexto): ComandoInterpretado | null {
  for (const re of RES_TAREFA) {
    const m = re.exec(ctx.norm);
    const faixaT = m?.indices?.groups?.["t"];
    if (!faixaT) continue;
    const [ini, fim] = faixaT;
    const corte = cortar(ctx.norm.slice(ini, fim), [
      ...CORTES_TEMPO,
      ...CORTES_PONTUACAO,
      /\bno\s+negocio\b/,
    ]);
    const titulo = polir(ctx.original.slice(ini, ini + corte));
    if (!titulo) return { intencao: "ajuda", motivo: "tarefa sem título" };

    const contato =
      extrairCampo(ctx.original, ctx.norm, RE_TAREFA_CONTATO_NEGOCIO, "c", [
        ...CORTES_TEMPO,
        ...CORTES_PONTUACAO,
      ], { tirarArtigo: true }) ??
      extrairCampo(ctx.original, ctx.norm, RE_TAREFA_CONTATO_LIGAR, "c", [
        ...CORTES_TEMPO,
        ...CORTES_PONTUACAO,
        /\bno\s+negocio\b/,
      ], { tirarArtigo: true });

    const venceEm = extrairDataHora(ctx.original, ctx.agoraISO).dataISO;
    return {
      intencao: "criar_tarefa",
      titulo,
      ...(contato !== undefined ? { contato } : {}),
      ...(venceEm !== undefined ? { venceEm } : {}),
    };
  }
  return null;
}

// --- criar_negocio -----------------------------------------------------------

const RES_NEGOCIO_CONTATO: readonly RegExp[] = [
  /\b(?:novo|nova|criar|cria|crie|cadastrar|cadastra|cadastre|abrir|abre|adicionar|adiciona|comecar|comeca)\s+(?:um\s+|uma\s+)?negocio\s+(?:com|para|pra|d[aoe])\s+(?<c>.+)$/d,
  /\bnegocio\s+(?:novo\s+)?(?:com|para|pra)\s+(?<c>.+)$/d,
  /\bcadastr\w*\s+(?:(?:o|a)\s+)?clien\w*\s+(?<c>.+)$/d,
];
const CORTES_NEGOCIO_CONTATO: readonly RegExp[] = [
  ...CORTES_TEMPO,
  /[,:;]/,
  /\bno\s+crm\b/,
  /\borigem\b/,
  /\bvalor\b/,
  /\br\$/,
  /\d/,
];
const RE_NEGOCIO_ORIGEM = /\borigem\s*[:=]?\s*(?:no\s+|do\s+|da\s+)?(?<o>.+)$/d;

function interpretarNegocio(ctx: Contexto): ComandoInterpretado | null {
  for (const re of RES_NEGOCIO_CONTATO) {
    const contato = extrairCampo(ctx.original, ctx.norm, re, "c", CORTES_NEGOCIO_CONTATO, {
      tirarArtigo: true,
    });
    if (!contato) continue;
    const valor = extrairValorMonetario(ctx.original);
    const origem = extrairCampo(ctx.original, ctx.norm, RE_NEGOCIO_ORIGEM, "o", [
      ...CORTES_TEMPO,
      /[,.;]/,
    ]);
    return {
      intencao: "criar_negocio",
      contato,
      ...(valor !== null ? { valor } : {}),
      ...(origem !== undefined ? { origem } : {}),
    };
  }
  return null;
}

// --- gestão do negócio: mudar_etapa / marcar_resultado / atualizar_valor -----

// Contexto de lembrete ("me lembra de/que…", "lembrete…", "não me deixa
// esquecer…") tem prioridade sobre as intenções de gestão: "me lembra que
// fechei com a Sofia" é um LEMBRETE, não um resultado.
const RE_CONTEXTO_LEMBRETE =
  /\b(?:me\s+)?lembr\w*\s+(?:de|que)\b|\blembrete\b|\bdeix[ae]\s+esquecer\b/;

const SINONIMOS_ETAPA =
  "fechamento|fechar|final|proposta|visita|contato|novo|inicio|proxima(?:\\s+etapa)?";

const RE_ETAPA_VERBO = new RegExp(
  String.raw`\b(?:mov|mud|pass|coloc|bot|jog|avanc|lev|arrast|empurr)\w*\s+(?:(?:o|a)\s+)?(?:(?:negocio|negociacao|card|cliente|ficha)\s+)?(?:d[aoe]s?\s+)?(?<c>.+?)\s+(?:para|pra|em)\s+(?:a\s+etapa\s+(?:d[eao]\s+)?|[ao]\s+)?(?<e>${SINONIMOS_ETAPA})\b`,
  "d",
);
const RE_ETAPA_SUJEITO = new RegExp(
  String.raw`^\s*(?:(?:o|a)\s+)?(?:(?:negocio|negociacao)\s+)?(?:d[aoe]s?\s+)?(?<c>\S+(?:\s+\S+){0,2}?)\s+(?:foi|passou|mudou|avancou|subiu)\s+(?:para|pra)\s+(?:a\s+etapa\s+(?:d[eao]\s+)?|[ao]\s+)?(?<e>${SINONIMOS_ETAPA})\b`,
  "d",
);
const RE_ETAPA_AVANCAR =
  /\b(?:avanc|adiant|progr)\w*\s+(?:(?:o|a)\s+)?(?:(?:negocio|negociacao|card)\s+)?(?:d[aoe]s?\s+)?(?<c>.+)$/d;
const CORTES_ETAPA_AVANCAR: readonly RegExp[] = [
  ...CORTES_PONTUACAO,
  /\bde\s+etapa\b/,
  /\buma\s+etapa\b/,
  /\bno\s+funil\b/,
  /\bpara\b/,
  /\bpra\b/,
];

function mapearEtapa(bruto: string): EtapaNegocioAssistente | "proxima" {
  const s = bruto.trim();
  if (s.startsWith("proxima")) return "proxima";
  if (s === "fechar" || s === "final") return "fechamento";
  if (s === "inicio") return "novo";
  return s as EtapaNegocioAssistente;
}

function interpretarMudarEtapa(ctx: Contexto): ComandoInterpretado | null {
  if (RE_CONTEXTO_LEMBRETE.test(ctx.norm)) return null;
  for (const re of [RE_ETAPA_VERBO, RE_ETAPA_SUJEITO]) {
    const m = re.exec(ctx.norm);
    const faixaC = m?.indices?.groups?.["c"];
    const faixaE = m?.indices?.groups?.["e"];
    if (faixaC && faixaE) {
      const contato = polir(ctx.original.slice(faixaC[0], faixaC[1]), { tirarArtigo: true });
      if (contato) {
        return {
          intencao: "mudar_etapa",
          contato,
          etapa: mapearEtapa(ctx.norm.slice(faixaE[0], faixaE[1])),
        };
      }
    }
  }
  const contato = extrairCampo(ctx.original, ctx.norm, RE_ETAPA_AVANCAR, "c", CORTES_ETAPA_AVANCAR, {
    tirarArtigo: true,
  });
  if (contato) return { intencao: "mudar_etapa", contato, etapa: "proxima" };
  return null;
}

const RE_GANHO_FECHAR =
  /\bfech(?:ei|amos|ou)\b\s*(?:o\s+negocio\s+|a\s+venda\s+|negocio\s+)?(?:com\s+)?(?:d[aoe]s?\s+)?(?<c>.+)$/d;
const RE_GANHO_VENDER =
  /\b(?:ganh(?:ei|amos|ou)|vend(?:i|emos|eu))\b\s*(?:(?:o|a)\s+)?(?:(?:negocio|negociacao|venda|imovel|apartamento|casa|apto)\s+)?(?:d[aoe]s?\s+)?(?:(?:para|pra|com)\s+)?(?<c>.+)$/d;
const RE_GANHO_VENDA =
  /\bvenda\s+(?:foi\s+)?(?:concluida|fechada|realizada|feita|ganha)\s+(?:com\s+)?(?<c>.+)$/d;
const RE_PERDA_VERBO =
  /\bperd(?:i|emos|eu)\b\s*(?:(?:o|a)\s+)?(?:(?:negocio|negociacao|venda|cliente)\s+)?(?:d[aoe]s?\s+)?(?:(?:para|pra|com)\s+)?(?<c>.+)$/d;
const RE_PERDA_SUJEITO =
  /^\s*(?:(?:o|a)\s+)?(?:cliente\s+)?(?<c>\S+(?:\s+\S+){0,2}?)\s+(?:desistiu|cancelou|recuou|nao\s+quis(?:\s+mais)?)\b/d;
const CORTES_RESULTADO: readonly RegExp[] = [
  ...CORTES_TEMPO,
  ...CORTES_PONTUACAO,
  /\bpor\b/,
  /\br\$/,
  /\d/,
];

function interpretarResultado(ctx: Contexto): ComandoInterpretado | null {
  if (RE_CONTEXTO_LEMBRETE.test(ctx.norm)) return null;
  const pares: readonly [RegExp, "ganho" | "perdido"][] = [
    [RE_GANHO_FECHAR, "ganho"],
    [RE_GANHO_VENDER, "ganho"],
    [RE_GANHO_VENDA, "ganho"],
    [RE_PERDA_VERBO, "perdido"],
    [RE_PERDA_SUJEITO, "perdido"],
  ];
  for (const [re, resultado] of pares) {
    const contato = extrairCampo(ctx.original, ctx.norm, re, "c", CORTES_RESULTADO, {
      tirarArtigo: true,
    });
    if (!contato) continue;
    const valor = extrairValorMonetario(ctx.original);
    return {
      intencao: "marcar_resultado",
      contato,
      resultado,
      ...(valor !== null ? { valor } : {}),
    };
  }
  return null;
}

const RE_VALOR_VERBO =
  /\b(?:mud|atualiz|alter|corrig|ajust|troc|arrum|coloc)\w*\s+o\s+valor\s+(?:d[aoe]s?\s+(?:negocio|negociacao|proposta|venda)\s+)?(?:d[aoe]s?\s+)?(?<c>.+)$/d;
const RE_VALOR_AGORA =
  /\b(?:o\s+)?negocio\s+d[aoe]s?\s+(?<c>.+?)\s+(?:agora\s+(?:e|eh|esta(?:\s+em)?|vale|custa)|(?:esta(?:\s+em)?|vale|custa)(?:\s+agora)?|passou\s+a\s+valer|subiu\s+para|caiu\s+para)\s+(?:de\s+|por\s+|em\s+)?(?=\S)/d;
const CORTES_VALOR: readonly RegExp[] = [
  ...CORTES_PONTUACAO,
  /\bpara\b/,
  /\bpra\b/,
  /\bem\b/,
  /\bagora\b/,
  /\br\$/,
  /\d/,
];

function interpretarAtualizarValor(ctx: Contexto): ComandoInterpretado | null {
  if (RE_CONTEXTO_LEMBRETE.test(ctx.norm)) return null;
  for (const re of [RE_VALOR_VERBO, RE_VALOR_AGORA]) {
    const contato = extrairCampo(ctx.original, ctx.norm, re, "c", CORTES_VALOR, {
      tirarArtigo: true,
    });
    if (!contato) continue;
    const valor = extrairValorMonetario(ctx.original);
    if (valor === null) continue;
    return { intencao: "atualizar_valor", contato, valor };
  }
  return null;
}

// --- atualizar_contato_info ---------------------------------------------------

const RE_INFO_FONE_CONTATO =
  /\b(?:telefone|celular|whatsapp|zap|numero)\s+(?:d[aoe]s?\s+)?(?<c>.+)$/d;
const RE_INFO_EMAIL_CONTATO = /\be-?mail\s+(?:d[aoe]s?\s+)?(?<c>.+)$/d;
const CORTES_INFO: readonly RegExp[] = [
  /\b(?:e|eh|mudou|agora|passou|virou|sera)\b/,
  /[:;,=]/,
  /[\d(+@]/,
];
const RE_FONE = /(?:\+?55[\s.-]*)?(?:\(?\d{2}\)?[\s.-]*)?\d{4,5}[\s.-]?\d{4}\b/;
const RE_EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

function interpretarContatoInfo(ctx: Contexto): ComandoInterpretado | null {
  if (RE_CONTEXTO_LEMBRETE.test(ctx.norm)) return null;
  const mencionaFone = /\b(?:telefone|celular|whatsapp|zap|numero)\b/.test(ctx.norm);
  const mencionaEmail = /\be-?mail\b/.test(ctx.norm);
  if (!mencionaFone && !mencionaEmail) return null;

  let telefone: string | undefined;
  if (mencionaFone) {
    const m = RE_FONE.exec(ctx.norm);
    if (m) {
      const digitos = m[0].replace(/\D/g, "");
      if (digitos.length >= 8 && digitos.length <= 13) telefone = digitos;
    }
  }
  const email = mencionaEmail ? RE_EMAIL.exec(ctx.original)?.[0] : undefined;
  if (telefone === undefined && email === undefined) return null;

  const contato =
    (mencionaFone
      ? extrairCampo(ctx.original, ctx.norm, RE_INFO_FONE_CONTATO, "c", CORTES_INFO, {
          tirarArtigo: true,
        })
      : undefined) ??
    (mencionaEmail
      ? extrairCampo(ctx.original, ctx.norm, RE_INFO_EMAIL_CONTATO, "c", CORTES_INFO, {
          tirarArtigo: true,
        })
      : undefined);
  if (!contato) return null;

  return {
    intencao: "atualizar_contato_info",
    contato,
    ...(telefone !== undefined ? { telefone } : {}),
    ...(email !== undefined ? { email } : {}),
  };
}

// --- concluir_tarefa -----------------------------------------------------------

const RE_CONCLUIR_MARCA_ANTES =
  /\bmarc\w*\s+(?:a\s+)?tarefa\s+(?:de\s+)?(?<t>.+?)\s+como\s+(?:feit[ao]|concluid[ao]|pront[ao])\b/d;
const RE_CONCLUIR_MARCA_DEPOIS =
  /\bmarc\w*\s+como\s+(?:feit[ao]|concluid[ao]|pront[ao])\s+(?:a\s+)?(?:tarefa\s+)?(?:de\s+)?(?<t>.+)$/d;
const RE_CONCLUIR_VERBO =
  /\b(?:conclu\w+|termin\w+|finaliz\w+|encerr\w+|acabei|ja\s+fiz|fiz)\s+(?:com\s+)?(?:a\s+|essa\s+|aquela\s+|uma\s+)?tarefa\s*[:,-]?\s*(?<t>.+)$/d;
const RE_CONCLUIR_SUJEITO =
  /\btarefa\s+d[aoe]s?\s+(?<c>.+?)\s+(?:foi\s+|esta\s+)?(?:concluida|feita|finalizada|encerrada|pronta|resolvida|ok)\b/d;
const CORTES_CONCLUIR: readonly RegExp[] = [
  ...CORTES_TEMPO,
  ...CORTES_PONTUACAO,
  /\bno\s+negocio\b/,
];

function interpretarConcluirTarefa(ctx: Contexto): ComandoInterpretado | null {
  if (RE_CONTEXTO_LEMBRETE.test(ctx.norm)) return null;
  for (const re of [RE_CONCLUIR_MARCA_ANTES, RE_CONCLUIR_MARCA_DEPOIS, RE_CONCLUIR_VERBO]) {
    const m = re.exec(ctx.norm);
    const faixaT = m?.indices?.groups?.["t"];
    if (!faixaT) continue;
    let [ini, fim] = faixaT;
    let trechoNorm = ctx.norm.slice(ini, fim);

    // "conclui a tarefa DA Patricia" ⇒ só contato (não há título).
    const mPosse = /^d[ao]s?\s+/.exec(trechoNorm);
    if (mPosse) {
      const posIni = ini + mPosse[0].length;
      const corte = cortar(ctx.norm.slice(posIni, fim), CORTES_CONCLUIR);
      const contato = polir(ctx.original.slice(posIni, posIni + corte), { tirarArtigo: true });
      if (contato) return { intencao: "concluir_tarefa", contato };
      continue;
    }

    // "tarefa DE ligar…" ⇒ o "de" é conector, não faz parte do título.
    const mDe = /^de\s+/.exec(trechoNorm);
    if (mDe) {
      ini += mDe[0].length;
      trechoNorm = trechoNorm.slice(mDe[0].length);
    }
    const corte = cortar(trechoNorm, CORTES_CONCLUIR);
    const titulo = polir(ctx.original.slice(ini, ini + corte));
    if (!titulo) continue;

    const contato =
      extrairCampo(ctx.original, ctx.norm, RE_TAREFA_CONTATO_NEGOCIO, "c", [
        ...CORTES_TEMPO,
        ...CORTES_PONTUACAO,
        /\bcomo\b/,
      ], { tirarArtigo: true }) ??
      extrairCampo(ctx.original, ctx.norm, RE_TAREFA_CONTATO_LIGAR, "c", [
        ...CORTES_TEMPO,
        ...CORTES_PONTUACAO,
        /\bno\s+negocio\b/,
        /\bcomo\b/,
      ], { tirarArtigo: true });

    return {
      intencao: "concluir_tarefa",
      titulo,
      ...(contato !== undefined ? { contato } : {}),
    };
  }

  const mSujeito = RE_CONCLUIR_SUJEITO.exec(ctx.norm);
  const faixaC = mSujeito?.indices?.groups?.["c"];
  if (faixaC) {
    const contato = polir(ctx.original.slice(faixaC[0], faixaC[1]), { tirarArtigo: true });
    if (contato) return { intencao: "concluir_tarefa", contato };
  }
  return null;
}

// --- gerar_mensagem ------------------------------------------------------------

// Fronteiras (NÃO canibalizar outras intenções):
//   - registrar_nota vem ANTES na cadeia ("anota no negócio da X: …" segue nota,
//     mesmo que a nota fale de mensagem/whatsapp);
//   - criar_tarefa vem ANTES ("cria tarefa: enviar mensagem para a X" é tarefa);
//   - contexto de lembrete devolve o comando ("me lembra de mandar mensagem…");
//   - atualizar_contato_info NÃO conflita: lá o padrão é "whatsapp DA X (é/mudou)
//     <dígitos>", aqui é "whatsapp PARA a X" / "chama a X no whatsapp" /
//     "mensagem … para a X" — sempre sem exigir número no texto.
const RE_MSG_PARA =
  /\bmensagem\b(?:\s+de\s+[\w-]+(?:\s+venda)?)?(?:\s+(?:no|pelo)\s+(?:whatsapp|zap|wpp))?\s+(?:para|pra)\s+(?<c>.+)$/d;
const RE_MSG_CHAMAR =
  /\b(?:cham|puxa|puxe)\w*\s+(?<c>.+?)\s+(?:no|pelo|por)\s+(?:whatsapp|zap|wpp)\b/d;
const RE_MSG_ZAP_PARA = /\b(?:whatsapp|zap|wpp)\s+(?:para|pra)\s+(?<c>.+)$/d;
const CORTES_MSG: readonly RegExp[] = [
  ...CORTES_PONTUACAO,
  /\bsobre\b/,
  /\bdizendo\b/,
  /\bfalando\b/,
  /\bavisando\b/,
  /\bpara\s+(?:marcar|agendar|confirmar|avancar|retomar|parabenizar)\b/,
  /\bno\s+(?:whatsapp|zap|wpp)\b/,
  /\bpelo\s+(?:whatsapp|zap|wpp)\b/,
];

/** Objetivo pela presença de palavras-chave em QUALQUER lugar do comando. */
function detectarObjetivoMensagem(norm: string): ObjetivoMensagem {
  if (/\bpos[- ]?venda\b|\bparabe\w*|\bagradec\w*/.test(norm)) return "pos_venda";
  if (/\breativ\w*|\breengaj\w*|\bsumid[oa]s?\b/.test(norm)) return "reativacao";
  if (/\bvisita\b/.test(norm)) return "visita";
  if (/\bproposta\b/.test(norm)) return "proposta";
  return "followup"; // inclui "follow-up"/"acompanhamento" e o caso sem pista
}

function interpretarGerarMensagem(ctx: Contexto): ComandoInterpretado | null {
  if (RE_CONTEXTO_LEMBRETE.test(ctx.norm)) return null;
  for (const re of [RE_MSG_PARA, RE_MSG_CHAMAR, RE_MSG_ZAP_PARA]) {
    const contato = extrairCampo(ctx.original, ctx.norm, re, "c", CORTES_MSG, {
      tirarArtigo: true,
    });
    if (!contato) continue;
    return {
      intencao: "gerar_mensagem",
      contato,
      objetivo: detectarObjetivoMensagem(ctx.norm),
    };
  }
  return null;
}

// --- criar_lembrete ----------------------------------------------------------

const RES_LEMBRETE: readonly RegExp[] = [
  /\b(?:nao\s+)?me\s+deix[ae]\s+esquecer\s+(?:de\s+)?(?<t>.+)$/d,
  /\b(?:me\s+)?lembr\w*\s+(?:de|que)\s+(?<t>.+)$/d,
  /\blembrete\s*[:,-]?\s*(?<t>.+)$/d,
];

function interpretarLembrete(ctx: Contexto): ComandoInterpretado | null {
  for (const re of RES_LEMBRETE) {
    const titulo = extrairCampo(ctx.original, ctx.norm, re, "t", [
      ...CORTES_TEMPO,
      ...CORTES_PONTUACAO,
    ]);
    if (!titulo) continue;
    const dh = extrairDataHora(ctx.original, ctx.agoraISO);
    const inicioISO =
      dh.inicioISO ?? montarISO(hojeISO(ctx.agora), { h: 9, m: 0 }, ctx.agora.offset);
    return { intencao: "criar_lembrete", titulo, inicioISO };
  }
  return null;
}

// --- criar_evento ------------------------------------------------------------

const RE_VERBO_AGENDAR = /\b(?:agend\w*|marc\w*|remarc\w*)\b/;
const RE_TIPO_EVENTO = /\b(visita|reuniao|encontro|compromisso)\b/;
const RE_COMECA_TIPO = /^\s*(?:uma?\s+)?(?:visita|reuniao)\b/;
const ROTULO_EVENTO: Record<TipoEventoAssistente, string> = {
  visita: "Visita",
  reuniao: "Reunião",
  compromisso: "Compromisso",
};

function interpretarEvento(ctx: Contexto): ComandoInterpretado | null {
  const temVerbo = RE_VERBO_AGENDAR.test(ctx.norm);
  const mTipo = RE_TIPO_EVENTO.exec(ctx.norm);
  const temCom = /\bcom\s+\S/.test(ctx.norm);
  const comecaTipo = RE_COMECA_TIPO.test(ctx.norm);
  if (!(temVerbo && (mTipo !== null || temCom)) && !comecaTipo) return null;

  const tipo: TipoEventoAssistente =
    mTipo?.[1] === "visita" ? "visita" : mTipo?.[1] === "reuniao" ? "reuniao" : "compromisso";

  const contato = extrairCampo(ctx.original, ctx.norm, /\bcom\s+(?<c>.+)$/dg, "c", [
    ...CORTES_TEMPO,
    ...CORTES_PONTUACAO,
    ...CORTES_LUGAR,
  ], { tirarArtigo: true });

  const local =
    extrairCampo(ctx.original, ctx.norm, /\b(?:no|na|em)\s+(?<l>.+)$/dg, "l", [
      ...CORTES_TEMPO,
      ...CORTES_PONTUACAO,
      /\bcom\b/,
    ]) ??
    extrairCampo(
      ctx.original,
      ctx.norm,
      /\b(?:visita|reuniao|compromisso|encontro)\s+(?:ao|a)\s+(?<l>.+)$/d,
      "l",
      [...CORTES_TEMPO, ...CORTES_PONTUACAO, /\bcom\b/],
    );

  const dh = extrairDataHora(ctx.original, ctx.agoraISO);
  const inicioISO = montarISO(
    dh.dataISO ?? hojeISO(ctx.agora),
    dh.horaMin ?? { h: 9, m: 0 },
    ctx.agora.offset,
  );

  const rotulo = ROTULO_EVENTO[tipo];
  const titulo = contato ? `${rotulo} com ${contato}` : local ? `${rotulo} — ${local}` : rotulo;

  return {
    intencao: "criar_evento",
    titulo,
    tipo,
    inicioISO,
    ...(local !== undefined ? { local } : {}),
    ...(contato !== undefined ? { contato } : {}),
  };
}

// --- consultar_avisos / consultar_agenda -------------------------------------

const RE_AVISOS =
  /\bavisos?\b|\bprioridades?\b|\bpendencias?\b|o\s+que\s+(?:eu\s+)?(?:preciso|devo|tenho\s+que)\s+fazer|onde\s+(?:eu\s+)?(?:devo|preciso)\s+agir|\bonde\s+agir\b/;

function interpretarAvisos(ctx: Contexto): ComandoInterpretado | null {
  return RE_AVISOS.test(ctx.norm) ? { intencao: "consultar_avisos" } : null;
}

const RE_AGENDA = /\bagenda\b|\bcompromissos?\b|\bo\s+que\s+(?:eu\s+)?tenho\b/;

function interpretarAgenda(ctx: Contexto): ComandoInterpretado | null {
  if (!RE_AGENDA.test(ctx.norm)) return null;
  const dia = extrairDataHora(ctx.original, ctx.agoraISO).dataISO ?? hojeISO(ctx.agora);
  return { intencao: "consultar_agenda", dia };
}

// ---------------------------------------------------------------------------
// interpretarComando
// ---------------------------------------------------------------------------

/**
 * Interpreta um comando falado/digitado em pt-BR. `agoraISO` é o instante de
 * referência INJETADO (nunca lido do relógio) — todas as datas relativas
 * ("amanhã", "sexta", "dia 10") são ancoradas nele.
 */
export function interpretarComando(texto: string, agoraISO: string): ComandoInterpretado {
  const original = texto.trim();
  if (!original) return { intencao: "ajuda", motivo: "comando vazio" };
  const ctx: Contexto = {
    original,
    norm: normalizar(original),
    agoraISO,
    agora: parseInstante(agoraISO),
  };
  // Ordem importa: âncoras mais específicas primeiro (ex.: "criar tarefa ...
  // no negócio da X" precisa vencer o padrão de negócio; "me lembra de marcar
  // visita" precisa vencer o de evento; "tarefa da Patricia concluída" precisa
  // vencer "tarefa: …"; "vendi o negócio para o Carlos" precisa vencer o de
  // criar negócio; "anota o email do Carlos: …" NÃO é nota porque nota exige
  // "no negócio/ficha/cliente…" — por isso contato_info pode vir depois.
  return (
    interpretarNota(ctx) ??
    interpretarConcluirTarefa(ctx) ??
    interpretarTarefa(ctx) ??
    interpretarGerarMensagem(ctx) ??
    interpretarMudarEtapa(ctx) ??
    interpretarResultado(ctx) ??
    interpretarAtualizarValor(ctx) ??
    interpretarNegocio(ctx) ??
    interpretarLembrete(ctx) ??
    interpretarContatoInfo(ctx) ??
    interpretarEvento(ctx) ??
    interpretarAvisos(ctx) ??
    interpretarAgenda(ctx) ??
    { intencao: "ajuda", motivo: "não reconheci o comando" }
  );
}

// ---------------------------------------------------------------------------
// descreverComando
// ---------------------------------------------------------------------------

const DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;
const MESES_CURTOS = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
] as const;

/** "2026-07-04" ⇒ "sáb, 4 de jul". */
export function formatarDiaCurto(dataISO: string): string {
  const { ano, mes, dia } = parseInstante(dataISO);
  const semana = DIAS_CURTOS[diaDaSemana(ano, mes, dia)] ?? "";
  return `${semana}, ${dia} de ${MESES_CURTOS[mes - 1] ?? ""}`;
}

/** "2026-07-04T15:30:00-03:00" ⇒ "sáb, 4 de jul às 15h30". */
export function formatarInstanteCurto(inicioISO: string): string {
  const { ano, mes, dia, hora, minuto } = parseInstante(inicioISO);
  const hm = minuto === 0 ? `${hora}h` : `${hora}h${pad2(minuto)}`;
  return `${formatarDiaCurto(paraDataISO(ano, mes, dia))} às ${hm}`;
}

function minusculaInicial(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

const ROTULO_ETAPA: Record<EtapaNegocioAssistente, string> = {
  novo: "Novo",
  contato: "Contato",
  visita: "Visita",
  proposta: "Proposta",
  fechamento: "Fechamento",
};

/** "11988887777" ⇒ "(11) 98888-7777" (deixa como está se não for 10/11 dígitos). */
export function formatarFone(digitos: string): string {
  if (digitos.length === 11) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
  }
  if (digitos.length === 10) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  }
  return digitos;
}

const ROTULO_OBJETIVO_MENSAGEM: Record<ObjetivoMensagem, string> = {
  followup: "follow-up",
  visita: "visita",
  proposta: "proposta",
  reativacao: "reativação",
  pos_venda: "pós-venda",
};

/** Frase curta em pt-BR para a UI confirmar o comando antes de executar. */
export function descreverComando(cmd: ComandoInterpretado): string {
  switch (cmd.intencao) {
    case "consultar_agenda":
      return `Mostrar agenda de ${formatarDiaCurto(cmd.dia)}`;
    case "criar_evento":
      return (
        `Agendar ${minusculaInicial(cmd.titulo)} — ${formatarInstanteCurto(cmd.inicioISO)}` +
        (cmd.local !== undefined ? ` (${cmd.local})` : "")
      );
    case "criar_lembrete":
      return `Lembrete: ${cmd.titulo} — ${formatarInstanteCurto(cmd.inicioISO)}`;
    case "criar_tarefa":
      return (
        `Criar tarefa "${cmd.titulo}"` +
        (cmd.contato !== undefined ? ` no negócio de ${cmd.contato}` : "") +
        (cmd.venceEm !== undefined ? ` — vence ${formatarDiaCurto(cmd.venceEm)}` : "")
      );
    case "criar_negocio":
      return (
        `Criar negócio com ${cmd.contato}` +
        (cmd.valor !== undefined ? ` de ${formatarReais(cmd.valor)}` : "") +
        (cmd.origem !== undefined ? ` (origem: ${cmd.origem})` : "")
      );
    case "registrar_nota":
      return `Anotar no negócio de ${cmd.contato}: "${cmd.nota}"`;
    case "mudar_etapa":
      return cmd.etapa === "proxima"
        ? `Avançar o negócio de ${cmd.contato} para a próxima etapa`
        : `Mover o negócio de ${cmd.contato} para a etapa ${ROTULO_ETAPA[cmd.etapa]}`;
    case "marcar_resultado":
      return (
        `Marcar o negócio de ${cmd.contato} como ${cmd.resultado}` +
        (cmd.valor !== undefined ? ` por ${formatarReais(cmd.valor)}` : "")
      );
    case "atualizar_valor":
      return `Atualizar o valor do negócio de ${cmd.contato} para ${formatarReais(cmd.valor)}`;
    case "atualizar_contato_info": {
      const partes = [
        ...(cmd.telefone !== undefined ? [`telefone ${formatarFone(cmd.telefone)}`] : []),
        ...(cmd.email !== undefined ? [`email ${cmd.email}`] : []),
      ];
      return `Atualizar contato de ${cmd.contato}: ${partes.join(" e ")}`;
    }
    case "concluir_tarefa":
      return (
        "Concluir tarefa" +
        (cmd.titulo !== undefined ? ` "${cmd.titulo}"` : "") +
        (cmd.contato !== undefined ? ` (negócio de ${cmd.contato})` : "")
      );
    case "gerar_mensagem":
      return `Gerar mensagem de ${ROTULO_OBJETIVO_MENSAGEM[cmd.objetivo]} no WhatsApp para ${cmd.contato}`;
    case "consultar_avisos":
      return "Mostrar avisos e prioridades";
    case "ajuda":
      return `Não entendi o comando${cmd.motivo !== undefined ? ` (${cmd.motivo})` : ""}. Tente algo como "agendar visita com Ana amanhã às 15h".`;
  }
}
