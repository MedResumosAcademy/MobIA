import { describe, expect, it } from "vitest";
import type { Modalidade } from "@imobia/domain";
import { MODALIDADES } from "@imobia/domain";
import {
  calcularCapacidade,
  idadeEmMeses,
  type CapacidadeModalidade,
  type PerfilSonhometro,
} from "./sonhometro";
import { PARAMETROS_2026_07 } from "./parametros";

// Valores em CENTAVOS. Ex.: R$ 6.500,00 → 650_000.
//
// Taxas: os snapshots guardam taxa EFETIVA anual convertida da NOMINAL das
// fontes ((1+n/12)^12−1), então a mensal usada nas contas abaixo é exatamente
// nominal/12 (ex.: faixa 3 MCMV, nominal 8,16% a.a. → 0,68% a.m.).

function porModalidade(
  resultado: CapacidadeModalidade[],
): Record<Modalidade, CapacidadeModalidade> {
  return Object.fromEntries(resultado.map((r) => [r.modalidade, r])) as Record<
    Modalidade,
    CapacidadeModalidade
  >;
}

/** Perfil do escopo (ESCOPO.md §5.4): renda R$ 6.500, FGTS R$ 22.000; 30 anos. */
const perfilEscopo: PerfilSonhometro = {
  rendaMensal: 650_000,
  fgts: 2_200_000,
  idadeMeses: 360, // 30 anos
  estadoCivil: "solteiro",
  dependentes: 0,
  cidadeUF: "Fortaleza-CE",
};

describe("calcularCapacidade — perfil do escopo (renda R$ 6.500, FGTS R$ 22.000)", () => {
  const r = calcularCapacidade(perfilEscopo, PARAMETROS_2026_07);

  it("valor máximo estável e coerente: R$ 110.000, limitado pelo LTV", () => {
    // Verificação à mão (parâmetros 2026-07, MCMV faixa 3, SAC):
    //   parcelaMax = 650_000 × 0,30 = 195_000 (R$ 1.950)
    //   prazo = min(966 − 360, 420) = 420 meses
    //   i = 0,0816/12 = 0,0068 a.m. (nominal da fonte / 12)
    //   financiávelMax(SAC) = 195_000 / (1/420 + i) = 21_239_627
    //   capacidadeBruta = 21_239_627 + 2_200_000 = 23_439_627
    //   teto por LTV = (E+S)/(1−0,8) = 2_200_000 / 0,2 = 11_000_000 ← LIMITA
    //   valorMaximoImovel = min(23_439_627; 11_000_000; teto faixa 40_000_000)
    //                     = 11_000_000 (R$ 110.000,00)
    expect(r.valorMaximoImovel).toBe(11_000_000);
    expect(r.ehEstimativa).toBe(true);
  });

  it("melhor modalidade determinística (empate no LTV → primeira da ordem: mcmv)", () => {
    // Com FGTS de R$ 22.000 e LTV 0,8 em TODAS as modalidades, o teto por LTV
    // (R$ 110.000) é o gargalo comum → empate; vence a primeira da ordem.
    expect(r.melhorModalidade).toBe("mcmv");
    for (const cap of r.porModalidade) {
      expect(cap.elegivel).toBe(true);
      expect(cap.valorMaximoImovel).toBe(11_000_000);
    }
  });

  it("detalhamento coerente: parcelaMax, prazo, entrada e comprometimento", () => {
    expect(r.detalhamento.parcelaMax).toBe(195_000); // R$ 1.950 = 30% de R$ 6.500
    expect(r.detalhamento.prazoMax).toBe(606); // 966 − 360 (sem cap de modalidade)
    expect(r.detalhamento.entradaDisponivel).toBe(2_200_000); // mcmv permite FGTS
    expect(r.detalhamento.comprometimentoUsado).toBe(0.3);
  });

  it("cenário máximo MCMV: financiado = 80% do valor; parcela dentro do teto", () => {
    const mcmv = porModalidade(r.porModalidade).mcmv;
    // financiado = min(21_239_627; floor(0,8 × 11_000_000); 11_000_000) = 8_800_000
    // 1ª parcela SAC = 8_800_000/420 + 8_800_000 × 0,0068 = 80_792,38 → 80_792
    expect(mcmv.parcelaEstimada).toBe(80_792);
    expect(mcmv.parcelaEstimada).toBeLessThanOrEqual(r.detalhamento.parcelaMax);
    expect(mcmv.prazoMeses).toBe(420);
    expect(mcmv.subsidioEstimado).toBe(0); // renda R$ 6.500 → faixa 3, sem subsídio
    expect(mcmv.subsidioEhTeto).toBe(false);
    expect(mcmv.entradaNecessaria).toBe(2_200_000); // LTV exige exatamente o FGTS
  });

  it("cobre todas as modalidades do vocabulário, na ordem", () => {
    expect(r.porModalidade.map((c) => c.modalidade)).toEqual([...MODALIDADES]);
  });
});

