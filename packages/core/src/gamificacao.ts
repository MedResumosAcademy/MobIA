// Gamificação do corretor (PURA, sem I/O) — XP, níveis e conquistas.
//
// A partir de estatísticas agregadas do corretor (ganhos, valor vendido,
// negócios em aberto, taxa de conversão) calcula um score gamificado usado na
// vitrine/perfil. Lógica pura e testável — vive no motor (@imobia/core).
//
// CONVENÇÕES:
// - Dinheiro em CENTAVOS (`Centavos`, inteiro). R$ 1,00 = 100 centavos.
// - Todas as constantes de regra são EXPORTADAS e parametrizam o cálculo, para
//   que a UI documente/ajuste sem tocar na fórmula.

import type { Centavos } from "@imobia/domain";

/** Estatísticas agregadas do corretor (entrada do cálculo). */
export interface StatsGamificacao {
  /** Negócios com resultado 'ganho'. */
  negociosGanhos: number;
  /** Soma dos valores vendidos (negócios ganhos), em CENTAVOS. */
  valorVendido: Centavos;
  /** Negócios abertos (opcional). */
  negociosEmAberto?: number;
  /** ganhos / (ganhos + perdidos), fração 0..1 (opcional). */
  taxaConversao?: number;
}

/** Uma conquista e se está desbloqueada para as stats dadas. */
export interface Conquista {
  id: string;
  titulo: string;
  descricao: string;
  desbloqueada: boolean;
}

/** Resultado do cálculo de gamificação. */
export interface ResultadoGamificacao {
  /** XP total acumulado. */
  xp: number;
  /** Nível atual (>= 1). */
  nivel: number;
  /** XP já conquistado DENTRO do nível atual. */
  xpNoNivel: number;
  /** XP necessário para avançar do nível atual ao próximo. */
  xpParaProximoNivel: number;
  /** Progresso dentro do nível atual, fração 0..1. */
  progresso: number;
  /** Lista fixa de conquistas com `desbloqueada` conforme as stats. */
  conquistas: Conquista[];
}

// --- Constantes de regra (parametrizáveis) -------------------------------

/** XP por negócio ganho. */
export const XP_POR_GANHO = 100;
/** XP por negócio em aberto (incentivo a manter pipeline ativo). */
export const XP_POR_EM_ABERTO = 10;
/**
 * Divisor do valor vendido para XP. Valor em CENTAVOS / 1.000.000 ⇒ 1 XP a cada
 * R$ 10.000,00 vendidos (R$ 10.000 = 1.000.000 centavos).
 */
export const CENTAVOS_POR_XP_VENDA = 1_000_000;

/** Piso de valor vendido para a conquista "milionário": R$ 1.000.000,00. */
export const LIMIAR_MILIONARIO_CENTAVOS: Centavos = 100_000_000;
/** Piso de taxa de conversão para a conquista "consistente". */
export const LIMIAR_CONSISTENTE = 0.7;

/**
 * XP acumulado necessário para ATINGIR cada nível.
 * Fórmula: limiar(N) = 100 * N * (N-1) / 2 = 50 * N * (N-1).
 * ⇒ nível 1 = 0, nível 2 = 100, nível 3 = 300, nível 4 = 600, ...
 * O passo entre níveis cresce (100, 200, 300, ...), ficando mais difícil subir.
 */
export const NIVEL_MAXIMO = 30;

export const LIMIARES_NIVEL: readonly number[] = Array.from(
  { length: NIVEL_MAXIMO },
  (_, i) => {
    const nivel = i + 1;
    return 50 * nivel * (nivel - 1);
  },
);

// --- Conquistas (lista fixa, ordem estável) ------------------------------

interface DefConquista {
  id: string;
  titulo: string;
  descricao: string;
  condicao: (stats: StatsGamificacao) => boolean;
}

const DEFINICOES_CONQUISTAS: readonly DefConquista[] = [
  {
    id: "primeira_venda",
    titulo: "Primeira venda",
    descricao: "Feche seu primeiro negócio.",
    condicao: (s) => s.negociosGanhos >= 1,
  },
  {
    id: "vendedor",
    titulo: "Vendedor",
    descricao: "Feche 5 negócios.",
    condicao: (s) => s.negociosGanhos >= 5,
  },
  {
    id: "top_closer",
    titulo: "Top closer",
    descricao: "Feche 10 negócios.",
    condicao: (s) => s.negociosGanhos >= 10,
  },
  {
    id: "milionario",
    titulo: "Milionário",
    descricao: "Venda R$ 1.000.000,00 em imóveis.",
    condicao: (s) => s.valorVendido >= LIMIAR_MILIONARIO_CENTAVOS,
  },
  {
    id: "consistente",
    titulo: "Consistente",
    descricao: "Mantenha 70% de taxa de conversão.",
    condicao: (s) => (s.taxaConversao ?? 0) >= LIMIAR_CONSISTENTE,
  },
];

// --- Cálculo -------------------------------------------------------------

/** XP total a partir das stats (monótono não-decrescente em ganhos/valor/aberto). */
export function calcularXp(stats: StatsGamificacao): number {
  const ganhos = Math.max(0, stats.negociosGanhos);
  const emAberto = Math.max(0, stats.negociosEmAberto ?? 0);
  const valor = Math.max(0, stats.valorVendido);
  return (
    ganhos * XP_POR_GANHO +
    Math.floor(valor / CENTAVOS_POR_XP_VENDA) +
    emAberto * XP_POR_EM_ABERTO
  );
}

/**
 * Nível para um XP acumulado: maior N cujo `LIMIARES_NIVEL[N-1] <= xp`,
 * limitado a `NIVEL_MAXIMO`.
 */
function nivelPorXp(xp: number): number {
  let nivel = 1;
  for (let i = 0; i < LIMIARES_NIVEL.length; i += 1) {
    const limiar = LIMIARES_NIVEL[i];
    if (limiar !== undefined && xp >= limiar) {
      nivel = i + 1;
    } else {
      break;
    }
  }
  return nivel;
}

/**
 * Calcula XP, nível e conquistas a partir das stats do corretor. PURO:
 * não lê/escreve I/O, não muta a entrada, sem dependência de relógio.
 */
export function calcularGamificacao(stats: StatsGamificacao): ResultadoGamificacao {
  const xp = calcularXp(stats);
  const nivel = nivelPorXp(xp);

  const baseNivel = LIMIARES_NIVEL[nivel - 1] ?? 0;
  const noMaximo = nivel >= NIVEL_MAXIMO;
  // XP para avançar ao próximo nível (0 se já no nível máximo).
  const xpParaProximoNivel = noMaximo ? 0 : (LIMIARES_NIVEL[nivel] ?? baseNivel) - baseNivel;
  const xpNoNivel = xp - baseNivel;
  const progresso = noMaximo || xpParaProximoNivel === 0 ? 1 : xpNoNivel / xpParaProximoNivel;

  const conquistas: Conquista[] = DEFINICOES_CONQUISTAS.map((def) => ({
    id: def.id,
    titulo: def.titulo,
    descricao: def.descricao,
    desbloqueada: def.condicao(stats),
  }));

  return { xp, nivel, xpNoNivel, xpParaProximoNivel, progresso, conquistas };
}
