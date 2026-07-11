// Central de configuração da org — espelha a migração 0033 (org_config,
// tokens_captacao, webhooks_saida). Defaults SEGUROS: WhatsApp em 'teste' e
// e-mail 'simulado' — nenhuma org nasce enviando para cliente real.

import { z } from "zod";
import { idSchema } from "./primitivas";

/** Modo de envio de WhatsApp: 'teste' só envia para os números listados. */
export const MODOS_WHATSAPP = ["teste", "producao"] as const;
export type ModoWhatsapp = (typeof MODOS_WHATSAPP)[number];
export const modoWhatsappSchema = z.enum(MODOS_WHATSAPP);

/** Modo de envio de e-mail: 'simulado' não dispara nada real. */
export const MODOS_EMAIL = ["simulado", "real"] as const;
export type ModoEmail = (typeof MODOS_EMAIL)[number];
export const modoEmailSchema = z.enum(MODOS_EMAIL);

/** Número de teste: dígitos com DDI 55 (ex.: 5511999998888). */
export const numeroTesteSchema = z
  .string()
  .trim()
  .regex(/^55\d{10,11}$/, "use apenas dígitos com DDI 55 (ex.: 5511999998888)");

/** Config central da org (1 por org) — public.org_config. */
export const orgConfigSchema = z
  .object({
    whatsappModo: modoWhatsappSchema.default("teste"),
    whatsappNumerosTeste: z.array(numeroTesteSchema).max(20).default([]),
    emailModo: modoEmailSchema.default("simulado"),
    motivosPerda: z
      .array(z.string().trim().min(1).max(80))
      .min(1)
      .max(30)
      .default([
        "Sem resposta / esfriou",
        "Preco",
        "Comprou concorrente",
        "Sem interesse",
        "Momento errado",
        "Outro",
      ]),
    leadadsFunilId: idSchema.nullish(),
    leadadsConsentimento: z.boolean().default(false),
  })
  .strict();

export type OrgConfigInput = z.input<typeof orgConfigSchema>;
export type OrgConfig = z.infer<typeof orgConfigSchema>;

/**
 * Token de captação — public.tokens_captacao. O token em claro NUNCA está
 * aqui: no banco vive só o sha256 (`tokenHash`); `prefixo` (8 chars) é o que
 * a UI exibe ("imob_a1b2…"). O claro aparece uma única vez, na criação.
 */
export const tokenCaptacaoSchema = z
  .object({
    id: idSchema.optional(),
    origem: z.string().trim().min(1).max(60),
    prefixo: z.string().trim().min(1).max(16),
    ativo: z.boolean().default(true),
    criadoEm: z.string().optional(),
    ultimoUsoEm: z.string().nullish(),
  })
  .strict();

export type TokenCaptacao = z.infer<typeof tokenCaptacaoSchema>;

/** Eventos que um webhook de saída pode assinar. */
export const EVENTOS_WEBHOOK = [
  "contato.criado",
  "contato.mudou_etapa",
  "negocio.ganho",
] as const;
export type EventoWebhook = (typeof EVENTOS_WEBHOOK)[number];
export const eventoWebhookSchema = z.enum(EVENTOS_WEBHOOK);

/**
 * Webhook de saída — public.webhooks_saida. O `segredo` (usado para assinar
 * cada entrega com HMAC-SHA256 no header x-assinatura) NÃO faz parte deste
 * schema de leitura: a camada de dados só o retorna na criação.
 */
export const webhookSaidaSchema = z
  .object({
    id: idSchema.optional(),
    url: z
      .string()
      .trim()
      .url()
      .startsWith("https://", "apenas URLs https://"),
    eventos: z
      .array(eventoWebhookSchema)
      .min(1)
      .default(["contato.criado", "contato.mudou_etapa", "negocio.ganho"]),
    ativo: z.boolean().default(true),
    ultimaEntregaEm: z.string().nullish(),
    ultimaEntregaStatus: z.number().int().nullish(),
    falhasSeguidas: z.number().int().min(0).default(0),
  })
  .strict();

export type WebhookSaidaInput = z.input<typeof webhookSaidaSchema>;
export type WebhookSaida = z.infer<typeof webhookSaidaSchema>;
