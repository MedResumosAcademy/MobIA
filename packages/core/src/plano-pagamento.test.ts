// Testes do recálculo de plano ("Compre do seu jeito") — ESCOPO.md §4.3/§4.4/§6.2.
// Valores esperados verificados à mão (ver contas nos comentários).

import { describe, expect, it } from "vitest";
import {
  esquemaPagamentoSchema,
  planoPagamentoRecalculadoSchema,
  type Balao,
  type Centavos,
  type EsquemaPagamento,
} from "@imobia/domain";
import { parcelaPrice, taxaMensalDeAnual } from "./financiamento";
import {
  recalcularPlano,
  type EntradaRecalculoPlano,
  type PlanoPagamentoRecalculado,
} from "./plano-pagamento";

const ID_A = "00000000-0000-4000-8000-000000000001";
const ID_B = "00000000-0000-4000-8000-000000000002";
const ID_ORG = "00000000-0000-4000-8000-00000000000f";

/** Esquema do cenário do escopo: 3% de ato mínimo, 24×0,5% e balões semestrais de 5%. */
const esquemaEscopo: EsquemaPagamento = esquemaPagamentoSchema.parse({
  id: ID_A,
  orgId: ID_ORG,
  imovelId: ID_B,
  modalidade: "mcmv",
  percentualMinimoAto: 0.03,
  numeroParcelasMensais: 24,
  parcelaMensal: { percentual: 0.005 },
  baloes: [{ periodicidadeMeses: 6, percentual: 0.05 }],
});

/** R$ 320.000,00 em centavos. */
const VALOR_IMOVEL = 32_000_000;

const financiamentoPrice = { taxaAnual: 0.105, prazoMeses: 360, sistema: "price" } as const;

function planoOk(input: EntradaRecalculoPlano): PlanoPagamentoRecalculado {
  const resultado = recalcularPlano(input);
  if (!resultado.ok) {
    throw new Error(`esperava ok, obteve erro: ${resultado.erro.tipo}`);
  }
  return resultado.plano;
}

/** Invariante inegociável: a soma dos itens do cronograma é o valor do imóvel. */
function somaCronograma(plano: PlanoPagamentoRecalculado): Centavos {
  return plano.cronograma.reduce((acc, item) => acc + item.valor, 0);
}

describe("recalcularPlano — cenário do escopo (imóvel de R$ 320.000)", () => {
  // Contas à mão: parcelas 24 × round(32_000_000·0,005) = 24 × 160_000 = 3_840_000.
  // Balões nos meses 6, 12, 18 e 24: 4 × round(32_000_000·0,05) = 4 × 1_600_000 = 6_400_000.
  // Financiado = 32_000_000 − entrada − 3_840_000 − 6_400_000.
  const casos: Array<{ entrada: Centavos; financiadoEsperado: Centavos }> = [
    { entrada: 1_000_000, financiadoEsperado: 20_760_000 }, // R$ 10k
    { entrada: 2_000_000, financiadoEsperado: 19_760_000 }, // R$ 20k
    { entrada: 3_000_000, financiadoEsperado: 18_760_000 }, // R$ 30k
    { entrada: 5_000_000, financiadoEsperado: 16_760_000 }, // R$ 50k
  ];

  it.each(casos)(
    "entrada de $entrada centavos → financiado $financiadoEsperado",
    ({ entrada, financiadoEsperado }) => {
      const plano = planoOk({
        valorImovel: VALOR_IMOVEL,
        esquema: esquemaEscopo,
        entradaEscolhida: entrada,
        financiamento: financiamentoPrice,
      });

      expect(plano.valorFinanciado).toBe(financiadoEsperado);
      expect(plano.resumo.totalAto).toBe(entrada);
      expect(plano.resumo.totalParcelas).toBe(3_840_000);
      expect(plano.resumo.totalBaloes).toBe(6_400_000);
      expect(somaCronograma(plano)).toBe(VALOR_IMOVEL);
      expect(plano.ehEstimativa).toBe(true);
      // Consistência com o motor de financiamento (Price):
      expect(plano.financiamentoPosChaves.parcelaEstimada).toBe(
        parcelaPrice(financiadoEsperado, taxaMensalDeAnual(0.105), 360),
      );
    },
  );

  it("é monotônico: entrada maior → financiamento menor E parcela menor", () => {
    const planos = casos.map(({ entrada }) =>
      planoOk({
        valorImovel: VALOR_IMOVEL,
        esquema: esquemaEscopo,
        entradaEscolhida: entrada,
        financiamento: financiamentoPrice,
      }),
    );
    for (let i = 1; i < planos.length; i++) {
      expect(planos[i]!.valorFinanciado).toBeLessThan(planos[i - 1]!.valorFinanciado);
      expect(planos[i]!.financiamentoPosChaves.parcelaEstimada).toBeLessThan(
        planos[i - 1]!.financiamentoPosChaves.parcelaEstimada,
      );
    }
  });

  it("taxa 0 → parcela = financiado/prazo (verificável à mão)", () => {
    const plano = planoOk({
      valorImovel: VALOR_IMOVEL,
      esquema: esquemaEscopo,
      entradaEscolhida: 1_000_000,
      financiamento: { taxaAnual: 0, prazoMeses: 360, sistema: "price" },
    });
    // 20_760_000 / 360 = 57_666,66… → 57_667
    expect(plano.financiamentoPosChaves.parcelaEstimada).toBe(57_667);
  });
});

