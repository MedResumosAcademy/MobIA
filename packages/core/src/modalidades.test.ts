import { describe, expect, it } from "vitest";
import type { Modalidade, ParametrosFinanceiros } from "@mobia/domain";
import {
  UFS_BRASIL,
  enquadrarModalidades,
  extrairUf,
  type EnquadramentoModalidade,
  type ImovelResumo,
  type PerfilResumo,
} from "./modalidades";
import { PARAMETROS_2026_07 } from "./parametros";

// Valores em CENTAVOS. Ex.: R$ 400.000,00 → 40_000_000.

const RENDA_LIMITE_ULTIMA_FAIXA = 1_300_000; // R$ 13.000 — última faixa MCMV 2026.
const TETO_MCMV = 60_000_000; // R$ 600 mil — teto do programa (Faixa 4) 2026.

function porModalidade(
  resultado: EnquadramentoModalidade[],
): Record<Modalidade, EnquadramentoModalidade> {
  return Object.fromEntries(resultado.map((r) => [r.modalidade, r])) as Record<
    Modalidade,
    EnquadramentoModalidade
  >;
}

const perfilFaixa2: PerfilResumo = { rendaMensalTotal: 450_000, cidadeUF: "Fortaleza-CE" };
// Faixa 4 (renda R$ 13.000): sem teto de faixa — vale o teto do programa (R$ 600 mil).
const perfilFaixa4: PerfilResumo = { rendaMensalTotal: 1_300_000, cidadeUF: "Fortaleza-CE" };
const aptoNovo: ImovelResumo = { valor: 40_000_000, tipo: "apartamento", condicao: "novo" };

describe("extrairUf — separador obrigatório + validação contra as 27 UFs", () => {
  it("extrai a UF após separador ou sozinha", () => {
    expect(extrairUf("Fortaleza-CE")).toBe("CE");
    expect(extrairUf("Belém/PA")).toBe("PA");
    expect(extrairUf("Natal, RN")).toBe("RN");
    expect(extrairUf("CE")).toBe("CE");
  });

  it("NÃO captura sufixo de nome de cidade como UF (falso positivo)", () => {
    expect(extrairUf("NATAL")).toBeUndefined(); // "AL" sem separador não é UF
    expect(extrairUf("SAO PAULO")).toBeUndefined(); // "LO" não é UF
  });

  it("sigla desconhecida (não está nas 27 UFs) é descartada", () => {
    expect(extrairUf("Cidade-XX")).toBeUndefined();
    expect(extrairUf("XX")).toBeUndefined();
  });

  it("undefined → undefined; lista tem exatamente as 27 UFs", () => {
    expect(extrairUf(undefined)).toBeUndefined();
    expect(UFS_BRASIL).toHaveLength(27);
    expect(new Set(UFS_BRASIL).size).toBe(27);
  });
});

describe("enquadrarModalidades — ordenação defensiva das faixas", () => {
  it("faixas fora de ordem (dados sem passar pelo schema) não quebram o enquadramento", () => {
    const parametros: ParametrosFinanceiros = structuredClone(PARAMETROS_2026_07);
    parametros.modalidades.mcmv.faixas = [
      ...parametros.modalidades.mcmv.faixas!,
    ].reverse();

    // Renda R$ 4.500 (faixa 2): segue elegível — sem a ordenação, o .at(-1)
    // apontaria a faixa 1 (R$ 3.200) como "última" e rejeitaria por renda.
    const dentro = porModalidade(
      enquadrarModalidades(perfilFaixa2, { ...aptoNovo, valor: 27_500_000 }, parametros),
    );
    expect(dentro.mcmv.elegivel).toBe(true);

    // E o teto aplicado é o da faixa CORRETA (F2: R$ 275 mil) — sem a
    // ordenação, o .find enquadraria a faixa 4 (sem teto próprio).
    const acima = porModalidade(enquadrarModalidades(perfilFaixa2, aptoNovo, parametros));
    expect(acima.mcmv.elegivel).toBe(false);
    expect(acima.mcmv.motivo).toMatch(/teto/i);
  });
});

