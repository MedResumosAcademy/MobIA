// Negócio (deal) do funil de vendas e suas atividades (timeline).
//
// V1+ — funil de vendas, antes DELIBERADAMENTE omitido na Fase 0 (ver index.ts).
// Aqui vivem apenas o VOCABULÁRIO fixo (etapas, resultados, tipos de atividade),
// os schemas zod de validação e os types inferidos. A lógica de agregação do
// funil é PURA e vive no motor (@imobia/core/funil); os RÓTULOS de exibição
// ficam na UI (web), NUNCA aqui.

import { z } from "zod";
import { centavosSchema, idSchema, isoDateTimeSchema } from "./primitivas";

/**
 * Etapas do funil de vendas, na ordem do fluxo. Um negócio percorre estas
 * etapas até ser fechado (ganho/perdido).
 */
export const ETAPAS_NEGOCIO = [
  "novo",
  "contato",
  "visita",
  "proposta",
  "fechamento",
] as const;
export type EtapaNegocio = (typeof ETAPAS_NEGOCIO)[number];

/** Resultado de um negócio FECHADO (ausente enquanto o negócio está aberto). */
export const RESULTADOS_NEGOCIO = ["ganho", "perdido"] as const;
export type ResultadoNegocio = (typeof RESULTADOS_NEGOCIO)[number];

/** Tipos de atividade registrados na timeline de um negócio. */
export const TIPOS_ATIVIDADE = [
  "criacao",
  "nota",
  "ligacao",
  "email",
  "whatsapp",
  "visita",
  "mudanca_etapa",
  "ganho",
  "perdido",
] as const;
export type TipoAtividade = (typeof TIPOS_ATIVIDADE)[number];

export const etapaNegocioSchema = z.enum(ETAPAS_NEGOCIO);
export const resultadoNegocioSchema = z.enum(RESULTADOS_NEGOCIO);
export const tipoAtividadeSchema = z.enum(TIPOS_ATIVIDADE);

/**
 * Negócio (deal) — oportunidade de venda no funil. Multi-tenant (orgId) e
 * atribuída a um corretor. Liga-se opcionalmente a um cliente e/ou imóvel.
 *
 * - `etapa` é obrigatória; `resultado` só existe quando o negócio foi fechado.
 * - `valor` (CENTAVOS) é opcional: nem todo negócio tem valor estimado ainda.
 * - `contato` é o nome/identificação livre do contato do negócio (min 1).
 */
export const negocioSchema = z
  .object({
    id: idSchema.optional(),
    orgId: idSchema.optional(),
    corretorId: idSchema.optional(),
    clienteId: idSchema.optional(),
    imovelId: idSchema.optional(),
    etapa: etapaNegocioSchema,
    /** Presente apenas em negócio fechado (ganho/perdido). */
    resultado: resultadoNegocioSchema.optional(),
    /** Valor estimado do negócio em CENTAVOS. Opcional. */
    valor: centavosSchema.optional(),
    /** Nome/identificação livre do contato do negócio. */
    contato: z.string().min(1),
    criadoEm: isoDateTimeSchema.optional(),
    atualizadoEm: isoDateTimeSchema.optional(),
  })
  .strict();

export type Negocio = z.infer<typeof negocioSchema>;

/** Atividade da timeline de um negócio (nota, ligação, mudança de etapa, ...). */
export const negocioAtividadeSchema = z
  .object({
    id: idSchema.optional(),
    orgId: idSchema.optional(),
    negocioId: idSchema.optional(),
    autorId: idSchema.optional(),
    tipo: tipoAtividadeSchema,
    /** Descrição livre da atividade (ex.: conteúdo da nota). */
    descricao: z.string().optional(),
    criadoEm: isoDateTimeSchema.optional(),
  })
  .strict();

export type NegocioAtividade = z.infer<typeof negocioAtividadeSchema>;

/**
 * Filtros de listagem de negócios no board/funil. Todos opcionais: a ausência
 * de um campo significa "não filtrar por ele".
 */
export type FiltrosNegocios = {
  /** Restringe a uma etapa do funil. */
  etapa?: EtapaNegocio;
  /** Restringe ao corretor responsável (id). */
  responsavelId?: string;
  /** Restringe à origem do negócio. */
  origem?: string;
  /** Busca livre (nome/contato/etc.). */
  busca?: string;
};

/**
 * Nível de atenção de um negócio segundo há quanto tempo está sem movimento:
 * `ok` (recente), `atencao` (esfriando) ou `parado` (estagnado). Calculado no
 * motor (@imobia/core/atencao) a partir dos dias sem movimento.
 */
export type NivelAtencao = "ok" | "atencao" | "parado";