describe("recalcularPlano — cronograma", () => {
  it("ordena por mesRelativo com marcos ato → parcelas → balões → financiamento → chaves", () => {
    const plano = planoOk({
      valorImovel: VALOR_IMOVEL,
      esquema: esquemaEscopo,
      entradaEscolhida: 1_000_000,
      financiamento: financiamentoPrice,
    });
    const c = plano.cronograma;

    expect(c[0]).toEqual({ tipo: "ato", mesRelativo: 0, valor: 1_000_000 });
    // Ordenação global por mês:
    for (let i = 1; i < c.length; i++) {
      expect(c[i]!.mesRelativo).toBeGreaterThanOrEqual(c[i - 1]!.mesRelativo);
    }
    // 1 ato + 24 parcelas + 4 balões + financiamento + chaves = 31 itens.
    expect(c).toHaveLength(31);
    expect(c.filter((i) => i.tipo === "parcela")).toHaveLength(24);
    expect(c.filter((i) => i.tipo === "balao").map((i) => i.mesRelativo)).toEqual([
      6, 12, 18, 24,
    ]);
    // Mês 24 (chaves): parcela → balão → financiamento → chaves, nessa ordem.
    expect(c.slice(-4).map((i) => i.tipo)).toEqual([
      "parcela",
      "balao",
      "financiamento",
      "chaves",
    ]);
    expect(c.at(-2)).toEqual({
      tipo: "financiamento",
      mesRelativo: 24,
      valor: plano.valorFinanciado,
    });
    expect(c.at(-1)).toEqual({ tipo: "chaves", mesRelativo: 24, valor: 0 });
  });
});