describe("calcularCapacidade — idade avançada", () => {
  it("79 anos → prazo curtíssimo (18 meses) reduz a capacidade", () => {
    const r = calcularCapacidade(
      { ...perfilEscopo, idadeMeses: 948 }, // 79 anos
      PARAMETROS_2026_07,
    );
    const mcmv = porModalidade(r.porModalidade).mcmv;
    // prazo = min(966 − 948, 420) = 18 meses
    expect(mcmv.prazoMeses).toBe(18);
    // financiávelMax = 195_000 / (1/18 + 0,0068) = 3_127_227
    // capacidadeBruta = 3_127_227 + 2_200_000 = 5_327_227 < teto LTV (11_000_000)
    expect(r.valorMaximoImovel).toBe(5_327_227);
    // Bem menor que a capacidade do mesmo perfil aos 30 anos (11_000_000).
    expect(r.valorMaximoImovel).toBeLessThan(
      calcularCapacidade(perfilEscopo, PARAMETROS_2026_07).valorMaximoImovel,
    );
  });

  it("idade no limite (966 meses) → nenhuma modalidade elegível, capacidade 0", () => {
    const r = calcularCapacidade({ ...perfilEscopo, idadeMeses: 966 }, PARAMETROS_2026_07);
    expect(r.valorMaximoImovel).toBe(0);
    expect(r.melhorModalidade).toBeUndefined();
    for (const cap of r.porModalidade) {
      expect(cap.elegivel).toBe(false);
      expect(cap.motivo).toMatch(/idade/i);
    }
  });
});

describe("calcularCapacidade — subsídio MCMV (faixa 1)", () => {
  // Renda R$ 3.000 → faixa 1 2026 (até R$ 3.200): nominal 4,25% a.a., subsídio até R$ 55 mil.
  const perfilFaixa1: PerfilSonhometro = {
    ...perfilEscopo,
    rendaMensal: 300_000,
    fgts: 0,
  };
  const r = calcularCapacidade(perfilFaixa1, PARAMETROS_2026_07);
  const caps = porModalidade(r.porModalidade);

  it("recebe subsídio da faixa e ele compõe a capacidade", () => {
    // Verificação à mão (faixa 1, SAC, prazo 420):
    //   parcelaMax = 300_000 × 0,30 = 90_000
    //   i = 0,0425/12 ≈ 0,0035417 a.m.
    //   financiávelMax = 90_000 / (1/420 + i) = 15_195_980
    //   capacidadeBruta = 15_195_980 + 0 (FGTS) + 5_500_000 (subsídio) = 20_695_980
    //   teto LTV = (0 + 5_500_000)/0,2 = 27_500_000 (não limita);
    //   teto da FAIXA 1 = 27_500_000 (não limita)
    expect(caps.mcmv.subsidioEstimado).toBe(5_500_000);
    expect(caps.mcmv.valorMaximoImovel).toBe(20_695_980);
    expect(caps.mcmv.entradaNecessaria).toBe(0); // subsídio cobre a "entrada"
    expect(r.melhorModalidade).toBe("mcmv");
  });

  it("sinaliza que o subsídio usado é o TETO da faixa (valor real decresce com a renda)", () => {
    expect(caps.mcmv.subsidioEhTeto).toBe(true);
    expect(caps.sbpe.subsidioEhTeto).toBe(false); // SBPE não tem subsídio
  });

  it("sem entrada, modalidade SEM subsídio zera (LTV 0,8 exige recursos próprios)", () => {
    // SBPE não tem faixas/subsídio: E + S = 0 e LTV < 1 ⇒ V ≤ 0.
    expect(caps.sbpe.elegivel).toBe(true);
    expect(caps.sbpe.valorMaximoImovel).toBe(0);
  });
});

