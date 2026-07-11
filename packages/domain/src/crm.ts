// CRM 2.0 — contatos, mensagens e campanhas (fundação Meta WhatsApp Cloud API).
//
// Aqui vivem o VOCABULÁRIO fixo (canais, direções, status, origens) e os
// schemas zod de validação dos formulários/actions. Espelham a migração
// 0026_crm_contatos.sql; os RÓTULOS de exibição ficam na UI, NUNCA aqui.

import { z } from "zod";
import { idSchema } from "./primitivas";
import { ETAPAS_NEGOCIO } from "./negocio";
import { TEMPERATURAS } from "./tipos-base";

/** Canais de mensagem suportados. */
export const CANAIS_MENSAGEM = ["whatsapp", "instagram"] as const;
export type CanalMensagem = (typeof CANAIS_MENSAGEM)[number];

/** Direção de uma mensagem em relação à org. */
export const DIRECOES_MENSAGEM = ["entrada", "saida"] as const;
export type DirecaoMensagem = (typeof DIRECOES_MENSAGEM)[number];

/** Ciclo de vida de uma mensagem (statuses da Meta + 'recebida' p/ entrada). */
export const STATUS_MENSAGEM = [
  "pendente",
  "enviada",
  "entregue",
  "lida",
  "falhou",
  "recebida",
] as const;
export type StatusMensagem = (typeof STATUS_MENSAGEM)[number];

/** Ciclo de vida de uma campanha de disparo. */
export const STATUS_CAMPANHA = [
  "rascunho",
  "pronta",
  "enviando",
  "concluida",
  "falhou",
] as const;
export type StatusCampanha = (typeof STATUS_CAMPANHA)[number];

/** Resultado de cada envio individual de campanha. */
export const STATUS_CAMPANHA_ENVIO = [
  "pendente",
  "enviado",
  "falhou",
  "sem_consentimento",
  "sem_telefone",
] as const;
export type StatusCampanhaEnvio = (typeof STATUS_CAMPANHA_ENVIO)[number];

export const canalMensagemSchema = z.enum(CANAIS_MENSAGEM);
export const direcaoMensagemSchema = z.enum(DIRECOES_MENSAGEM);
export const statusMensagemSchema = z.enum(STATUS_MENSAGEM);
export const statusCampanhaSchema = z.enum(STATUS_CAMPANHA);
export const statusCampanhaEnvioSchema = z.enum(STATUS_CAMPANHA_ENVIO);

/**
 * Telefone WhatsApp: aceita máscaras livres ("+55 (11) 98888-7777"),
 * TRANSFORMA em só dígitos com DDI 55 ("5511988887777") e valida o resultado
 * (12–13 dígitos começando por 55 — DDD + 8/9 dígitos).
 */
export const telefoneWhatsappSchema = z
  .string()
  .transform((bruto) => {
    const digitos = bruto.replace(/\D/g, "");
    // 10–11 dígitos = número nacional sem DDI → prefixa o 55.
    if (digitos.length >= 10 && digitos.length <= 11) return `55${digitos}`;
    return digitos;
  })
  .refine(
    (t) => t.length >= 12 && t.length <= 13 && t.startsWith("55"),
    "telefone inválido: esperado DDD + número, com DDI 55 opcional",
  );

/**
 * Contato do CRM — pessoa da agenda da org (pode ou não ser cliente da
 * plataforma). `consentimentoMarketing` vira consentimento_marketing_em
 * (timestamp) na action; aqui é o booleano do formulário (LGPD: opt-in
 * explícito, nunca pré-marcado).
 */
export const contatoSchema = z
  .object({
    id: idSchema.optional(),
    nome: z.string().trim().min(1).max(160),
    telefone: telefoneWhatsappSchema.optional(),
    email: z.string().trim().email().optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
    consentimentoMarketing: z.boolean().default(false),
    consentimentoFonte: z.string().trim().max(200).optional(),
    observacao: z.string().trim().max(2000).optional(),
  })
  .strict();

export type ContatoInput = z.input<typeof contatoSchema>;
export type Contato = z.infer<typeof contatoSchema>;

/**
 * Segmento de uma campanha — filtros combinados por E (todas as chaves
 * presentes precisam bater); cada chave vazia/ausente = "não filtrar".
 * Ex.: {"etapas":["proposta"],"temperaturas":["pronto_para_compra"],"tags":["vip"]}
 */
export const segmentoSchema = z
  .object({
    etapas: z.array(z.enum(ETAPAS_NEGOCIO)).optional(),
    temperaturas: z.array(z.enum(TEMPERATURAS)).optional(),
    tags: z.array(z.string().trim().min(1).max(40)).optional(),
  })
  .strict();

export type Segmento = z.infer<typeof segmentoSchema>;

/**
 * Campanha de disparo — mensagem é corpo livre OU referência de template
 * aprovado na Meta (templateNome preenchido → fora da janela de 24h).
 */
export const campanhaSchema = z
  .object({
    id: idSchema.optional(),
    nome: z.string().trim().min(1).max(120),
    mensagem: z.string().trim().min(1).max(4096),
    templateNome: z.string().trim().max(120).optional(),
    segmento: segmentoSchema.default({}),
  })
  .strict();

export type CampanhaInput = z.input<typeof campanhaSchema>;
export type Campanha = z.infer<typeof campanhaSchema>;
