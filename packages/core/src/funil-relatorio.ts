// Relatório de FUNIL DE RELACIONAMENTO (agregação PURA, sem I/O).
//
// Funis customizados se aplicam a CONTATOS; o funil de negócios é canônico e
// separado (ver funil.ts). Aqui, "ganho" já vem resolvido pela camada de
// dados (contato com negócio GANHO vinculado), assim como os valores em
// centavos (abertos = receita no funil; ganhos = receita ganha).
//
// CONVENÇÕES:
// - Dinheiro em CENTAVOS (inteiro).
// - Janelas "hoje/últimos 7/últimos 30" contam por criadoEm usando FRAME
//   SIMPLES de calendário: compara os 10 primeiros caracteres do ISO
//   ("YYYY-MM-DD") de criadoEm e de agoraISO, SEM conversão de fuso — assume
//   que ambos vêm expressos no MESMO fuso (o do agoraISO). "Últimos 7" =
//   diferença de 0 a 6 dias de calendário (hoje incluso); "últimos 30" = 0 a
//   29. Datas futuras não contam.
// - 🔥 "a contatar": sem ultimaInteracaoEm OU interação há >= diasParaEsfriar
//   dias (diferença REAL de timestamps). Não conta quem já GANHOU nem quem
//   está na ETAPA FINAL do funil (encerrado/convertido).

/** Etapa de um funil de relacionamento (espelha funis.etapas do banco). */
export interface EtapaFunil {
  chave: string;
  nome: string;
  cor?: string;
}

/** Entrada mínima por contato para o relatório do funil. */
export interface ContatoRelatorio {
  /** Chave da etapa atual; null/desconhecida ⇒ fora do porEtapa, conta nos KPIs. */
  etapaChave: string | null;
  /** ISO de criação (mesmo fuso do agoraISO — ver convenções). */
  criadoEm: string;
  /** ISO da última interação; null ⇒ nunca interagiu. */
  ultimaInteracaoEm: string | null;
  /** true ⇒ contato tem negócio GANHO vinculado. */
  ganho?: boolean;
  /** Soma dos negócios ABERTOS vinculados (receita no funil). */
  valorAbertoCentavos?: number;
  /** Soma dos negócios GANHOS vinculados (receita ganha). */
  valorGanhoCentavos?: number;
}

/** Agregado de uma etapa do funil. */
export interface RelatorioEtapa {
  chave: string;
  nome: string;
  total: number;
  /** Quantos estão 🔥 a contatar nesta etapa. */
  aContatar: number;
}

/** KPIs do cabeçalho do relatório. */
export interface KpisFunil {
  /** Contatos criados hoje (frame de calendário do agoraISO). */
  hoje: number;
  /** Criados nos últimos 7 dias de calendário (hoje incluso). */
  ultimos7: number;
  /** Criados nos últimos 30 dias de calendário (hoje incluso). */
  ultimos30: number;
  total: number;
  /** Contatos com negócio ganho vinculado. */
  ganhos: number;
  /** ganhos/total, 0..1 (0 quando total = 0). */
  conversao: number;
  receitaFunilCentavos: number;
  receitaGanhaCentavos: number;
}

/** Resultado completo do relatório. */
export interface RelatorioFunil {
  /** Uma entrada por etapa do funil, na ordem dada (mesmo zeradas). */
  porEtapa: RelatorioEtapa[];
  kpis: KpisFunil;
  /** 🔥 total — inclui contatos sem etapa/etapa desconhecida (não-finais). */
  aContatarTotal: number;
}

const MS_POR_DIA = 86_400_000;

/** Dias de calendário entre dois ISOs pelo frame simples (slice da data). */
function diasDeCalendario(deISO: string, ateISO: string): number {
  const de = Date.parse(`${deISO.slice(0, 10)}T00:00:00Z`);
  const ate = Date.parse(`${ateISO.slice(0, 10)}T00:00:00Z`);
  return Math.round((ate - de) / MS_POR_DIA);
}

/**
 * 🔥 "a contatar" de UM contato — a MESMA regra usada pelo relatório
 * (exportada para a lista/kanban marcarem cada card sem duplicar a lógica):
 * sem interação alguma OU interação há >= diasParaEsfriar dias; nunca quem
 * já GANHOU nem quem está na ETAPA FINAL do funil (encerrado/convertido).
 */
export function contatoEstaAContatar(
  c: Pick<ContatoRelatorio, "etapaChave" | "ultimaInteracaoEm" | "ganho">,
  etapaFinalChave: string | null,
  diasParaEsfriar: number,
  agoraISO: string,
): boolean {
  if (c.ganho) return false;
  // Etapa final (encerrado/convertido) não pede contato.
  if (c.etapaChave !== null && c.etapaChave === etapaFinalChave) return false;
  if (c.ultimaInteracaoEm === null) return true;
  return (
    Date.parse(agoraISO) - Date.parse(c.ultimaInteracaoEm) >=
    diasParaEsfriar * MS_POR_DIA
  );
}

/**
 * Agrega os contatos de UM funil em relatório (por etapa + KPIs + 🔥).
 * Contatos com etapaChave null/desconhecida não aparecem em porEtapa, mas
 * contam nos KPIs e no aContatarTotal (nunca são "etapa final").
 */
export function relatorioDeFunil(
  contatos: ContatoRelatorio[],
  etapas: EtapaFunil[],
  diasParaEsfriar: number,
  agoraISO: string,
): RelatorioFunil {
  const chaveFinal = etapas[etapas.length - 1]?.chave ?? null;

  const estaAContatar = (c: ContatoRelatorio): boolean =>
    contatoEstaAContatar(c, chaveFinal, diasParaEsfriar, agoraISO);

  const porEtapa: RelatorioEtapa[] = etapas.map((e) => ({
    chave: e.chave,
    nome: e.nome,
    total: 0,
    aContatar: 0,
  }));
  const indicePorChave = new Map(porEtapa.map((e, i) => [e.chave, i]));

  let hoje = 0;
  let ultimos7 = 0;
  let ultimos30 = 0;
  let ganhos = 0;
  let receitaFunilCentavos = 0;
  let receitaGanhaCentavos = 0;
  let aContatarTotal = 0;

  for (const c of contatos) {
    const aContatar = estaAContatar(c);
    if (aContatar) aContatarTotal += 1;

    const linha =
      c.etapaChave === null ? undefined : porEtapa[indicePorChave.get(c.etapaChave) ?? -1];
    if (linha !== undefined) {
      linha.total += 1;
      if (aContatar) linha.aContatar += 1;
    }

    const dias = diasDeCalendario(c.criadoEm, agoraISO);
    if (dias === 0) hoje += 1;
    if (dias >= 0 && dias <= 6) ultimos7 += 1;
    if (dias >= 0 && dias <= 29) ultimos30 += 1;

    if (c.ganho) ganhos += 1;
    receitaFunilCentavos += c.valorAbertoCentavos ?? 0;
    receitaGanhaCentavos += c.valorGanhoCentavos ?? 0;
  }

  const total = contatos.length;

  return {
    porEtapa,
    kpis: {
      hoje,
      ultimos7,
      ultimos30,
      total,
      ganhos,
      conversao: total === 0 ? 0 : ganhos / total,
      receitaFunilCentavos,
      receitaGanhaCentavos,
    },
    aContatarTotal,
  };
}