describe("calcularCapacidade — teto de valor por FAIXA (MCMV 2026)", () => {
  it("faixa 1 com FGTS alto → limitado ao teto da faixa (R$ 275 mil), não ao do programa", () => {
    // Renda R$ 3.000 (faixa 1), FGTS R$ 200.000:
    //   financiávelMax = 15_195_980; capacidadeBruta = 15_195_980 + 20_000_000
    //     + 5_500_000 = 40_695_980
    //   teto LTV = 25_500_000/0,2 = 127_500_000 (não limita)
    //   teto efetivo = min(teto FAIXA 1 = 27_500_000; teto programa 60_000_000)
    //     = 27_500_000 ← LIMITA
    const r = calcularCapacidade(
      { ...perfilEscopo, rendaMensal: 300_000, fgts: 20_000_000 },
      PARAMETROS_2026_07,
    );
    const mcmv = porModalidade(r.porModalidade).mcmv;
    expect(mcmv.valorMaximoImovel).toBe(27_500_000);
    // Entrada MÍNIMA: financiado = min(15_195_980; floor(0,8×27,5M) = 22_000_000;
    // 27,5M − 5,5M = 22_000_000) = 15_195_980 →
    // entrada = 27_500_000 − 15_195_980 − 5_500_000 = 6_804_020 (< FGTS disponível).
    expect(mcmv.entradaNecessaria).toBe(6_804_020);
    expect(mcmv.entradaNecessaria).toBeLessThan(20_000_000);
  });

  it("faixa 4 (renda R$ 13.000) mantém o teto do programa (R$ 600 mil)", () => {
    const r = calcularCapacidade(
      { ...perfilEscopo, rendaMensal: 1_300_000, fgts: 30_000_000 },
      PARAMETROS_2026_07,
    );
    expect(porModalidade(r.porModalidade).mcmv.valorMaximoImovel).toBe(60_000_000);
  });
});

describe("calcularCapacidade — entrada NECESSÁRIA é a mínima (não todo o FGTS)", () => {
  it("teto da modalidade limita → cliente financia o máximo e usa menos entrada", () => {
    // Caso da revisão adversarial: renda R$ 13.000 (faixa 4), FGTS R$ 300.000, 30 anos.
    //   parcelaMax = 390_000; i = 0,10/12 ≈ 0,0083333 a.m.
    //   financiávelMax = 390_000 / (1/420 + i) = 36_400_000
    //   capacidadeBruta = 36_400_000 + 30_000_000 = 66_400_000
    //   teto LTV = 30_000_000/0,2 = 150_000_000; teto programa = 60_000_000 ← LIMITA
    //   financiado = min(36_400_000; floor(0,8×60M) = 48_000_000; 60M) = 36_400_000
    //   entradaNecessaria = 60_000_000 − 36_400_000 = 23_600_000 (R$ 236 mil),
    //   NÃO os R$ 300 mil de FGTS disponíveis.
    const r = calcularCapacidade(
      { ...perfilEscopo, rendaMensal: 1_300_000, fgts: 30_000_000 },
      PARAMETROS_2026_07,
    );
    const mcmv = porModalidade(r.porModalidade).mcmv;
    expect(mcmv.valorMaximoImovel).toBe(60_000_000);
    expect(mcmv.entradaNecessaria).toBe(23_600_000);
    // Parcela do cenário de financiamento máximo encosta no teto de renda.
    expect(mcmv.parcelaEstimada).toBe(390_000);
    expect(mcmv.parcelaEstimada).toBeLessThanOrEqual(r.detalhamento.parcelaMax);
  });
});

