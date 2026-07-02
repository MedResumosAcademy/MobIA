import { describe, expect, it } from "vitest";
import {
  AVISO_ESTIMATIVA,
  cronogramaSAC,
  parcelaMaximaPorRenda,
  parcelaPrice,
  prazoMaximoPorIdadeMeses,
  taxaAnualEfetivaDeNominal,
  taxaMensalDeAnual,
  valorFinanciavelMaxPrice,
  valorFinanciavelMaxSAC,
} from "./financiamento";

// Valores em CENTAVOS. Ex.: R$ 100.000,00 → 10_000_000.

describe("taxaMensalDeAnual", () => {
  it("converte 12,682503...% a.a. em exatamente 1% a.m. (efetiva)", () => {
    // (1.01)^12 - 1 = 0.12682503013196977 — verificado à mão.
    expect(taxaMensalDeAnual(0.12682503013196977)).toBeCloseTo(0.01, 12);
  });

  it("é a inversa da capitalização composta em 12 meses (10,5% a.a.)", () => {
    const mensal = taxaMensalDeAnual(0.105);
    expect(Math.pow(1 + mensal, 12)).toBeCloseTo(1.105, 12);
    // Efetiva é menor que a proporcional simples (0.105 / 12 = 0.00875).
    expect(mensal).toBeGreaterThan(0);
    expect(mensal).toBeLessThan(0.105 / 12);
  });

  it("taxa zero permanece zero", () => {
    expect(taxaMensalDeAnual(0)).toBe(0);
  });

  it("rejeita taxa negativa", () => {
    expect(() => taxaMensalDeAnual(-0.01)).toThrow(RangeError);
  });
});

describe("taxaAnualEfetivaDeNominal — semântica de taxa das fontes Caixa/MCMV", () => {
  it("nominal 11,19% a.a. (balcão Caixa) → efetiva 11,7821...% a.a.", () => {
    // (1 + 0.1119/12)^12 − 1 = 0.117821260004... — verificado à mão.
    expect(taxaAnualEfetivaDeNominal(0.1119)).toBeCloseTo(0.11782126000413706, 12);
  });

  it("trava a semântica: mensal derivada = nominal/12 (como no simulador Caixa)", () => {
    // Pipeline completo (snapshot → motor): nominal 11,19% a.a. deve virar
    // exatamente 0,9325% a.m., a mensal usada pela planilha/simulador Caixa.
    for (const nominal of [0.0425, 0.07, 0.0816, 0.1, 0.1119]) {
      expect(taxaMensalDeAnual(taxaAnualEfetivaDeNominal(nominal))).toBeCloseTo(nominal / 12, 12);
    }
  });

  it("valor conhecido: R$ 400.000 em 420 meses a 11,19% nominal — SAC e Price", () => {
    // Referência da revisão (mensal = 0.1119/12 = 0.009325):
    //   1ª parcela SAC = 40_000_000/420 + 40_000_000×0.009325 = 468_238,10 → R$ 4.682,38
    //   Price = 40_000_000×i/(1−(1+i)^−420) = 380_719,04 → R$ 3.807,19
    const mensal = taxaMensalDeAnual(taxaAnualEfetivaDeNominal(0.1119));
    expect(cronogramaSAC(40_000_000, mensal, 420).primeiraParcela).toBe(468_238);
    expect(parcelaPrice(40_000_000, mensal, 420)).toBe(380_719);
  });

  it("taxa zero permanece zero e negativa é rejeitada", () => {
    expect(taxaAnualEfetivaDeNominal(0)).toBe(0);
    expect(() => taxaAnualEfetivaDeNominal(-0.01)).toThrow(RangeError);
  });
});

describe("parcelaPrice", () => {
  it("caso clássico verificado à mão: R$ 100.000, 1% a.m., 360 meses → R$ 1.028,61", () => {
    // PMT = 10_000_000 × 0.01 / (1 - 1.01^-360) = 102_861.26 → 102_861 centavos.
    expect(parcelaPrice(10_000_000, 0.01, 360)).toBe(102_861);
  });

  it("taxa zero → divisão simples", () => {
    // R$ 1.200,00 em 12 meses → R$ 100,00.
    expect(parcelaPrice(120_000, 0, 12)).toBe(10_000);
  });

  it("prazo 1 → parcela única de valor + juros de um mês", () => {
    // 1_000_000 × 1.01 = 1_010_000.
    expect(parcelaPrice(1_000_000, 0.01, 1)).toBe(1_010_000);
  });

  it("valor financiado zero → parcela zero", () => {
    expect(parcelaPrice(0, 0.01, 360)).toBe(0);
  });

  it("rejeita prazo inválido e valor negativo", () => {
    expect(() => parcelaPrice(1_000_000, 0.01, 0)).toThrow(RangeError);
    expect(() => parcelaPrice(1_000_000, 0.01, 1.5)).toThrow(RangeError);
    expect(() => parcelaPrice(-1, 0.01, 12)).toThrow(RangeError);
  });
});