describe("recalcularPlano — invariante da soma em vários esquemas", () => {
  it("esquema com parcelas e balões de VALOR FIXO", () => {
    const esquema = esquemaPagamentoSchema.parse({
      id: ID_A,
      orgId: ID_ORG,
      imovelId: ID_B,
      modalidade: "mcmv",
      percentualMinimoAto: 0.1,
      numeroParcelasMensais: 30,
      parcelaMensal: { valor: 150_000 }, // R$ 1.500
      baloes: [{ periodicidadeMeses: 12, valor: 800_000 }], // meses 12 e 24
    });
    const plano = planoOk({
      valorImovel: VALOR_IMOVEL,
      esquema,
      entradaEscolhida: 3_200_000,
      financiamento: financiamentoPrice,
    });
    // 32M − 3,2M − 30×150k (4,5M) − 2×800k (1,6M) = 22_700_000
    expect(plano.valorFinanciado).toBe(22_700_000);
    expect(somaCronograma(plano)).toBe(VALOR_IMOVEL);
  });

  it("esquema percentual SEM balões", () => {
    const esquema = esquemaPagamentoSchema.parse({
      id: ID_A,
      orgId: ID_ORG,
      imovelId: ID_B,
      modalidade: "mcmv",
      percentualMinimoAto: 0.05,
      numeroParcelasMensais: 18,
      parcelaMensal: { percentual: 0.01 },
      baloes: [],
    });
    const plano = planoOk({
      valorImovel: VALOR_IMOVEL,
      esquema,
      entradaEscolhida: 1_600_000,
      financiamento: financiamentoPrice,
    });
    // 32M − 1,6M − 18×320k (5,76M) = 24_640_000
    expect(plano.valorFinanciado).toBe(24_640_000);
    expect(plano.resumo.totalBaloes).toBe(0);
    expect(somaCronograma(plano)).toBe(VALOR_IMOVEL);
  });

  it("esquema SEM parcelas nem balões (só ato + financiamento)", () => {
    const esquema = esquemaPagamentoSchema.parse({
      id: ID_A,
      orgId: ID_ORG,
      imovelId: ID_B,
      modalidade: "mcmv",
      percentualMinimoAto: 0.1,
      numeroParcelasMensais: 0,
      baloes: [],
    });
    const plano = planoOk({
      valorImovel: VALOR_IMOVEL,
      esquema,
      entradaEscolhida: 3_200_000,
      financiamento: financiamentoPrice,
    });
    expect(plano.valorFinanciado).toBe(28_800_000);
    expect(somaCronograma(plano)).toBe(VALOR_IMOVEL);
    expect(plano.cronograma.map((i) => i.tipo)).toEqual(["ato", "financiamento", "chaves"]);
  });

  it("SAC: parcela estimada é a primeira (maior) e invariante se mantém", () => {
    const plano = planoOk({
      valorImovel: VALOR_IMOVEL,
      esquema: esquemaEscopo,
      entradaEscolhida: 2_000_000,
      financiamento: { taxaAnual: 0.105, prazoMeses: 360, sistema: "sac" },
    });
    expect(somaCronograma(plano)).toBe(VALOR_IMOVEL);
    expect(plano.financiamentoPosChaves.parcelaEstimada).toBeGreaterThan(
      plano.financiamentoPosChaves.ultimaParcela,
    );
  });
});

describe("recalcularPlano — sobras de arredondamento na última ocorrência", () => {
  it("distribui a sobra do percentual na última parcela e no último balão", () => {
    // valorImovel escolhido para gerar fração de centavo por parcela:
    // parcela exata = 10_000_333 · 0,0001 = 1000,0333 → 1000 por parcela;
    // alvo da série = round(1000,0333 · 30) = 30_001 → última = 1_001.
    // balão exato = 10_000_333 · 0,01 = 100_003,33 → 100_003 (mês 12);
    // alvo = round(200_006,66) = 200_007 → última (mês 24) = 100_004.
    const esquema = esquemaPagamentoSchema.parse({
      id: ID_A,
      orgId: ID_ORG,
      imovelId: ID_B,
      modalidade: "mcmv",
      percentualMinimoAto: 0.1,
      numeroParcelasMensais: 30,
      parcelaMensal: { percentual: 0.0001 },
      baloes: [{ periodicidadeMeses: 12, percentual: 0.01 }],
    });
    const valorImovel = 10_000_333;
    const entrada = 1_000_033; // = round(10_000_333 · 0,1), o mínimo exato
    const plano = planoOk({
      valorImovel,
      esquema,
      entradaEscolhida: entrada,
      financiamento: financiamentoPrice,
    });

    const parcelas = plano.cronograma.filter((i) => i.tipo === "parcela");
    expect(parcelas.slice(0, 29).every((p) => p.valor === 1_000)).toBe(true);
    expect(parcelas.at(-1)!.valor).toBe(1_001);
    expect(plano.resumo.totalParcelas).toBe(30_001);

    const baloes = plano.cronograma.filter((i) => i.tipo === "balao");
    expect(baloes.map((b) => b.valor)).toEqual([100_003, 100_004]);
    expect(plano.resumo.totalBaloes).toBe(200_007);

    // Centavo a centavo: 1_000_033 + 30_001 + 200_007 + financiado = 10_000_333.
    expect(plano.valorFinanciado).toBe(8_770_292);
    expect(somaCronograma(plano)).toBe(valorImovel);
  });
});

