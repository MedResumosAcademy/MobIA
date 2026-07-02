// Tarefa (to-do) associada a um negócio do funil de vendas.
//
// V1+ (CRM) — um corretor cria tarefas ("ligar amanhã", "enviar proposta")
// vinculadas a um negócio. Aqui vive apenas o schema zod de validação e o type
// inferido; a agregação/lógica é PURA e vive no motor (@imobia/core).

import { z } from "zod";
import { idSchema, isoDateSchema, isoDateTimeSchema } from "./primitivas";

/**
 * Tarefa de acompanhamento de um negócio.
 *
 * - `negocioId`/`corretorId` são obrigatórios (a quem a tarefa pertence).
 * - `titulo` é obrigatório (min 1); `descricao` é livre e opcional.
 * - `venceEm` é uma data ISO (YYYY-MM-DD), sem hora; opcional.
 * - `concluida` marca conclusão; `concluidaEm` (timestamp ISO) só existe quando concluída.
 */
export const tarefaSchema = z
  .object({
    id: idSchema.optional(),
    orgId: idSchema.optional(),
    negocioId: idSchema,
    corretorId: idSchema,
    titulo: z.string().min(1),
    /** Descrição livre da tarefa. Opcional. */
    descricao: z.string().optional(),
    /** Data de vencimento ISO (YYYY-MM-DD), sem hora. Opcional. */
    venceEm: isoDateSchema.optional(),
    concluida: z.boolean(),
    /** Timestamp ISO de conclusão. Presente apenas quando concluída. */
    concluidaEm: isoDateTimeSchema.optional(),
    criadoEm: isoDateTimeSchema.optional(),
    atualizadoEm: isoDateTimeSchema.optional(),
  })
  .strict();

export type Tarefa = z.infer<typeof tarefaSchema>;
