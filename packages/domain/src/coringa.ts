// Coringa — tipos do motor determinístico de estratégias de compra
// (ESCOPO.md §5.4/§6.4). A MATEMÁTICA vive em @imobia/core (financiamento.ts);
// aqui ficam apenas os CONTRATOS de dados de entrada/saída do motor.
//
// Convenções (docs/ESCOPO.md §6):
// - Dinheiro em CENTAVOS (`Centavos`); taxas em fração decimal.
// - NENHUM valor de negócio hard-coded: taxas/tetos/LTV/prazos/comprometimento
//   chegam via `ParametrosFinanceiros` na função `gerarEstrategias` do core.
// - Todo resultado é ESTIMATIVA, não proposta formal (`ehEstimativa: true`).

import type { Centavos } from "./tipos-base";
import type { Modalidade } from "./tipos-base";

/** Cenário financeiro do cliente informado pelo corretor (ESCOPO §5.4). */
export interface CenarioCoringa {
  /** Renda mensal bruta do titular, em centavos. */
  rendaMensal: Centavos;
  /** Renda mensal bruta do cônjuge (composição de renda, §6.3), em centavos. */
  rendaConjuge?: Centavos;
  /** Saldo de FGTS disponível, em centavos. */
  fgts: Centavos;
  /** Recursos próprios para entrada (SEM FGTS), em centavos. */
  entradaPropria: Centavos;
  /** Idade do proponente, em meses (regra Caixa: idade + prazo ≤ idadeMax). */
  idadeMeses: number;
}

/** Unidade alternativa (mesma planta, andar/posição diferente — apto 905 vs 705). */
export interface UnidadeCoringa {
  id: string;
  /** Rótulo legível, ex.: "905". */
  identificador: string;
  /** Valor da unidade, em centavos. */
  valor: Centavos;
}

/** Imóvel-alvo do cenário (ESCOPO §5.4). */
export interface ImovelCoringa {
  /** Valor do imóvel-alvo (ou da unidade atual), em centavos. */
  valorImovel: Centavos;
  /** Modalidades em que o imóvel se enquadra (já filtradas pela camada superior). */
  modalidadesElegiveis: Modalidade[];
  /** Unidades alternativas do mesmo empreendimento (para a alavanca trocar_unidade). */
  unidades?: UnidadeCoringa[];
  /** Id da unidade atualmente considerada (referência para a troca). */
  unidadeAtualId?: string;
}

/** Um cenário de compra JÁ CALCULADO (baseline ou resultado de uma alavanca). */
export interface CenarioCalculado {
  modalidade: Modalidade;
  /** Entrada total aplicada (própria + FGTS quando usado), em centavos. */
  entradaTotal: Centavos;
  /** Se o FGTS compôs a entrada deste cenário. */
  usouFgts: boolean;
  /** Valor efetivamente financiado = max(0, valor − entrada), em centavos. */
  valorFinanciado: Centavos;
  /** Prazo usado: min(prazo por idade, prazo máximo da modalidade), em meses. */
  prazoMeses: number;
  /** Parcela estimada (Price: fixa; SAC: primeira parcela — a maior), em centavos. */
  parcelaEstimada: Centavos;
  /** Total pago = entrada + Σ parcelas, em centavos. */
  totalPago: Centavos;
  /** Comprometimento de renda = parcela / renda total (fração decimal). */
  comprometimentoPct: number;
  /** true quando a parcela cabe no comprometimento máximo E o financiado respeita o LTV. */
  viavel: boolean;
}

/** Alavancas de otimização do Coringa (ESCOPO §6.4). */
export const TIPOS_ESTRATEGIA = [
  "fgts_entrada",
  "aumentar_entrada",
  "trocar_modalidade",
  "trocar_unidade",
  "ajustar_prazo",
  "amortizar",
] as const;
export type TipoEstrategia = (typeof TIPOS_ESTRATEGIA)[number];

/** Impacto de uma estratégia — antes/depois em parcela e total, além do prazo. */
export interface ImpactoEstrategia {
  parcelaAntes: Centavos;
  parcelaDepois: Centavos;
  /** parcelaDepois − parcelaAntes (negativo = redução), em centavos. */
  deltaParcela: Centavos;
  totalAntes: Centavos;
  totalDepois: Centavos;
  /** totalDepois − totalAntes (negativo = economia), em centavos. */
  deltaTotal: Centavos;
  prazoDepois: number;
}

/** Uma estratégia gerada e ranqueada pelo Coringa. */
export interface Estrategia {
  id: string;
  tipo: TipoEstrategia;
  titulo: string;
  /** Explicação em pt-BR, com valores formatados (formatarReais). */
  descricao: string;
  impacto: ImpactoEstrategia;
  /** true quando a estratégia leva um baseline INVIÁVEL a um cenário viável. */
  viabilizou: boolean;
  /** Score de ranking (maior = melhor). Ver regra em `gerarEstrategias`. */
  ganho: number;
}

/** Resultado do Coringa: baseline + estratégias ranqueadas (ESCOPO §6.4). */
export interface ResultadoCoringa {
  baseline: CenarioCalculado;
  /** Estratégias benéficas, ordenadas por `ganho` desc (viabilizadoras no topo). */
  estrategias: Estrategia[];
  /** Toda simulação é estimativa, não proposta formal (ESCOPO §6.4). */
  ehEstimativa: true;
}
