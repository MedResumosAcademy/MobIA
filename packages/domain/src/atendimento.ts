// Atendimento com IA — config por org e templates de WhatsApp (migração 0029).
//
// Espelha public.atendimento_config e public.whatsapp_templates. Os RÓTULOS
// de exibição ficam na UI; aqui só vocabulário fixo + validação de formulário.

import { z } from "zod";
import { idSchema } from "./primitivas";

/** Quem atende a conversa AGORA (estado no contato). */
export const ESTADOS_ATENDIMENTO = ["ia", "humano", "resolvido"] as const;
export type EstadoAtendimento = (typeof ESTADOS_ATENDIMENTO)[number];
export const estadoAtendimentoSchema = z.enum(ESTADOS_ATENDIMENTO);

/** Item do FAQ que alimenta o contexto da IA. */
export const faqItemSchema = z
  .object({
    pergunta: z.string().trim().min(1).max(300),
    resposta: z.string().trim().min(1).max(1000),
  })
  .strict();

export type FaqItem = z.infer<typeof faqItemSchema>;

/**
 * Config de atendimento da org (1 por org). `iaAtiva` desligada por padrão —
 * sem GROQ_API_KEY ou com IA desligada, TUDO cai na fila humana (degrade
 * honesto). `persona` é tom/estilo; as REGRAS FIXAS (transparência, nunca
 * inventar dados) vivem no core e NÃO são configuráveis.
 */
export const configAtendimentoSchema = z
  .object({
    iaAtiva: z.boolean().default(false),
    nomeAssistente: z.string().trim().min(1).max(80).default("Assistente"),
    persona: z.string().trim().max(2000).optional(),
    boasVindas: z.string().trim().max(1000).optional(),
    faq: z.array(faqItemSchema).max(30).default([]),
    escalarQuando: z.string().trim().max(2000).optional(),
  })
  .strict();

export type ConfigAtendimentoInput = z.input<typeof configAtendimentoSchema>;
export type ConfigAtendimento = z.infer<typeof configAtendimentoSchema>;

/** Categorias aceitas pela Meta para templates (recorte que usamos). */
export const CATEGORIAS_TEMPLATE = ["marketing", "utility"] as const;
export type CategoriaTemplate = (typeof CATEGORIAS_TEMPLATE)[number];
export const categoriaTemplateSchema = z.enum(CATEGORIAS_TEMPLATE);

/**
 * Ciclo do template NO NOSSO espelho local. A aprovação acontece NA META —
 * 'aprovado'/'rejeitado' apenas REGISTRAM o veredito de lá.
 */
export const STATUS_META_TEMPLATE = [
  "rascunho",
  "submetido",
  "aprovado",
  "rejeitado",
] as const;
export type StatusMetaTemplate = (typeof STATUS_META_TEMPLATE)[number];
export const statusMetaTemplateSchema = z.enum(STATUS_META_TEMPLATE);

/**
 * Template de WhatsApp — espelho local do que é registrado na Meta.
 * `nome` é o slug EXATO da Meta (a-z, 0-9, _); `corpo` usa {{1}}, {{2}}...
 */
export const templateSchema = z
  .object({
    id: idSchema.optional(),
    nome: z
      .string()
      .trim()
      .regex(/^[a-z0-9_]+$/, "nome deve ser slug Meta (a-z, 0-9, _)")
      .min(1)
      .max(120),
    idioma: z.string().trim().min(2).max(15).default("pt_BR"),
    corpo: z.string().trim().min(1).max(1024),
    categoria: categoriaTemplateSchema,
  })
  .strict();

export type TemplateInput = z.input<typeof templateSchema>;
export type Template = z.infer<typeof templateSchema>;