describe("recalcularPlano — erros tipados (Result, sem throw genérico)", () => {
  it("entrada abaixo do mínimo do esquema → erro com o mínimo permitido", () => {
    const esquema = esquemaPagamentoSchema.parse({
      id: ID_A,
      orgId: ID_ORG,
      imovelId: ID_B,
      modalidade: "mcmv",
      percentualMinimoAto: 0.05, // mínimo = 1_600_000 (R$ 16.000)
      numeroParcelasMensais: 24,
      parcelaMensal: { percentual: 0.005 },
      baloes: [],
    });
    const resultado = recalcularPlano({
      valorImovel: VALOR_IMOVEL,
      esquema,
      entradaEscolhida: 1_000_000, // R$ 10.000 < mínimo
      financiamento: financiamentoPrice,
    });

    expect(resultado.ok).toBe(false);
    if (resultado.ok) throw new Error("esperava erro");
    expect(resultado.erro).toEqual({
      tipo: "entrada_abaixo_do_minimo",
      entradaEscolhida: 1_000_000,
      entradaMinima: 1_600_000,
      percentualMinimoAto: 0.05,
    });
  });

  it("entrada exatamente no mínimo é aceita (limite inclusivo)", () => {
    const resultado = recalcularPlano({
      valorImovel: VALOR_IMOVEL,
      esquema: esquemaEscopo, // mínimo 3% = 960_000
      entradaEscolhida: 960_000,
      financiamento: financiamentoPrice,
    });
    expect(resultado.ok).toBe(true);
  });

  it("ato + parcelas + balões acima do valor do imóvel → erro com excedente", () => {
    const esquema = esquemaPagamentoSchema.parse({
      id: ID_A,
      orgId: ID_ORG,
      imovelId: ID_B,
      modalidade: "mcmv",
      percentualMinimoAto: 0.1,
      numeroParcelasMensais: 12,
      parcelaMensal: { valor: 20_000 },
      baloes: [],
    });
    const resultado = recalcularPlano({
      valorImovel: 1_000_000,
      esquema,
      entradaEscolhida: 900_000, // 900k + 12×20k = 1_140_000 > 1_000_000
      financiamento: financiamentoPrice,
    });

    expect(resultado.ok).toBe(false);
    if (resultado.ok) throw new Error("esperava erro");
    expect(resultado.erro).toEqual({
      tipo: "plano_excede_valor_imovel",
      totalAteChaves: 1_140_000,
      valorImovel: 1_000_000,
      excedente: 140_000,
    });
  });

  it("input estrutural inválido (não é regra de negócio) lança RangeError", () => {
    expect(() =>
      recalcularPlano({
        valorImovel: 1_000_000.5,
        esquema: esquemaEscopo,
        entradaEscolhida: 100_000,
        financiamento: financiamentoPrice,
      }),
    ).toThrow(RangeError);
  });

  it("esquema com periodicidade de balão inválida lança RangeError (sem loop infinito)", () => {
    // O schema zod do domínio proíbe estes valores, mas o core não pode confiar
    // que todo chamador passou pelo zod: periodicidade <= 0 travaria mesesDoBalao
    // em loop infinito; fracionária geraria mesRelativo não inteiro.
    for (const periodicidadeMeses of [0, -6, 2.5, Number.NaN]) {
      const balaoInvalido = { periodicidadeMeses, percentual: 0.05 } as Balao;
      expect(() =>
        recalcularPlano({
          valorImovel: VALOR_IMOVEL,
          esquema: { ...esquemaEscopo, baloes: [balaoInvalido] },
          entradaEscolhida: 1_000_000,
          financiamento: financiamentoPrice,
        }),
      ).toThrow(RangeError);
    }
  });

  it("numeroParcelasMensais inválido lança RangeError", () => {
    for (const numeroParcelasMensais of [-1, 1.5, Number.NaN]) {
      expect(() =>
        recalcularPlano({
          valorImovel: VALOR_IMOVEL,
          esquema: { ...esquemaEscopo, numeroParcelasMensais },
          entradaEscolhida: 1_000_000,
          financiamento: financiamentoPrice,
        }),
      ).toThrow(RangeError);
    }
  });
});

describe("recalcularPlano — round-trip com o schema do domínio (Simulacao.resultado)", () => {
  it("o plano recalculado valida em planoPagamentoRecalculadoSchema", () => {
    // Garante que o snapshot Simulacao consegue persistir o resultado REAL do
    // motor (incluindo financiamentoPosChaves) — H-02/H-11/H-12.
    const plano = planoOk({
      valorImovel: VALOR_IMOVEL,
      esquema: esquemaEscopo,
      entradaEscolhida: 2_000_000,
      financiamento: financiamentoPrice,
    });
    const parsed = planoPagamentoRecalculadoSchema.safeParse(plano);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.financiamentoPosChaves.parcelaEstimada).toBe(
        plano.financiamentoPosChaves.parcelaEstimada,
      );
    }
  });
});
