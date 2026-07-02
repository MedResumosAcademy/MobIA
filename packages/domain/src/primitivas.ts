// Schemas zod primitivos reutilizados pelos demais módulos do domínio.
// Espelham o vocabulário fixo de tipos-base.ts — NÃO recriam tipos, apenas
// fornecem validação em runtime para eles.

import { z } from "zod";
import {
  CATEGORIAS_IMOVEL,
  ESTADOS_CIVIS,
  MODALIDADES,
  PAPEIS,
  SISTEMAS_AMORTIZACAO,
  STATUS_IMOVEL,
  TEMPERATURAS,
  TIPOS_IMOVEL,
  type Centavos,
  type Taxa,
} from "./tipos-base";

/** Identificador de entidade (uuid). */
export const idSchema = z.string().uuid();

/** Valor monetário em CENTAVOS: inteiro não negativo. */
export const centavosSchema: z.ZodType<Centavos> = z.number().int().nonnegative();

/** Taxa como fração decimal (0.105 = 10,5% a.a.). Não limitada a 1. */
export const taxaSchema: z.ZodType<Taxa> = z.number().nonnegative().finite();

/** Percentual como fração decimal entre 0 e 1 (0.3 = 30%). */
export const percentualSchema = z.number().min(0).max(1);

/** Data ISO (YYYY-MM-DD), sem hora. */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "esperado formato ISO YYYY-MM-DD");

/** Data e hora ISO 8601 (ex.: 2026-07-01T12:00:00Z). */
export const isoDateTimeSchema = z.string().datetime({ offset: true });

/** Unidade federativa brasileira (sigla de 2 letras maiúsculas). */
export const ufSchema = z.string().regex(/^[A-Z]{2}$/, "esperada sigla de UF, ex.: SP");

// --- Enums do vocabulário fixo (tipos-base.ts) ---

export const modalidadeSchema = z.enum(MODALIDADES);
export const tipoImovelSchema = z.enum(TIPOS_IMOVEL);
export const categoriaImovelSchema = z.enum(CATEGORIAS_IMOVEL);
export const estadoCivilSchema = z.enum(ESTADOS_CIVIS);
export const papelSchema = z.enum(PAPEIS);
export const sistemaAmortizacaoSchema = z.enum(SISTEMAS_AMORTIZACAO);
export const temperaturaSchema = z.enum(TEMPERATURAS);
export const statusImovelSchema = z.enum(STATUS_IMOVEL);
