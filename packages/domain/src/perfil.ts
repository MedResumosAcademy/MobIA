// Perfil público do corretor e depoimentos (gamificação/vitrine social).
//
// Contratos de dados apenas — NENHUMA lógica (a math de gamificação vive em
// @imobia/core/gamificacao). Estes tipos são consumidos por V1+ quando a
// página pública de perfil e os depoimentos entrarem.
//
// Convenções (docs/ESCOPO.md §6):
// - Datas/hora em ISO 8601 (`criadoEm`).
// - `nota` do depoimento é 1..5 (inteiro), opcional.

import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "./primitivas";

/**
 * Depoimento sobre um corretor (prova social do perfil público).
 * `autorRelacao` descreve o vínculo (ex.: "cliente", "parceiro").
 */
export const depoimentoSchema = z
  .object({
    corretorId: idSchema,
    autorNome: z.string().min(1),
    autorRelacao: z.string().min(1).optional(),
    /** Avaliação de 1 a 5 estrelas (inteiro). */
    nota: z.number().int().min(1).max(5).optional(),
    texto: z.string().min(1),
    criadoEm: isoDateTimeSchema.optional(),
  })
  .strict();

export type Depoimento = z.infer<typeof depoimentoSchema>;

/**
 * Campos editáveis do perfil PÚBLICO do corretor (vitrine social).
 * Todos opcionais: o perfil é preenchido incrementalmente pelo corretor.
 */
export const perfilPublicoCamposSchema = z
  .object({
    bio: z.string().optional(),
    telefone: z.string().optional(),
    fotoUrl: z.string().url().optional(),
    capaUrl: z.string().url().optional(),
    cidade: z.string().min(1).optional(),
    instagram: z.string().optional(),
  })
  .strict();

export type PerfilPublicoCampos = z.infer<typeof perfilPublicoCamposSchema>;