describe("calcularCapacidade — teto SFH para uso do FGTS (R$ 2,25 mi)", () => {
  it("renda alta + FGTS alto: capacidade com FGTS é limitada ao teto SFH", () => {
    // Renda R$ 100.000, FGTS R$ 1.000.000 (SBPE, sem teto de valor próprio):
    //   parcelaMax = 3_000_000; i = 0,1119/12 = 0,009325 a.m.
    //   financiávelMax = 3_000_000 / (1/420 + i) = 256_279_874
    //   capacidadeBruta = 256_279_874 + 100_000_000 = 356_279_874
    //   teto LTV = 100M/0,2 = 500_000_000
    //   SEM o teto SFH o resultado seria R$ 3,56 mi COM FGTS — proibido: FGTS
    //   só pode ser usado até R$ 2,25 mi → V = 225_000_000.
    //   Cenário sem FGTS: E+S = 0 ⇒ V = 0. Vence o cenário com FGTS no teto.
    const r = calcularCapacidade(
      { ...perfilEscopo, rendaMensal: 10_000_000, fgts: 100_000_000 },
      PARAMETROS_2026_07,
    );
    const sbpe = porModalidade(r.porModalidade).sbpe;
    expect(sbpe.valorMaximoImovel).toBe(225_000_000);
    // financiado = min(256_279_874; floor(0,8×225M) = 180_000_000) = 180_000_000
    // 1ª parcela SAC = 180M/420 + 180M×0,009325 = 2_107_071,43 → 2_107_071
    expect(sbpe.parcelaEstimada).toBe(2_107_071);
    expect(sbpe.entradaNecessaria).toBe(45_000_000); // 225M − 180M
    expect(r.valorMaximoImovel).toBe(225_000_000);
  });

  it("teto SFH parametrizado: sem o parâmetro, o FGTS não é limitado", () => {
    const parametros = structuredClone(PARAMETROS_2026_07);
    delete parametros.parametrosGerais.tetoValorImovelParaFgts;
    const r = calcularCapacidade(
      { ...perfilEscopo, rendaMensal: 10_000_000, fgts: 100_000_000 },
      parametros,
    );
    // capacidadeBruta = 256_279_874 + 100_000_000 = 356_279_874 (< teto LTV 500M).
    expect(porModalidade(r.porModalidade).sbpe.valorMaximoImovel).toBe(356_279_874);
  });
});

describe("calcularCapacidade — limite por entrada (LTV)", () => {
  it("sem FGTS e LTV 0,8 (sem subsídio) → capacidade 0 em todas as modalidades", () => {
    // Renda R$ 6.500 → MCMV faixa 3 (sem subsídio). E + S = 0 e LTV 0,8 < 1:
    // V ≤ (E+S)/(1−L) = 0 — o banco não financia 100%, logo nada é comprável.
    const r = calcularCapacidade({ ...perfilEscopo, fgts: 0 }, PARAMETROS_2026_07);
    expect(r.valorMaximoImovel).toBe(0);
    for (const cap of r.porModalidade) {
      expect(cap.elegivel).toBe(true); // elegível, porém limitado pela entrada
      expect(cap.valorMaximoImovel).toBe(0);
      expect(cap.parcelaEstimada).toBe(0);
    }
  });
});

describe("calcularCapacidade — monotonicidade em renda", () => {
  it("mais renda ⇒ capacidade ≥ (gargalo no LTV: capacidades iguais)", () => {
    const menor = calcularCapacidade(perfilEscopo, PARAMETROS_2026_07);
    const maior = calcularCapacidade(
      { ...perfilEscopo, rendaMensal: 800_000 },
      PARAMETROS_2026_07,
    );
    expect(maior.valorMaximoImovel).toBeGreaterThanOrEqual(menor.valorMaximoImovel);
  });

  it("mais renda ⇒ capacidade estritamente maior quando a parcela é o gargalo (SBPE)", () => {
    // FGTS alto (R$ 200 mil) afasta o teto por LTV. SBPE não tem teto de valor
    // (só o SFH do FGTS, longe): o financiável pela parcela manda.
    //   i = 0,1119/12 = 0,009325:
    //   renda 6.500 → 16_658_192 + 20_000_000 = 36_658_192
    //   renda 8.000 → 20_502_390 + 20_000_000 = 40_502_390
    const base = { ...perfilEscopo, fgts: 20_000_000 };
    const menor = porModalidade(
      calcularCapacidade(base, PARAMETROS_2026_07).porModalidade,
    ).sbpe;
    const maior = porModalidade(
      calcularCapacidade({ ...base, rendaMensal: 800_000 }, PARAMETROS_2026_07).porModalidade,
    ).sbpe;
    expect(menor.valorMaximoImovel).toBe(36_658_192);
    expect(maior.valorMaximoImovel).toBe(40_502_390);
    expect(maior.valorMaximoImovel).toBeGreaterThan(menor.valorMaximoImovel);
  });

  it("no gargalo da parcela, a parcela estimada encosta no teto (±1 centavo)", () => {
    const r = calcularCapacidade({ ...perfilEscopo, fgts: 20_000_000 }, PARAMETROS_2026_07);
    const sbpe = porModalidade(r.porModalidade).sbpe;
    expect(Math.abs(sbpe.parcelaEstimada - r.detalhamento.parcelaMax)).toBeLessThanOrEqual(1);
  });
});

