// Simulação = snapshot imutável de uma simulação feita pelo cliente
// (ESCOPO.md §7). Sempre uma ESTIMATIVA, nunca proposta formal.

import { z } from "zod";
import { planoPagamentoRecalculadoSchema } from "./plano-pagamento";
import {
  centavosSchema,
  idSchema,
  isoDateTimeSchema,
  modalidadeSchema,
} from "./primitivas";

export const simulacaoSchema = z
  .object({
    id: idSchema,
    /** Organização dona do imóvel (multi-tenant, H-03) — denormalizado na criação. */
    orgId: idSchema,
    /** Opcional: cliente pode simular sem estar logado/identificado. */
    clienteId: idSchema.optional(),
    imovelId: idSchema,
    unidadeId: idSchema.optional(),
    /** Entrada escolhida pelo cliente, em centavos. */
    entradaEscolhida: centavosSchema,
    modalidade: modalidadeSchema,
    /** Snapshot do resultado no momento da simulação (saída de recalcularPlano). */
    resultado: planoPagamentoRecalculadoSchema,
    /**
     * Versão do `ParametrosFinanceiros` (campo `versao` do snapshot) usado no
     * cálculo — rastreabilidade: permite auditar/reproduzir a simulação contra
     * o snapshot exato de parâmetros vigente na criação (H-05).
     */
    parametrosVersao: z.number().int().positive(),
    criadoEm: isoDateTimeSchema,
    /** Disclaimer estrutural: toda simulação é estimativa. */
    ehEstimativa: z.literal(true),
  })
  .strict();

export type Simulacao = z.infer<typeof simulacaoSchema>;
