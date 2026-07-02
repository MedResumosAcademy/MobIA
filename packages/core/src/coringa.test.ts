import { describe, expect, it } from "vitest";
import type {
  CenarioCoringa,
  ImovelCoringa,
  ParametrosFinanceiros,
} from "@imobia/domain";
import { calcularCenario, gerarEstrategias } from "./coringa";
import { PARAMETROS_2026_07 } from "./parametros";

// Valores em CENTAVOS. Ex.: R$ 6.500,00 → 650_000.
//
// A taxa efetiva anual dos snapshots é convertida da NOMINAL das fontes
// ((1+n/12)^12−1), então a mensal usada nas contas é exatamente nominal/12
// (ex.: MCMV faixa 3, nominal 8,16% a.a. → 0,68% a.m.).

/** Cenário do escopo (ESCOPO.md §5.4): renda 6.500, FGTS 22.000, entrada 15.000. */
const cenarioEscopo: CenarioCoringa = {
  rendaMensal: 650_000,
  fgts: 2_200_000,
  entradaPropria: 1_500_000,
  idadeMeses: 360, // 30 anos
};

/** Imóvel do escopo: R$ 390.000. Renda 6.500 → MCMV faixa 3 (teto R$ 400 mil). */
const imovelEscopo: ImovelCoringa = {
  valorImovel: 39_000_000,
  modalidadesElegiveis: ["mcmv"],
};

describe("gerarEstrategias — cenário do escopo (renda 6.500, FGTS 22.000, entrada 15.000, imóvel 390.000)", () => {
  const r = gerarEstrategias(cenarioEscopo, imovelEscopo, PARAMETROS_2026_07);

  it("baseline: MCMV, entrada própria sem FGTS, prazo 420, financiado 375.000", () => {
    expect(r.baseline.modalidade).toBe("mcmv");
    expect(r.baseline.usouFgts).toBe(false);
    expect(r.baseline.entradaTotal).toBe(1_500_000);
    expect(r.baseline.prazoMeses).toBe(420); // min(966−360, 420)
    expect(r.baseline.valorFinanciado).toBe(37_500_000); // 390.000 − 15.000
  });

  it("baseline é INVIÁVEL (entrada abaixo do LTV 80% e parcela acima de 30%)", () => {
    // financiado 375.000 > 0,8·390.000 = 312.000 ⇒ estoura LTV.
    // parcela ≈ R$ 3.442,86 > teto R$ 1.950 (30% de 6.500) ⇒ estoura comprometimento.
    expect(r.baseline.parcelaEstimada).toBe(344_286);
    expect(r.baseline.viavel).toBe(false);
  });

  it("gera estratégia de FGTS que REDUZ a parcela (SAC, 1ª parcela)", () => {
    const fgts = r.estrategias.find((e) => e.tipo === "fgts_entrada");
    expect(fgts).toBeDefined();
    // entrada 15.000 + FGTS 22.000 = 37.000 ⇒ financiado 353.000.
    expect(fgts!.impacto.parcelaAntes).toBe(344_286);
    expect(fgts!.impacto.parcelaDepois).toBe(324_088);
    expect(fgts!.impacto.deltaParcela).toBeLessThan(0);
  });

  it("gera estratégias de aumentar entrada e ajustar prazo que VIABILIZAM", () => {
    const aporte = r.estrategias.find((e) => e.tipo === "aumentar_entrada");
    const prazo = r.estrategias.find((e) => e.tipo === "ajustar_prazo");
    expect(aporte).toBeDefined();
    expect(aporte!.viabilizou).toBe(true);
    expect(aporte!.impacto.parcelaDepois).toBeLessThanOrEqual(195_000); // ≤ teto 30%
    // Só a extensão de prazo não basta (parcela ainda > teto): não viabiliza sozinha,
    // logo NÃO deve aparecer se o baseline segue inviável no prazo máximo já usado.
    if (prazo !== undefined) {
      expect(prazo.viabilizou).toBe(true);
    }
  });

  it("ranking: estratégias viabilizadoras ficam no topo (ganho desc)", () => {
    const ganhos = r.estrategias.map((e) => e.ganho);
    for (let i = 1; i < ganhos.length; i++) {
      expect(ganhos[i - 1]!).toBeGreaterThanOrEqual(ganhos[i]!);
    }
    if (r.estrategias.some((e) => e.viabilizou)) {
      expect(r.estrategias[0]!.viabilizou).toBe(true);
    }
  });

  it("nenhuma estratégia é neutra (delta 0 em ambos) ou pior", () => {
    for (const e of r.estrategias) {
      const melhoraParcela = e.impacto.deltaParcela < 0;
      const melhoraTotal = e.impacto.deltaTotal < 0;
      expect(e.viabilizou || melhoraParcela || melhoraTotal).toBe(true);
    }
    expect(r.ehEstimativa).toBe(true);
  });
});