describe("calcularCapacidade — composição de renda e faixas", () => {
  it("renda do cônjuge compõe: casal acima da última faixa MCMV → melhor vira SBPE", () => {
    const r = calcularCapacidade(
      {
        ...perfilEscopo,
        rendaMensal: 800_000,
        rendaConjuge: 700_000, // total R$ 15.000 > última faixa MCMV (R$ 13.000)
        estadoCivil: "casado",
      },
      PARAMETROS_2026_07,
    );
    const caps = porModalidade(r.porModalidade);
    expect(caps.mcmv.elegivel).toBe(false);
    expect(caps.mcmv.motivo).toMatch(/renda/i);
    expect(caps.credito_associativo.elegivel).toBe(false);
    expect(caps.sbpe.elegivel).toBe(true);
    expect(r.melhorModalidade).toBe("sbpe");
    // Ainda limitado pelo LTV: FGTS R$ 22.000 / 0,2 = R$ 110.000.
    expect(r.valorMaximoImovel).toBe(11_000_000);
  });

  it("renda de OUTROS MEMBROS compõe a renda familiar e muda a faixa MCMV", () => {
    // Titular sozinho: R$ 3.000 → faixa 1 (subsídio até R$ 55 mil).
    const soTitular = calcularCapacidade(
      { ...perfilEscopo, rendaMensal: 300_000, fgts: 0 },
      PARAMETROS_2026_07,
    );
    expect(porModalidade(soTitular.porModalidade).mcmv.subsidioEstimado).toBe(5_500_000);

    // + R$ 3.000 de outros moradores: renda FAMILIAR R$ 6.000 → faixa 3 (sem subsídio).
    const familia = calcularCapacidade(
      { ...perfilEscopo, rendaMensal: 300_000, fgts: 0, rendaOutrosMembros: 300_000 },
      PARAMETROS_2026_07,
    );
    expect(porModalidade(familia.porModalidade).mcmv.subsidioEstimado).toBe(0);
    // parcelaMax reflete a renda familiar: 600_000 × 0,30 = 180_000.
    expect(familia.detalhamento.parcelaMax).toBe(180_000);
  });

  it("outros membros podem tirar a família do MCMV (acima da última faixa)", () => {
    const r = calcularCapacidade(
      {
        ...perfilEscopo,
        rendaMensal: 800_000,
        rendaConjuge: 400_000,
        rendaOutrosMembros: 300_000, // total R$ 15.000 > última faixa (R$ 13.000)
        estadoCivil: "casado",
      },
      PARAMETROS_2026_07,
    );
    const caps = porModalidade(r.porModalidade);
    expect(caps.mcmv.elegivel).toBe(false);
    expect(caps.mcmv.motivo).toMatch(/renda/i);
    expect(caps.sbpe.elegivel).toBe(true);
  });

  it("rendaOutrosMembros negativa é rejeitada", () => {
    expect(() =>
      calcularCapacidade({ ...perfilEscopo, rendaOutrosMembros: -1 }, PARAMETROS_2026_07),
    ).toThrow(RangeError);
  });
});

describe("idadeEmMeses e validação de entrada", () => {
  it("conta meses completos entre datas ISO", () => {
    expect(idadeEmMeses("1996-07-02", "2026-07-02")).toBe(360);
    expect(idadeEmMeses("1996-07-03", "2026-07-02")).toBe(359); // mês incompleto
  });

  it("aceita dataNascimento + dataReferencia no lugar de idadeMeses", () => {
    const porIdade = calcularCapacidade(perfilEscopo, PARAMETROS_2026_07);
    const porData = calcularCapacidade(
      {
        ...perfilEscopo,
        idadeMeses: undefined,
        dataNascimento: "1996-07-02",
        dataReferencia: "2026-07-02",
      },
      PARAMETROS_2026_07,
    );
    expect(porData).toEqual(porIdade);
  });

  it("rejeita perfil sem idade e valores negativos", () => {
    const semIdade = { ...perfilEscopo, idadeMeses: undefined };
    expect(() => calcularCapacidade(semIdade, PARAMETROS_2026_07)).toThrow(RangeError);
    expect(() =>
      calcularCapacidade({ ...perfilEscopo, rendaMensal: -1 }, PARAMETROS_2026_07),
    ).toThrow(RangeError);
    expect(() =>
      calcularCapacidade({ ...perfilEscopo, fgts: -1 }, PARAMETROS_2026_07),
    ).toThrow(RangeError);
    expect(() =>
      calcularCapacidade({ ...perfilEscopo, dependentes: -1 }, PARAMETROS_2026_07),
    ).toThrow(RangeError);
  });
});
