// Meta (goal/target) de desempenho de um corretor ou da organização.
//
// V1+ (gamificação/gestão) — uma meta define um ALVO numérico para um período
// (ex.: fechar 5 negócios no mês). Aqui vive apenas o VOCABULÁRIO fixo de tipos
// de meta, o schema zod de validação e os types inferidos. O cálculo de
// PROGRESSO é PURO e vive no motor (@imobia/core/metas); os RÓTULOS de exibição
// ficam na UI (web), NUNCA aqui.

import { z } from "zod";

/**
 * Tipos de meta suportados. Cada tipo mapeia para uma métrica agregável em um
 * período (mês, por padrão). O que cada tipo mede:
 *   - `negocios_ganhos_mes`: negócios fechados como ganhos no mês;
 *   - `valor_vendido_mes`: soma (CENTAVOS) do valor de negócios ganhos no mês;
 *   - `novos_negocios_mes`: negócios criados no mês;
 *   - `leads_consentidos`: leads com consentimento (LGPD) registrados.
 */
export const TIPOS_META = [
  "negocios_ganhos_mes",
  "valor_vendido_mes",
  "novos_negocios_mes",
  "leads_consentidos",
] as const;
export type TipoMeta = (typeof TIPOS_META)[number];

export const tipoMetaSchema = z.enum(TIPOS_META);

/**
 * Meta de desempenho — um ALVO numérico para um `tipo`.
 *
 * - `tipo` é obrigatório (um dos TIPOS_META);
 * - `alvo` é a meta a atingir: número inteiro não negativo (contagem ou, para
 *   `valor_vendido_mes`, CENTAVOS). `0` é permitido (meta neutra).
 */
export const metaSchema = z
  .object({
    tipo: tipoMetaSchema,
    /** Alvo a atingir (contagem ou CENTAVOS). Inteiro não negativo. */
    alvo: z.number().int().nonnegative(),
  })
  .strict();

export type Meta = z.infer<typeof metaSchema>;

/**
 * Progresso de uma meta em relação ao seu alvo. Calculado no motor
 * (@imobia/core/metas) a partir de `alvo` e `atual`.
 *
 * - `progresso` é uma fração 0..1 (cap 1: mesmo se `atual` exceder `alvo`);
 * - `atingida` indica se `atual >= alvo`.
 */
export type MetaProgresso = {
  /** Tipo da meta a que este progresso se refere. */
  tipo: TipoMeta;
  /** Alvo a atingir (contagem ou CENTAVOS). */
  alvo: number;
  /** Valor atual acumulado no período. */
  atual: number;
  /** Fração 0..1 do alvo já atingido (cap em 1). */
  progresso: number;
  /** `true` se `atual >= alvo`. */
  atingida: boolean;
};