describe("cronogramaSAC", () => {
  it("caso verificado à mão: R$ 1.200, 1% a.m., 12 meses", () => {
    // Amortização = 120_000/12 = 10_000. Primeira = 10_000 + 120_000×0.01 = 11_200.
    // Última = 10_000 + 10_000×0.01 = 10_100. Decresce 100 centavos/mês.
    const c = cronogramaSAC(120_000, 0.01, 12);
    expect(c.primeiraParcela).toBe(11_200);
    expect(c.ultimaParcela).toBe(10_100);
    expect(c.parcelas).toHaveLength(12);
    expect(c.parcelas[0]).toBe(11_200);
    expect(c.parcelas[1]).toBe(11_100);
    expect(c.parcelas[11]).toBe(10_100);
    // Total pago = principal 120_000 + juros 7_800 (soma dos saldos × 1%).
    const total = c.parcelas.reduce((s, p) => s + p, 0);
    expect(total).toBe(127_800);
  });

  it("primeira parcela é estritamente maior que a última quando há juros", () => {
    const c = cronogramaSAC(10_000_000, 0.008, 360);
    expect(c.primeiraParcela).toBeGreaterThan(c.ultimaParcela);
    // Parcelas monotonicamente não crescentes.
    for (let i = 1; i < c.parcelas.length; i++) {
      expect(c.parcelas[i]!).toBeLessThanOrEqual(c.parcelas[i - 1]!);
    }
  });

  it("taxa zero → todas as parcelas iguais à amortização", () => {
    const c = cronogramaSAC(120_000, 0, 12);
    expect(c.primeiraParcela).toBe(10_000);
    expect(c.ultimaParcela).toBe(10_000);
    expect(c.parcelas.every((p) => p === 10_000)).toBe(true);
  });

  it("prazo 1 → parcela única (primeira = última) com juros de um mês", () => {
    const c = cronogramaSAC(1_000_000, 0.01, 1);
    expect(c.parcelas).toHaveLength(1);
    expect(c.primeiraParcela).toBe(1_010_000);
    expect(c.ultimaParcela).toBe(1_010_000);
  });

  it("marca o resultado como estimativa (não proposta formal)", () => {
    expect(cronogramaSAC(120_000, 0.01, 12).estimativa).toBe(true);
    expect(AVISO_ESTIMATIVA.length).toBeGreaterThan(0);
  });

  it("rejeita prazo inválido", () => {
    expect(() => cronogramaSAC(120_000, 0.01, 0)).toThrow(RangeError);
  });
});

describe("prazoMaximoPorIdadeMeses", () => {
  // Regra Caixa parametrizada: idade + prazo ≤ 80a6m → idadeMax = 966 meses.
  const IDADE_MAX = 966;

  it("30 anos (360 meses) → 606 meses disponíveis", () => {
    expect(prazoMaximoPorIdadeMeses(360, IDADE_MAX)).toBe(606);
  });

  it("idade exatamente no limite → prazo 0", () => {
    expect(prazoMaximoPorIdadeMeses(966, IDADE_MAX)).toBe(0);
  });

  it("idade acima do limite → nunca negativo", () => {
    expect(prazoMaximoPorIdadeMeses(1_000, IDADE_MAX)).toBe(0);
  });

  it("respeita o prazo máximo da modalidade via min()", () => {
    // Idade permite 606, mas modalidade limita a 420.
    expect(prazoMaximoPorIdadeMeses(360, IDADE_MAX, 420)).toBe(420);
    // Modalidade permite mais do que a idade → vale a idade.
    expect(prazoMaximoPorIdadeMeses(900, IDADE_MAX, 420)).toBe(66);
  });

  it("prazo da modalidade zero → 0", () => {
    expect(prazoMaximoPorIdadeMeses(360, IDADE_MAX, 0)).toBe(0);
  });
});

