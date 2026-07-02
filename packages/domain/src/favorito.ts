// Favorito: cliente ↔ imóvel (opcionalmente unidade específica) — ESCOPO.md §7.

import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "./primitivas";

export const favoritoSchema = z
  .object({
    id: idSchema,
    /** Organização dona do imóvel (multi-tenant, H-03) — denormalizado na criação. */
    orgId: idSchema,
    clienteId: idSchema,
    imovelId: idSchema,
    unidadeId: idSchema.optional(),
    criadoEm: isoDateTimeSchema,
  })
  .strict();

export type Favorito = z.infer<typeof favoritoSchema>;