describe("gerarEstrategias — alavanca FGTS condicional", () => {
  it("sem FGTS → nenhuma estratégia de FGTS", () => {
    const semFgts: CenarioCoringa = { ...cenarioEscopo, fgts: 0 };
    const r = gerarEstrategias(semFgts, imovelEscopo, PARAMETROS_2026_07);
    expect(r.estrategias.some((e) => e.tipo === "fgts_entrada")).toBe(false);
  });

  it("FGTS sempre reduz a parcela vs. baseline sem FGTS (mesma modalidade)", () => {
    const r = gerarEstrategias(cenarioEscopo, imovelEscopo, PARAMETROS_2026_07);
    const fgts = r.estrategias.find((e) => e.tipo === "fgts_entrada");
    expect(fgts).toBeDefined();
    expect(fgts!.impacto.parcelaDepois).toBeLessThan(fgts!.impacto.parcelaAntes);
  });
});

describe("gerarEstrategias — troca de modalidade", () => {
  it("1 modalidade elegível → nenhuma estratégia de troca de modalidade", () => {
    const r = gerarEstrategias(cenarioEscopo, imovelEscopo, PARAMETROS_2026_07);
    expect(r.estrategias.some((e) => e.tipo === "trocar_modalidade")).toBe(false);
  });

  it("com modalidade alternativa mais barata (MCMV vs SBPE), sugere a de menor parcela", () => {
    // MCMV (faixa 3, ~8,16%) é mais barato que SBPE (~11,19%). Baseline = a 1ª da
    // lista; oferecendo SBPE primeiro, MCMV deve ser sugerido como troca melhor.
    const imovel: ImovelCoringa = {
      valorImovel: 30_000_000, // dentro do teto MCMV faixa 3 (400k) e SBPE (sem teto)
      modalidadesElegiveis: ["sbpe", "mcmv"],
    };
    // Cenário com entrada suficiente para viabilizar (foco no delta de modalidade).
    const cenario: CenarioCoringa = {
      rendaMensal: 2_500_000,
      fgts: 0,
      entradaPropria: 9_000_000, // 30% de entrada
      idadeMeses: 360,
    };
    const r = gerarEstrategias(cenario, imovel, PARAMETROS_2026_07);
    expect(r.baseline.modalidade).toBe("sbpe");
    const troca = r.estrategias.find((e) => e.tipo === "trocar_modalidade");
    expect(troca).toBeDefined();
    expect(troca!.impacto.parcelaDepois).toBeLessThan(troca!.impacto.parcelaAntes);
  });
});

describe("gerarEstrategias — troca de unidade", () => {
  it("sugere a unidade mais barata que reduz a parcela", () => {
    const cenario: CenarioCoringa = {
      rendaMensal: 2_500_000,
      fgts: 0,
      entradaPropria: 9_000_000,
      idadeMeses: 360,
    };
    const imovel: ImovelCoringa = {
      valorImovel: 30_000_000,
      modalidadesElegiveis: ["sbpe"],
      unidadeAtualId: "u905",
      unidades: [
        { id: "u905", identificador: "905", valor: 30_000_000 },
        { id: "u705", identificador: "705", valor: 26_000_000 },
      ],
    };
    const r = gerarEstrategias(cenario, imovel, PARAMETROS_2026_07);
    const troca = r.estrategias.find((e) => e.tipo === "trocar_unidade");
    expect(troca).toBeDefined();
    expect(troca!.descricao).toContain("905");
    expect(troca!.descricao).toContain("705");
    expect(troca!.impacto.parcelaDepois).toBeLessThan(troca!.impacto.parcelaAntes);
  });
});