describe("enquadrarModalidades — bordas de renda (faixas)", () => {
  it("renda EXATAMENTE no limite da última faixa → MCMV elegível (limite inclusivo)", () => {
    const r = porModalidade(
      enquadrarModalidades(
        { rendaMensalTotal: RENDA_LIMITE_ULTIMA_FAIXA },
        aptoNovo,
        PARAMETROS_2026_07,
      ),
    );
    expect(r.mcmv.elegivel).toBe(true);
    expect(r.mcmv.motivo).toBeUndefined();
  });

  it("renda 1 centavo acima da última faixa → MCMV inelegível com motivo de renda", () => {
    const r = porModalidade(
      enquadrarModalidades(
        { rendaMensalTotal: RENDA_LIMITE_ULTIMA_FAIXA + 1 },
        aptoNovo,
        PARAMETROS_2026_07,
      ),
    );
    expect(r.mcmv.elegivel).toBe(false);
    expect(r.mcmv.motivo).toMatch(/renda/i);
    // SBPE não tem faixas: segue elegível para a mesma renda.
    expect(r.sbpe.elegivel).toBe(true);
  });
});

describe("enquadrarModalidades — bordas de valor (teto)", () => {
  it("valor EXATAMENTE no teto → MCMV elegível (limite inclusivo)", () => {
    const r = porModalidade(
      enquadrarModalidades(
        perfilFaixa4,
        { ...aptoNovo, valor: TETO_MCMV },
        PARAMETROS_2026_07,
      ),
    );
    expect(r.mcmv.elegivel).toBe(true);
  });

  it("valor 1 centavo acima do teto → MCMV inelegível; SBPE (sem teto) elegível", () => {
    const r = porModalidade(
      enquadrarModalidades(
        perfilFaixa4,
        { ...aptoNovo, valor: TETO_MCMV + 1 },
        PARAMETROS_2026_07,
      ),
    );
    expect(r.mcmv.elegivel).toBe(false);
    expect(r.mcmv.motivo).toMatch(/teto/i);
    expect(r.sbpe.elegivel).toBe(true);
    expect(r.imovel_novo.elegivel).toBe(true);
  });

  it("teto da FAIXA enquadrada limita antes do teto do programa (MCMV 2026)", () => {
    // Faixa 2 (renda R$ 4.500): teto da faixa R$ 275 mil < teto do programa
    // R$ 600 mil → imóvel de R$ 400 mil é INELEGÍVEL para a faixa 2, ainda que
    // abaixo do teto do programa. Corrige o achado de teto único p/ todas as faixas.
    const r = porModalidade(enquadrarModalidades(perfilFaixa2, aptoNovo, PARAMETROS_2026_07));
    expect(r.mcmv.elegivel).toBe(false);
    expect(r.mcmv.motivo).toMatch(/teto/i);
    expect(r.mcmv.motivo).toContain("275.000,00");

    // Mesma renda, imóvel dentro do teto da faixa → elegível.
    const dentro = porModalidade(
      enquadrarModalidades(perfilFaixa2, { ...aptoNovo, valor: 27_500_000 }, PARAMETROS_2026_07),
    );
    expect(dentro.mcmv.elegivel).toBe(true);

    // Faixa 3 (renda R$ 6.500): teto R$ 400 mil — imóvel de R$ 400 mil elegível.
    const faixa3 = porModalidade(
      enquadrarModalidades({ rendaMensalTotal: 650_000 }, aptoNovo, PARAMETROS_2026_07),
    );
    expect(faixa3.mcmv.elegivel).toBe(true);
  });

  it("sobrescrita de teto por UF vale só para a UF cadastrada", () => {
    const parametros: ParametrosFinanceiros = structuredClone(PARAMETROS_2026_07);
    parametros.modalidades.mcmv.tetoValorImovel = {
      padrao: TETO_MCMV,
      porUf: { SP: 30_000_000 }, // teto reduzido fictício para SP
    };
    const imovel: ImovelResumo = { ...aptoNovo, valor: 35_000_000 };

    const emSP = porModalidade(
      enquadrarModalidades(
        { rendaMensalTotal: 1_300_000, cidadeUF: "São Paulo-SP" },
        imovel,
        parametros,
      ),
    );
    expect(emSP.mcmv.elegivel).toBe(false);
    expect(emSP.mcmv.motivo).toMatch(/teto/i);

    const emCE = porModalidade(enquadrarModalidades(perfilFaixa4, imovel, parametros));
    expect(emCE.mcmv.elegivel).toBe(true);

    const semUf = porModalidade(
      enquadrarModalidades({ rendaMensalTotal: 1_300_000 }, imovel, parametros),
    );
    expect(semUf.mcmv.elegivel).toBe(true); // sem UF → teto padrão
  });
});

