// Imóvel/empreendimento e Unidade (ESCOPO.md §7).
// Todo dado de negócio carrega orgId (multi-tenant, H-03).

import { z } from "zod";
import {
  categoriaImovelSchema,
  centavosSchema,
  idSchema,
  modalidadeSchema,
  statusImovelSchema,
  tipoImovelSchema,
  ufSchema,
} from "./primitivas";

export const geoSchema = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  })
  .strict();

export type Geo = z.infer<typeof geoSchema>;

export const imovelSchema = z
  .object({
    id: idSchema,
    orgId: idSchema,
    corretorResponsavelId: idSchema,
    tipo: tipoImovelSchema,
    /** Categorias de vitrine (filtros do catálogo). */
    categorias: z.array(categoriaImovelSchema),
    status: statusImovelSchema,
    endereco: z.string().min(1),
    cidade: z.string().min(1),
    uf: ufSchema,
    geo: geoSchema.optional(),
    /** Valor de tabela do imóvel, em centavos. */
    valor: centavosSchema,
    /** URLs das fotos. */
    fotos: z.array(z.string().url()),
    /** URLs das plantas. */
    plantas: z.array(z.string().url()),
    /** Modalidades de financiamento em que o imóvel se enquadra. */
    modalidadesElegiveis: z.array(modalidadeSchema),
    descricao: z.string(),
  })
  .strict();

export type Imovel = z.infer<typeof imovelSchema>;

/** Unidade de um empreendimento (ex.: apto 905 vs 705). */
export const unidadeSchema = z
  .object({
    id: idSchema,
    /** Organização dona do empreendimento (multi-tenant, H-03) — herdado do imóvel. */
    orgId: idSchema,
    imovelId: idSchema,
    /** Identificador da unidade, ex.: "905". */
    identificador: z.string().min(1),
    andar: z.number().int(),
    /** Posição na planta, ex.: "norte", "final 05". */
    posicao: z.string().min(1),
    /** Valor da unidade, em centavos. */
    valor: centavosSchema,
    status: statusImovelSchema,
  })
  .strict();

export type Unidade = z.infer<typeof unidadeSchema>;
