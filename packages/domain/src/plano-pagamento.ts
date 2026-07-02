// Plano de pagamento de imóvel na planta (ESCOPO.md §6.2 e §7):
// ato → parcelas mensais → balões → saldo financiado nas chaves.

import { z } from "zod";
import {
  centavosSchema,
  idSchema,
  modalidadeSchema,
  percentualSchema,
  sistemaAmortizacaoSchema,
  taxaSchema,
} from "./primitivas";

/**
 * Balão (reforço) periódico do esquema do empreendimento.
 * Define valor fixo em centavos OU percentual do valor do imóvel — exatamente um.
 */
export const balaoSchema = z
  .object({
    /** Periodicidade em meses (6 = semestral, 12 = anual). */
    periodicidadeMeses: z.number().int().positive(),
    /** Valor fixo do balão, em centavos. */
    valor: centavosSchema.optional(),
    /** Percentual do valor do imóvel (fração decimal, 0.05 = 5%). */
    percentual: percentualSchema.optional(),
  })
  .strict()
  .refine((b) => (b.valor === undefined) !== (b.percentual === undefined), {
    message: "informe exatamente um entre valor e percentual",
  });

export type Balao = z.infer<typeof balaoSchema>;

/**
 * Valor da parcela mensal do esquema — valor fixo em centavos OU percentual
 * do valor do imóvel, exatamente um (mesma convenção do balão).
 */
export const parcelaMensalEsquemaSchema = z
  .object({
    /** Valor fixo da parcela, em centavos. */
    valor: centavosSchema.optional(),
    /** Percentual do valor do imóvel (fração decimal, 0.005 = 0,5%). */
    percentual: percentualSchema.optional(),
  })
  .strict()
  .refine((p) => (p.valor === undefined) !== (p.percentual === undefined), {
    message: "informe exatamente um entre valor e percentual",
  });

export type ParcelaMensalEsquema = z.infer<typeof parcelaMensalEsquemaSchema>;

/**
 * Regras do empreendimento para montagem do plano — o simulador
 * "Compre do seu jeito" varia a entrada respeitando este esquema.
 */
export const esquemaPagamentoSchema = z
  .object({
    id: idSchema,
    /** Organização dona do imóvel (multi-tenant, H-03) — denormalizado do imóvel. */
    orgId: idSchema,
    imovelId: idSchema,
    /**
     * Modalidade de financiamento padrão do empreendimento (§7; H-23) — de onde
     * derivam taxa/prazo/sistema padrão do plano (H-11).
     */
    modalidade: modalidadeSchema,
    /** Percentual mínimo do ato (sinal/entrada), fração decimal. */
    percentualMinimoAto: percentualSchema,
    /** Número de parcelas mensais durante a obra, até as chaves. */
    numeroParcelasMensais: z.number().int().nonnegative(),
    /** Valor de cada parcela mensal — obrigatório quando há parcelas. */
    parcelaMensal: parcelaMensalEsquemaSchema.optional(),
    baloes: z.array(balaoSchema),
  })
  .strict()
  .refine(
    (e) => e.numeroParcelasMensais === 0 || e.parcelaMensal !== undefined,
    { message: "esquema com parcelas mensais exige parcelaMensal" },
  );

export type EsquemaPagamento = z.infer<typeof esquemaPagamentoSchema>;

export const TIPOS_ITEM_PLANO = [
  "ato",
  "parcela",
  "balao",
  "financiamento",
  "chaves",
] as const;
export type TipoItemPlano = (typeof TIPOS_ITEM_PLANO)[number];

export const tipoItemPlanoSchema = z.enum(TIPOS_ITEM_PLANO);

/** Item do cronograma: mesRelativo 0 = assinatura/ato. */
export const itemCronogramaSchema = z
  .object({
    tipo: tipoItemPlanoSchema,
    /** Mês relativo ao início do plano (0 = ato). */
    mesRelativo: z.number().int().nonnegative(),
    /** Valor do item, em centavos. */
    valor: centavosSchema,
  })
  .strict();

export type ItemCronograma = z.infer<typeof itemCronogramaSchema>;

export const resumoPlanoSchema = z
  .object({
    /** Valor do imóvel usado no cálculo, em centavos. */
    valorImovel: centavosSchema,
    totalAto: centavosSchema,
    totalParcelas: centavosSchema,
    totalBaloes: centavosSchema,
    /** Total pago até as chaves (ato + parcelas + balões), em centavos. */
    totalAteChaves: centavosSchema,
    /** Fração do valor do imóvel quitada até as chaves. */
    percentualAteChaves: percentualSchema,
  })
  .strict();

export type ResumoPlano = z.infer<typeof resumoPlanoSchema>;

/** Resultado calculado pelo motor — sempre uma ESTIMATIVA, não proposta formal. */
export const planoPagamentoCalculadoSchema = z
  .object({
    cronograma: z.array(itemCronogramaSchema),
    /** Saldo a financiar no banco na entrega das chaves, em centavos. */
    valorFinanciado: centavosSchema,
    resumo: resumoPlanoSchema,
    /** Disclaimer estrutural: toda simulação é estimativa. */
    ehEstimativa: z.literal(true),
  })
  .strict();

export type PlanoPagamentoCalculado = z.infer<typeof planoPagamentoCalculadoSchema>;

/** Estimativa da parcela do financiamento bancário após as chaves. */
export const financiamentoPosChavesSchema = z
  .object({
    sistema: sistemaAmortizacaoSchema,
    /** Taxa EFETIVA anual usada (fração decimal). */
    taxaAnual: taxaSchema,
    /** Taxa mensal EFETIVA derivada da anual: (1+i)^(1/12)−1. */
    taxaMensal: taxaSchema,
    prazoMeses: z.number().int().positive(),
    /** Price: parcela fixa. SAC: PRIMEIRA parcela (a maior). Em centavos. */
    parcelaEstimada: centavosSchema,
    /** Price: igual à parcelaEstimada. SAC: última parcela (a menor). */
    ultimaParcela: centavosSchema,
  })
  .strict();

export type FinanciamentoPosChaves = z.infer<typeof financiamentoPosChavesSchema>;

/**
 * Correção monetária das parcelas de obra (ex.: INCC).
 * Reservado: sem correção no MVP (pós-MVP).
 */
export const correcaoMonetariaSchema = z
  .object({
    indice: z.literal("incc"),
    taxaMensal: taxaSchema,
  })
  .strict();

export type CorrecaoMonetaria = z.infer<typeof correcaoMonetariaSchema>;

/**
 * Plano recalculado pelo motor (`recalcularPlano` no core): o plano calculado
 * + parcela estimada pós-chaves. É o formato persistido em `Simulacao.resultado`.
 */
export const planoPagamentoRecalculadoSchema = planoPagamentoCalculadoSchema.extend({
  financiamentoPosChaves: financiamentoPosChavesSchema,
  /** Sempre ausente no MVP (sem INCC). */
  correcaoMonetaria: correcaoMonetariaSchema.optional(),
});

export type PlanoPagamentoRecalculado = z.infer<typeof planoPagamentoRecalculadoSchema>;
