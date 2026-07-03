// Newsletter (ESCOPO.md §V2, item 16 — newsletter / automações de e-mail).
//
// Corresponde às tabelas public.newsletter_inscricoes e
// public.newsletter_edicoes (migração 0021). Aqui vivem apenas os schemas zod
// de validação e os types inferidos; org_id/autor_id da edição são preenchidos
// no banco (trigger) e não fazem parte do payload de criação.

import { z } from "zod";
import { idSchema } from "./primitivas";

/** Status possíveis de uma edição de newsletter. */
export const statusEdicaoNewsletter = ["rascunho", "pronta", "enviada"] as const;

export type StatusEdicaoNewsletter = (typeof statusEdicaoNewsletter)[number];

/**
 * Payload de inscrição na newsletter (captura pública no site).
 *
 * - `email` é normalizado (trim + minúsculas) — o check do banco exige isso.
 * - `consentimento` é `z.literal(true)`: o checkbox LGPD é OBRIGATÓRIO;
 *   sem consentimento explícito a inscrição não valida.
 */
export const inscricaoNewsletterSchema = z
  .object({
    email: z.string().trim().toLowerCase().email(),
    nome: z.string().trim().max(120).optional(),
    consentimento: z.literal(true),
  })
  .strict();

export type InscricaoNewsletterInput = z.input<typeof inscricaoNewsletterSchema>;
export type InscricaoNewsletter = z.output<typeof inscricaoNewsletterSchema>;

/**
 * Payload de criação/edição de uma edição de newsletter.
 *
 * - `titulo`/`assunto` obrigatórios (1..160 após trim), como no banco.
 * - `introducao` opcional (máx. 1000).
 * - `imovelIds` no máximo 6 imóveis por edição.
 */
export const edicaoNewsletterSchema = z
  .object({
    titulo: z.string().trim().min(1).max(160),
    assunto: z.string().trim().min(1).max(160),
    introducao: z.string().trim().max(1000).optional(),
    imovelIds: z.array(idSchema).max(6).default([]),
  })
  .strict();

export type EdicaoNewsletterInput = z.input<typeof edicaoNewsletterSchema>;
export type EdicaoNewsletter = z.output<typeof edicaoNewsletterSchema>;
