// Comunidade do corretor (PURA, sem I/O, sem banco) — streak, pontos e faixas.
//
// Motor determinístico para a feature de comunidade/feed (nacional, cross-org).
// A partir de datas de atividade (publicações) calcula o streak de dias
// consecutivos; a partir de estatísticas agregadas calcula pontos e a faixa
// (nível) do corretor na comunidade. Lógica pura e testável — "hoje" é injetado.
//
// CONVENÇÕES:
// - Datas/timestamps comparadas SOMENTE pela parte YYYY-MM-DD (10 chars),
//   evitando problemas de fuso — o chamador decide o fuso ao formatar.
// - Todas as constantes de regra são EXPORTADAS para a UI documentar/ajustar.
// - Nenhum valor de pontos é negativo.

/** Resultado do cálculo de streak. */
export interface ResultadoStreak {
  /**
   * Comprimento da sequência de dias consecutivos terminando HOJE ou ONTEM.
   * Se a atividade mais recente for anterior a ontem, `atual` = 0.
   */
  atual: number;
  /** Maior sequência de dias consecutivos em toda a série. */
  recorde: number;
}

/** Extrai a parte de data (YYYY-MM-DD) de um timestamp/data ISO. */
function soData(iso: string): string {
  return iso.slice(0, 10);
}

/** Converte YYYY-MM-DD em número serial de dias (base UTC), determinístico. */
function diaSerial(data: string): number {
  const ano = Number(data.slice(0, 4));
  const mes = Number(data.slice(5, 7));
  const dia = Number(data.slice(8, 10));
  return Math.floor(Date.UTC(ano, mes - 1, dia) / 86_400_000);
}

/**
 * Calcula o streak de dias consecutivos de atividade.
 *
 * `datasISO` são timestamps/datas das publicações do corretor (qualquer ordem,
 * com ou sem duplicatas). São normalizados para DIAS (YYYY-MM-DD), deduplicados
 * e ordenados.
 *
 * - `atual`: sequência consecutiva terminando em HOJE ou ONTEM. Se ainda não
 *   houve atividade hoje mas houve ontem, o streak continua valendo. Se a
 *   atividade mais recente for anterior a ontem, `atual` = 0.
 * - `recorde`: a maior sequência consecutiva de toda a série.
 *
 * PURO e determinístico: `hojeISO` é injetado. Lista vazia ⇒ { atual: 0, recorde: 0 }.
 */
export function calcularStreak(datasISO: string[], hojeISO: string): ResultadoStreak {
  if (datasISO.length === 0) return { atual: 0, recorde: 0 };

  // Normaliza → dias únicos, ordenados asc.
  const dias = Array.from(new Set(datasISO.map((iso) => diaSerial(soData(iso))))).sort(
    (a, b) => a - b,
  );

  // Recorde: maior run de dias consecutivos.
  let recorde = 1;
  let run = 1;
  for (let i = 1; i < dias.length; i += 1) {
    const anterior = dias[i - 1];
    const atualDia = dias[i];
    if (anterior === undefined || atualDia === undefined) continue;
    if (atualDia === anterior + 1) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > recorde) recorde = run;
  }

  // Atual: sequência terminando em hoje OU ontem.
  const hoje = diaSerial(soData(hojeISO));
  const maisRecente = dias[dias.length - 1];
  let atual = 0;
  if (maisRecente !== undefined && (maisRecente === hoje || maisRecente === hoje - 1)) {
    atual = 1;
    for (let i = dias.length - 2; i >= 0; i -= 1) {
      const d = dias[i];
      const seguinte = dias[i + 1];
      if (d === undefined || seguinte === undefined) break;
      if (d === seguinte - 1) {
        atual += 1;
      } else {
        break;
      }
    }
  }

  return { atual, recorde };
}

/** Estatísticas agregadas do corretor na comunidade (entrada do cálculo). */
export interface StatsComunidade {
  /** Total de publicações feitas. */
  publicacoes: number;
  /** Total de curtidas recebidas nas publicações. */
  curtidasRecebidas: number;
  /** Total de seguidores. */
  seguidores: number;
  /** Streak atual (dias consecutivos de atividade), de `calcularStreak`. */
  streakAtual: number;
}

/** Pesos da fórmula de pontos da comunidade (parametrizáveis). */
export const PESOS_COMUNIDADE = {
  publicacao: 10,
  curtida: 3,
  seguidor: 8,
  streak: 5,
} as const;

/**
 * Calcula os pontos de comunidade a partir das stats. Cada componente negativo
 * é tratado como 0, então o resultado NUNCA é negativo. PURO.
 */
export function calcularPontosComunidade(stats: StatsComunidade): number {
  const publicacoes = Math.max(0, stats.publicacoes);
  const curtidas = Math.max(0, stats.curtidasRecebidas);
  const seguidores = Math.max(0, stats.seguidores);
  const streak = Math.max(0, stats.streakAtual);
  return (
    publicacoes * PESOS_COMUNIDADE.publicacao +
    curtidas * PESOS_COMUNIDADE.curtida +
    seguidores * PESOS_COMUNIDADE.seguidor +
    streak * PESOS_COMUNIDADE.streak
  );
}

/** Uma faixa (nível) da comunidade. */
export interface FaixaComunidade {
  /** Nível da faixa (>= 1). */
  nivel: number;
  /** Título da faixa. */
  titulo: string;
  /** Pontos que faltam para a próxima faixa; `null` na última. */
  proxima: number | null;
}

/** Definição de uma faixa: pontos mínimos para atingi-la e título. */
interface DefFaixa {
  minimo: number;
  titulo: string;
}

/**
 * Faixas progressivas da comunidade, por limiar de pontos ACUMULADOS.
 * Ordem ascendente por `minimo`. O passo entre faixas cresce.
 */
export const FAIXAS_COMUNIDADE: readonly DefFaixa[] = [
  { minimo: 0, titulo: "Iniciante" },
  { minimo: 100, titulo: "Corretor Ativo" },
  { minimo: 500, titulo: "Destaque" },
  { minimo: 1500, titulo: "Referência" },
  { minimo: 5000, titulo: "Lenda" },
];

/**
 * Determina a faixa da comunidade para um total de pontos.
 * `proxima` = pontos que faltam para a próxima faixa (null na última).
 * Pontos negativos são tratados como 0. PURO.
 */
export function faixaComunidade(pontos: number): FaixaComunidade {
  const p = Math.max(0, pontos);

  let indice = 0;
  for (let i = 0; i < FAIXAS_COMUNIDADE.length; i += 1) {
    const faixa = FAIXAS_COMUNIDADE[i];
    if (faixa !== undefined && p >= faixa.minimo) {
      indice = i;
    } else {
      break;
    }
  }

  const atual = FAIXAS_COMUNIDADE[indice];
  const seguinte = FAIXAS_COMUNIDADE[indice + 1];
  const nivel = indice + 1;
  const titulo = atual?.titulo ?? "Iniciante";
  const proxima = seguinte === undefined ? null : seguinte.minimo - p;

  return { nivel, titulo, proxima };
}
