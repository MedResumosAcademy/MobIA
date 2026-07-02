// Constantes do cookie de capacidade do Sonhômetro (H-18), isoladas em módulo
// SEM "use server" para poderem ser importadas tanto por capacidade.ts quanto
// por lib/dados/sonhometro.ts (arquivos de Server Actions só exportam funções
// async — não podem reexportar constantes).

/** Nome do cookie que guarda a capacidade calculada (centavos + timestamp). */
export const COOKIE_CAPACIDADE = "mobia_capacidade";

/** Validade do cookie de capacidade: ~30 dias. */
export const COOKIE_CAPACIDADE_MAX_AGE = 60 * 60 * 24 * 30;

/** Formato serializado no cookie 'mobia_capacidade'. */
export type CookieCapacidade = { valor: number; criadoEm: string };