describe("enquadrarModalidades — compatibilidade estrutural", () => {
  it("terreno → só terreno_e_construcao elegível", () => {
    const r = porModalidade(
      enquadrarModalidades(
        perfilFaixa2,
        { valor: 15_000_000, tipo: "terreno", condicao: "novo" },
        PARAMETROS_2026_07,
      ),
    );
    expect(r.terreno_e_construcao.elegivel).toBe(true);
    for (const m of ["mcmv", "sbpe", "credito_associativo", "imovel_novo", "imovel_usado"] as const) {
      expect(r[m].elegivel, m).toBe(false);
      expect(r[m].motivo, m).toMatch(/terreno/i);
    }
  });

  it("casa usada → imovel_novo e credito_associativo inelegíveis; imovel_usado elegível", () => {
    const r = porModalidade(
      enquadrarModalidades(
        perfilFaixa2,
        { valor: 25_000_000, tipo: "casa", condicao: "usado" },
        PARAMETROS_2026_07,
      ),
    );
    expect(r.imovel_usado.elegivel).toBe(true);
    expect(r.imovel_novo.elegivel).toBe(false);
    expect(r.imovel_novo.motivo).toMatch(/novo/i);
    expect(r.credito_associativo.elegivel).toBe(false);
    expect(r.mcmv.elegivel).toBe(true); // MCMV admite novo e usado
  });

  it("apartamento novo → imovel_usado inelegível; terreno_e_construcao inelegível", () => {
    const r = porModalidade(enquadrarModalidades(perfilFaixa2, aptoNovo, PARAMETROS_2026_07));
    expect(r.imovel_novo.elegivel).toBe(true);
    expect(r.imovel_usado.elegivel).toBe(false);
    expect(r.imovel_usado.motivo).toMatch(/usado/i);
    expect(r.terreno_e_construcao.elegivel).toBe(false);
  });
});

describe("enquadrarModalidades — determinismo e orientação por parâmetros", () => {
  it("retorna todas as modalidades, na ordem do vocabulário, com a config dos parâmetros", () => {
    const resultado = enquadrarModalidades(perfilFaixa2, aptoNovo, PARAMETROS_2026_07);
    expect(resultado.map((r) => r.modalidade)).toEqual([
      "mcmv",
      "sbpe",
      "credito_associativo",
      "imovel_novo",
      "imovel_usado",
      "terreno_e_construcao",
    ]);
    for (const item of resultado) {
      expect(item.config).toBe(PARAMETROS_2026_07.modalidades[item.modalidade]);
    }
  });

  it("é determinístico: mesmas entradas → mesmo resultado", () => {
    const a = enquadrarModalidades(perfilFaixa2, aptoNovo, PARAMETROS_2026_07);
    const b = enquadrarModalidades(perfilFaixa2, aptoNovo, PARAMETROS_2026_07);
    expect(a).toEqual(b);
  });

  it("mudar o parâmetro muda o enquadramento (nada hard-coded na função)", () => {
    const parametros: ParametrosFinanceiros = structuredClone(PARAMETROS_2026_07);
    // Última faixa MCMV rebaixada para R$ 4.000 → renda de R$ 4.500 sai do programa.
    parametros.modalidades.mcmv.faixas = [
      { rendaMensalAte: 400_000, taxaAnualEfetiva: 0.05, subsidioMax: 1_000_000 },
    ];
    const r = porModalidade(enquadrarModalidades(perfilFaixa2, aptoNovo, parametros));
    expect(r.mcmv.elegivel).toBe(false);
    expect(r.mcmv.motivo).toMatch(/renda/i);
  });

  it("motivo cita os valores envolvidos em reais (legível para o cliente)", () => {
    const r = porModalidade(
      enquadrarModalidades(
        perfilFaixa4,
        { ...aptoNovo, valor: TETO_MCMV + 1 },
        PARAMETROS_2026_07,
      ),
    );
    expect(r.mcmv.motivo).toContain("600.000,00");
  });
});
