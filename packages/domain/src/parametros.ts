// ParametrosFinanceiros versionado (ESCOPO.md §6.1, §6.3, §7; MVP-HISTORIAS H-05/H-06).
// NENHUMA regra de negócio fica hard-coded no motor: tetos, taxas, faixas e
// percentuais chegam por aqui, atualizáveis sem deploy (versionamento + vigência).
//
// SEMÂNTICA DE TAXA (decisão registrada): todo campo de taxa anual aqui é taxa
// EFETIVA anual — o motor converte para mensal com (1+i)^(1/12)−1 (convenção do
// repo). Fontes que publicam taxa NOMINAL a.a. com capitalização mensal (Caixa,
// portarias MCMV) devem ser convertidas AO GRAVAR o snapshot:
// efetiva = (1 + nominal/12)^12 − 1 (helper `taxaAnualEfetivaDeNominal` no core).

import { z } from "zod";
import type { Modalidade, SistemaAmortizacao } from "./tipos-base";
import {
  centavosSchema,
  isoDateSchema,
  percentualSchema,
  sistemaAmortizacaoSchema,
  taxaSchema,
  ufSchema,
} from "./primitivas";

/** Teto de valor de imóvel — pode variar por UF/região. */
export const tetoValorImovelSchema = z
  .object({
    /** Teto padrão, em centavos. */
    padrao: centavosSchema,
    /** Sobrescritas por UF (sigla → teto em centavos). */
    porUf: z.record(ufSchema, centavosSchema).optional(),
  })
  .strict();

export type TetoValorImovel = z.infer<typeof tetoValorImovelSchema>;

/** Faixa MCMV: até determinada renda mensal, aplica taxa, subsídio e teto próprios. */
export const faixaModalidadeSchema = z
  .object({
    /** Renda mensal bruta máxima da faixa, em centavos. */
    rendaMensalAte: centavosSchema,
    /** Taxa EFETIVA anual da faixa (fração decimal). Fontes nominais: converter ao gravar. */
    taxaAnualEfetiva: taxaSchema,
    /** Subsídio máximo da faixa, em centavos (valor real decresce com a renda). */
    subsidioMax: centavosSchema,
    /**
     * Teto de valor do imóvel DA FAIXA (ex.: MCMV 2026: F1/F2 até R$ 275 mil,
     * F3 até R$ 400 mil). Ausente = vale só o teto da modalidade. O teto
     * efetivo é min(teto da faixa, teto da modalidade).
     */
    tetoValorImovel: tetoValorImovelSchema.optional(),
  })
  .strict();

export type FaixaModalidade = z.infer<typeof faixaModalidadeSchema>;

/** Indexador pós-fixado da taxa (informativo — ver nota em configModalidadeSchema). */
export const INDEXADORES = ["tr", "ipca", "nenhum"] as const;
export type Indexador = (typeof INDEXADORES)[number];
export const indexadorSchema = z.enum(INDEXADORES);

/** Configuração de regras de uma modalidade sobre o núcleo genérico (§6.1). */
export const configModalidadeSchema = z
  .object({
    /** Taxa EFETIVA anual padrão (fração decimal); faixas podem sobrescrever. */
    taxaAnualEfetiva: taxaSchema,
    /**
     * Indexador pós-fixado da taxa contratual (ex.: SBPE = TR + taxa). O motor
     * NÃO soma o indexador no MVP — simulações com indexador "tr"/"ipca"
     * SUBESTIMAM a parcela quando o índice é positivo (ver AVISO_ESTIMATIVA).
     * Ausente = "nenhum".
     */
    indexador: indexadorSchema.optional(),
    prazoMaxMeses: z.number().int().positive(),
    /** Loan-to-value máximo da modalidade (fração decimal). */
    ltvMax: percentualSchema,
    /** Teto de valor do imóvel; ausente = sem teto (ex.: SBPE sem limite). */
    tetoValorImovel: tetoValorImovelSchema.optional(),
    /**
     * Faixas de renda (MCMV): taxa/subsídio/teto por faixa. O schema EXIGE
     * `rendaMensalAte` estritamente crescente (ordenadas, sem duplicatas) —
     * o enquadramento por `find` depende dessa ordem.
     */
    faixas: z
      .array(faixaModalidadeSchema)
      .refine(
        (faixas) =>
          faixas.every((f, i) => i === 0 || faixas[i - 1]!.rendaMensalAte < f.rendaMensalAte),
        { message: "faixas devem ter rendaMensalAte estritamente crescente (sem duplicatas)" },
      )
      .optional(),
    permiteFgts: z.boolean(),
    sistemaAmortizacaoPadrao: sistemaAmortizacaoSchema,
    /**
     * true = condições ainda não confirmadas em fonte oficial ("A VALIDAR").
     * A UI deve exibir aviso reforçado (ou bloquear) para estas modalidades.
     */
    condicoesAValidar: z.boolean().optional(),
  })
  .strict();

export type ConfigModalidade = z.infer<typeof configModalidadeSchema>;

/** LTV máximo por sistema de amortização — todas as chaves obrigatórias. */
const ltvMaxPorSistemaShape = {
  price: percentualSchema,
  sac: percentualSchema,
} satisfies Record<SistemaAmortizacao, typeof percentualSchema>;

export const parametrosGeraisSchema = z
  .object({
    /** Comprometimento máximo de renda na parcela (fração decimal, ~0.3). */
    comprometimentoRendaMax: percentualSchema,
    /** Idade máxima ao fim do contrato, em meses (regra Caixa: 80 anos e 6 meses = 966). */
    idadeMaxMeses: z.number().int().positive(),
    /** LTV máximo por sistema de amortização. */
    ltvMax: z.object(ltvMaxPorSistemaShape).strict(),
    /**
     * Teto de valor do imóvel para USO DO FGTS (teto SFH — CMN out/2025 +
     * Conselho Curador FGTS nov/2025: R$ 2,25 mi). Acima disso o FGTS não pode
     * compor entrada/amortização. Ausente = sem teto.
     */
    tetoValorImovelParaFgts: centavosSchema.optional(),
  })
  .strict();

export type ParametrosGerais = z.infer<typeof parametrosGeraisSchema>;

/** Config por modalidade — todas as modalidades do vocabulário são obrigatórias. */
const configPorModalidadeShape = {
  mcmv: configModalidadeSchema,
  sbpe: configModalidadeSchema,
  credito_associativo: configModalidadeSchema,
  imovel_novo: configModalidadeSchema,
  imovel_usado: configModalidadeSchema,
  terreno_e_construcao: configModalidadeSchema,
} satisfies Record<Modalidade, typeof configModalidadeSchema>;

/**
 * Tabela de parâmetros VERSIONADA: cada versão tem vigência por data e fonte
 * (ex.: planilha de simulação habitacional Caixa usada na validação).
 */
export const parametrosFinanceirosSchema = z
  .object({
    versao: z.number().int().positive(),
    /** Início de vigência (ISO YYYY-MM-DD). */
    vigenciaInicio: isoDateSchema,
    /** Fonte oficial dos valores, ex.: "Planilha simulação Caixa 2026-06". */
    fonte: z.string().min(1),
    parametrosGerais: parametrosGeraisSchema,
    modalidades: z.object(configPorModalidadeShape).strict(),
  })
  .strict();

export type ParametrosFinanceiros = z.infer<typeof parametrosFinanceirosSchema>;
