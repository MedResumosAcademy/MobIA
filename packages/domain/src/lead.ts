// Evento de comportamento (base do scoring/timeline) e Lead (ESCOPO.md §5, §7).

import { z } from "zod";
import {
  idSchema,
  isoDateTimeSchema,
  temperaturaSchema,
} from "./primitivas";

/** Tipos de evento de comportamento que alimentam o termômetro (ESCOPO.md §5.2/§5.3). */
export const TIPOS_EVENTO = [
  "clique",
  "visita_ficha",
  "simulacao",
  "favorito",
  "retorno",
  "clique_financiamento",
  "sonhometro_completo",
] as const;
export type TipoEvento = (typeof TIPOS_EVENTO)[number];

export const tipoEventoSchema = z.enum(TIPOS_EVENTO);

/** Log de comportamento do cliente — base do lead scoring e da timeline. */
export const eventoSchema = z
  .object({
    id: idSchema,
    /**
     * Organização dona do imóvel (multi-tenant, H-03) — denormalizado na criação.
     * Opcional APENAS para eventos globais sem imóvel (ex.: sonhometro_completo);
     * evento ligado a imóvel exige orgId (refine abaixo).
     */
    orgId: idSchema.optional(),
    clienteId: idSchema,
    /** Alguns eventos não são ligados a um imóvel (ex.: sonhometro_completo). */
    imovelId: idSchema.optional(),
    tipo: tipoEventoSchema,
    /** Dados livres do evento (ex.: entrada escolhida numa simulação). */
    metadata: z.record(z.unknown()).default({}),
    timestamp: isoDateTimeSchema,
  })
  .strict()
  .refine((e) => e.imovelId === undefined || e.orgId !== undefined, {
    message: "evento ligado a imóvel exige orgId",
  });

export type Evento = z.infer<typeof eventoSchema>;

/** Lead = cliente + imóvel + temperatura + origem, capturado automaticamente. */
export const leadSchema = z
  .object({
    id: idSchema,
    orgId: idSchema,
    corretorId: idSchema,
    clienteId: idSchema,
    imovelId: idSchema,
    temperatura: temperaturaSchema,
    /** Origem do lead, ex.: "catalogo", "sonhometro", "indicacao". */
    origem: z.string().min(1),
    /** Contagem de eventos acumulados do cliente neste imóvel. */
    eventosCount: z.number().int().nonnegative(),
    criadoEm: isoDateTimeSchema,
    atualizadoEm: isoDateTimeSchema,
  })
  .strict();

export type Lead = z.infer<typeof leadSchema>;

/**
 * Sinais de comportamento AGREGADOS de um cliente (num imóvel ou no geral) que
 * alimentam o termômetro de lead scoring (ESCOPO.md §5.3). Cada campo é a
 * contagem de eventos daquele tipo — todos inteiros >= 0.
 *
 * Derivam dos `TIPOS_EVENTO`: `visitas` ← visita_ficha, `simulacoes` ←
 * simulacao, `favoritos` ← favorito, `cliquesFinanciamento` ←
 * clique_financiamento, `retornos` ← retorno. A lógica de scoring vive no motor
 * puro (@imobia/core), não em SQL.
 */
export const sinaisLeadSchema = z
  .object({
    /** Nº de visitas à ficha do imóvel (evento visita_ficha). */
    visitas: z.number().int().nonnegative(),
    /** Nº de simulações de financiamento feitas (evento simulacao). */
    simulacoes: z.number().int().nonnegative(),
    /** Nº de vezes que o cliente favoritou (evento favorito). */
    favoritos: z.number().int().nonnegative(),
    /** Nº de cliques em "financiamento" — sinal de maior intenção (evento clique_financiamento). */
    cliquesFinanciamento: z.number().int().nonnegative(),
    /** Nº de retornos do cliente (evento retorno). */
    retornos: z.number().int().nonnegative(),
  })
  .strict();

export type SinaisLead = z.infer<typeof sinaisLeadSchema>;