describe("parcelaMaximaPorRenda", () => {
  it("renda R$ 6.500 com 30% → parcela máx. R$ 1.950", () => {
    expect(parcelaMaximaPorRenda(650_000, 0.3)).toBe(195_000);
  });

  it("arredonda para o centavo mais próximo", () => {
    // 333_333 × 0.3 = 99_999.9 → 100_000.
    expect(parcelaMaximaPorRenda(333_333, 0.3)).toBe(100_000);
  });

  it("comprometimento zero → parcela zero", () => {
    expect(parcelaMaximaPorRenda(650_000, 0)).toBe(0);
  });
});

describe("valorFinanciavelMaxPrice", () => {
  it("valor presente de anuidade verificado à mão: R$ 1.000/mês, 1% a.m., 12 meses", () => {
    // Fator = (1 - 1.01^-12)/0.01 = 11.2550775 → 100_000 × fator = 1_125_507.7 → 1_125_508.
    expect(valorFinanciavelMaxPrice(100_000, 0.01, 12)).toBe(1_125_508);
  });

  it("taxa zero → parcela × prazo", () => {
    expect(valorFinanciavelMaxPrice(10_000, 0, 12)).toBe(120_000);
  });

  it("prazo 1 → valor presente de uma parcela", () => {
    // 1_010_000 / 1.01 = 1_000_000.
    expect(valorFinanciavelMaxPrice(1_010_000, 0.01, 1)).toBe(1_000_000);
  });

  it("round-trip: parcelaPrice(inversa(P)) reproduz P com tolerância de 1 centavo", () => {
    const casos: Array<[Centavos: number, i: number, n: number]> = [
      [102_861, 0.01, 360],
      [195_000, 0.007, 420],
      [55_500, 0.0083551, 240],
      [10_000, 0, 12],
    ];
    for (const [parcelaMax, i, n] of casos) {
      const vf = valorFinanciavelMaxPrice(parcelaMax, i, n);
      expect(Math.abs(parcelaPrice(vf, i, n) - parcelaMax)).toBeLessThanOrEqual(1);
    }
  });

  it("round-trip: inversa(parcelaPrice(VF)) reproduz VF dentro do fator de anuidade", () => {
    // Arredondar o PMT a ±0,5 centavo propaga até ±(fator de anuidade) centavos no VF.
    const vf = 10_000_000;
    const pmt = parcelaPrice(vf, 0.01, 360); // 102_861
    const vfDeVolta = valorFinanciavelMaxPrice(pmt, 0.01, 360);
    expect(Math.abs(vfDeVolta - vf)).toBeLessThanOrEqual(100);
  });
});

describe("valorFinanciavelMaxSAC", () => {
  it("inversa exata da primeira parcela: 11_200/(1/12 + 0.01) = 120_000", () => {
    expect(valorFinanciavelMaxSAC(11_200, 0.01, 12)).toBe(120_000);
  });

  it("taxa zero → parcela × prazo", () => {
    expect(valorFinanciavelMaxSAC(10_000, 0, 12)).toBe(120_000);
  });

  it("round-trip: primeira parcela do SAC sobre a inversa reproduz o teto (±1 centavo)", () => {
    const casos: Array<[parcelaMax: number, i: number, n: number]> = [
      [195_000, 0.008, 360],
      [11_200, 0.01, 12],
      [123_456, 0.0083551, 420],
      [10_000, 0, 12],
      [1_010_000, 0.01, 1],
    ];
    for (const [parcelaMax, i, n] of casos) {
      const vf = valorFinanciavelMaxSAC(parcelaMax, i, n);
      const c = cronogramaSAC(vf, i, n);
      expect(Math.abs(c.primeiraParcela - parcelaMax)).toBeLessThanOrEqual(1);
    }
  });

  it("primeira parcela do SAC nunca excede o teto além do arredondamento", () => {
    const vf = valorFinanciavelMaxSAC(195_000, 0.008, 360);
    const c = cronogramaSAC(vf, 0.008, 360);
    expect(c.primeiraParcela).toBeLessThanOrEqual(195_000 + 1);
    expect(c.ultimaParcela).toBeLessThan(c.primeiraParcela);
  });
});
