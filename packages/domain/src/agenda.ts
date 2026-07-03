// Evento de agenda do corretor (compromisso, visita, reunião, lembrete).
//
// Corresponde à tabela public.agenda_eventos (migração 0020). Aqui vive apenas
// o schema zod de validação e os types inferidos; org_id/corretor_id são
// preenchidos no banco (trigger) e não fazem parte do payload de criação.

import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "./primitivas";

/** Tipos possíveis de evento de agenda. */
export const tiposEventoAgenda = [
  "compromisso",
  "visita",
  "reuniao",
  "lembrete",
] as const;

export type TipoEventoAgenda = (typeof tiposEventoAgenda)[number];

/**
 * Payload de criação/validação de um evento de agenda.
 *
 * - `titulo` é obrigatório (1..200 após trim).
 * - `tipo` tem default "compromisso".
 * - `inicio` é timestamp ISO obrigatório; `fim` é opcional (validação
 *   fim > inicio é garantida pelo check constraint no banco).
 * - `local`, `observacao` e `negocioId` são opcionais.
 */
export const eventoAgendaSchema = z
  .object({
    titulo: z.string().trim().min(1).max(200),
    tipo: z.enum(tiposEventoAgenda).default("compromisso"),
    inicio: isoDateTimeSchema,
    fim: isoDateTimeSchema.optional(),
    local: z.string().optional(),
    negocioId: idSchema.optional(),
    observacao: z.string().optional(),
  })
  .strict();

/** Evento validado (após parse — `tipo` sempre presente pelo default). */
export type EventoAgenda = z.infer<typeof eventoAgendaSchema>;

/** Entrada de validação (antes do parse — `tipo` opcional pelo default). */
export type EventoAgendaEntrada = z.input<typeof eventoAgendaSchema>;