describe("gerarEstrategias — viabilização de baseline inviável", () => {
  // Renda baixa + entrada insuficiente ⇒ baseline inviável; aumentar_entrada resolve.
  const cenario: CenarioCoringa = {
    rendaMensal: 500_000,
    fgts: 0,
    entradaPropria: 1_000_000,
    idadeMeses: 360,
  };
  const imovel: ImovelCoringa = {
    valorImovel: 20_000_000,
    modalidadesElegiveis: ["mcmv"],
  };
  const r = gerarEstrategias(cenario, imovel, PARAMETROS_2026_07);

  it("baseline inviável", () => {
    expect(r.baseline.viavel).toBe(false);
  });

  it("existe ao menos uma estratégia que viabiliza (entrada ou prazo)", () => {
    const viabilizadoras = r.estrategias.filter((e) => e.viabilizou);
    expect(viabilizadoras.length).toBeGreaterThan(0);
  });

  it("ranking coloca uma viabilizadora no topo", () => {
    expect(r.estrategias[0]!.viabilizou).toBe(true);
  });
});

describe("calcularCenario — monotonicidade e invariantes", () => {
  const rendaTotal = 650_000;
  const parcelaMax = 195_000;
  const ctx = {
    cenario: cenarioEscopo,
    rendaTotal,
    parcelaMax,
    parametros: PARAMETROS_2026_07 as ParametrosFinanceiros,
  };

  it("mais entrada ⇒ parcela menor ou igual (financiado menor)", () => {
    const menos = calcularCenario(1_500_000, 39_000_000, "mcmv", false, ctx);
    const mais = calcularCenario(5_000_000, 39_000_000, "mcmv", false, ctx);
    expect(mais.parcelaEstimada).toBeLessThanOrEqual(menos.parcelaEstimada);
    expect(mais.valorFinanciado).toBeLessThan(menos.valorFinanciado);
  });

  it("entrada = valor ⇒ financiado 0, parcela 0, total = entrada, viável", () => {
    const c = calcularCenario(39_000_000, 39_000_000, "mcmv", false, ctx);
    expect(c.valorFinanciado).toBe(0);
    expect(c.parcelaEstimada).toBe(0);
    expect(c.totalPago).toBe(39_000_000);
    expect(c.viavel).toBe(true);
  });

  it("comprometimentoPct = parcela / renda total", () => {
    const c = calcularCenario(8_000_000, 39_000_000, "mcmv", false, ctx);
    expect(c.comprometimentoPct).toBeCloseTo(c.parcelaEstimada / rendaTotal, 10);
  });

  it("totalPago SAC = entrada + soma real das parcelas (≥ entrada + parcela×prazo? não: decrescente)", () => {
    const c = calcularCenario(8_000_000, 39_000_000, "mcmv", false, ctx);
    // SAC: parcelas decrescem, então soma < primeira×prazo.
    expect(c.totalPago - c.entradaTotal).toBeLessThan(c.parcelaEstimada * c.prazoMeses);
    expect(c.totalPago).toBeGreaterThan(c.entradaTotal);
  });
});

describe("gerarEstrategias — validações", () => {
  it("rejeita imóvel sem modalidades elegíveis", () => {
    expect(() =>
      gerarEstrategias(cenarioEscopo, { valorImovel: 10_000_000, modalidadesElegiveis: [] }, PARAMETROS_2026_07),
    ).toThrow(RangeError);
  });

  it("rejeita valores negativos", () => {
    expect(() =>
      gerarEstrategias({ ...cenarioEscopo, fgts: -1 }, imovelEscopo, PARAMETROS_2026_07),
    ).toThrow(RangeError);
  });
});
