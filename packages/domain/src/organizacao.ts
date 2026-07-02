// Organização = tenant (ESCOPO.md §7, MVP-HISTORIAS H-03).
// Corretor autônomo é uma org de 1 assento; imobiliária, de N assentos.

import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "./primitivas";

export const organizacaoSchema = z
  .object({
    id: idSchema,
    nome: z.string().min(1),
    /** Número de assentos (corretor autônomo = 1). */
    assentos: z.number().int().positive(),
    criadoEm: isoDateTimeSchema,
    atualizadoEm: isoDateTimeSchema.optional(),
  })
  .strict();

export type Organizacao = z.infer<typeof organizacaoSchema>;
