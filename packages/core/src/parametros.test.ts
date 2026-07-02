import { describe, expect, it } from "vitest";
import { MODALIDADES, parametrosFinanceirosSchema, type ParametrosFinanceiros } from "@mobia/domain";
import { taxaAnualEfetivaDeNominal } from "./financiamento";
import {
  HISTORICO_PARAMETROS,
  PARAMETROS_2026_07,
  obterParametrosAtuais,
  obterParametrosVigentes,
} from "./parametros";

// Valores em CENTAVOS. Ex.: R$ 13.000,00 → 1_300_000.

describe("PARAMETROS_2026_07 — sanidade", () => {
  it("valida contra o schema zod do domínio", () => {
    expect(() => parametrosFinanceirosSchema.parse(PARAMETROS_2026_07)).not.toThrow();
  });

  it("tem vigência 2026-07-01 e fonte preenchida", () => {
    expect(PARAMETROS_2026_07.vigenciaInicio).toBe("2026-07-01");
    expect(PARAMETROS_2026_07.fonte.length).toBeGreaterThan(0);
  });

  it("cobre todas as modalidades do vocabulário fixo", () => {
    for (const modalidade of MODALIDADES) {
      expect(PARAMETROS_2026_07.modalidades[modalidade]).toBeDefined();
    }
  });

  it("toda modalidade tem taxa > 0, prazo > 0 e LTV em (0, 1]", () => {
    for (const modalidade of MODALIDADES) {
      const config = PARAMETROS_2026_07.modalidades[modalidade];
      expect(config.taxaAnualEfetiva, modalidade).toBeGreaterThan(0);
      expect(config.prazoMaxMeses, modalidade).toBeGreaterThan(0);
      expect(config.ltvMax, modalidade).toBeGreaterThan(0);
      expect(config.ltvMax, modalidade).toBeLessThanOrEqual(1);
    }
  });

  it("taxas gravadas são EFETIVAS convertidas das NOMINAIS das fontes", () => {
    // SBPE/novo/usado: TR + 11,19% a.a. NOMINAL (mesma taxa balcão para o usado —
    // spread anterior sem fonte foi removido). MCMV default: 10% nominal (Faixa 4).
    const efetiva1119 = taxaAnualEfetivaDeNominal(0.1119);
    expect(PARAMETROS_2026_07.modalidades.sbpe.taxaAnualEfetiva).toBe(efetiva1119);
    expect(PARAMETROS_2026_07.modalidades.imovel_novo.taxaAnualEfetiva).toBe(efetiva1119);
    expect(PARAMETROS_2026_07.modalidades.imovel_usado.taxaAnualEfetiva).toBe(efetiva1119);
    expect(PARAMETROS_2026_07.modalidades.mcmv.taxaAnualEfetiva).toBe(
      taxaAnualEfetivaDeNominal(0.1),
    );
    // Valor conhecido: 11,19% nominal → 11,7821...% efetiva a.a.
    expect(efetiva1119).toBeCloseTo(0.11782126000413706, 12);
  });

  it("modalidades de mercado declaram indexador TR (não somado — ver AVISO_ESTIMATIVA)", () => {
    for (const m of ["sbpe", "imovel_novo", "imovel_usado", "terreno_e_construcao"] as const) {
      expect(PARAMETROS_2026_07.modalidades[m].indexador, m).toBe("tr");
    }
    expect(PARAMETROS_2026_07.modalidades.mcmv.indexador).toBe("nenhum");
  });

  it("modalidades sem fonte própria estão marcadas com condicoesAValidar", () => {
    expect(PARAMETROS_2026_07.modalidades.credito_associativo.condicoesAValidar).toBe(true);
    expect(PARAMETROS_2026_07.modalidades.terreno_e_construcao.condicoesAValidar).toBe(true);
    expect(PARAMETROS_2026_07.modalidades.mcmv.condicoesAValidar).toBeUndefined();
    expect(PARAMETROS_2026_07.modalidades.sbpe.condicoesAValidar).toBeUndefined();
  });

  it("schema REJEITA snapshot com faixas fora de ordem (refine em configModalidadeSchema)", () => {
    const foraDeOrdem: ParametrosFinanceiros = structuredClone(PARAMETROS_2026_07);
    foraDeOrdem.modalidades.mcmv.faixas = [...foraDeOrdem.modalidades.mcmv.faixas!].reverse();
    expect(() => parametrosFinanceirosSchema.parse(foraDeOrdem)).toThrow(/crescente/);

    // Duplicata de rendaMensalAte também é rejeitada (estritamente crescente).
    const duplicada: ParametrosFinanceiros = structuredClone(PARAMETROS_2026_07);
    const faixas = duplicada.modalidades.mcmv.faixas!;
    faixas[1] = { ...faixas[1]!, rendaMensalAte: faixas[0]!.rendaMensalAte };
    expect(() => parametrosFinanceirosSchema.parse(duplicada)).toThrow(/crescente/);
  });

  it("faixas ordenadas: rendaMensalAte estritamente crescente", () => {
    for (const modalidade of MODALIDADES) {
      const faixas = PARAMETROS_2026_07.modalidades[modalidade].faixas;
      if (faixas === undefined) continue;
      expect(faixas.length, modalidade).toBeGreaterThan(0);
      for (let i = 1; i < faixas.length; i++) {
        expect(faixas[i]!.rendaMensalAte, `${modalidade} faixa ${i}`).toBeGreaterThan(
          faixas[i - 1]!.rendaMensalAte,
        );
      }
    }
  });

  it("taxas crescem (não decrescem) faixa a faixa e são > 0", () => {
    for (const modalidade of MODALIDADES) {
      const faixas = PARAMETROS_2026_07.modalidades[modalidade].faixas;
      if (faixas === undefined) continue;
      for (let i = 0; i < faixas.length; i++) {
        expect(faixas[i]!.taxaAnualEfetiva, `${modalidade} faixa ${i}`).toBeGreaterThan(0);
        if (i > 0) {
          expect(faixas[i]!.taxaAnualEfetiva, `${modalidade} faixa ${i}`).toBeGreaterThanOrEqual(
            faixas[i - 1]!.taxaAnualEfetiva,
          );
        }
      }
    }
  });

  it("subsídios não crescem faixa a faixa (faixas mais altas subsidiam menos)", () => {
    for (const modalidade of MODALIDADES) {
      const faixas = PARAMETROS_2026_07.modalidades[modalidade].faixas;
      if (faixas === undefined) continue;
      for (let i = 1; i < faixas.length; i++) {
        expect(faixas[i]!.subsidioMax, `${modalidade} faixa ${i}`).toBeLessThanOrEqual(
          faixas[i - 1]!.subsidioMax,
        );
      }
    }
  });

  it("tetos de valor: padrão > 0 e acima da última faixa de renda (MCMV 2026: R$ 600 mil)", () => {
    const mcmv = PARAMETROS_2026_07.modalidades.mcmv;
    expect(mcmv.tetoValorImovel).toBeDefined();
    // Teto do programa (Faixa 4) em abr/2026: R$ 600.000,00.
    expect(mcmv.tetoValorImovel!.padrao).toBe(60_000_000);
    for (const modalidade of MODALIDADES) {
      const teto = PARAMETROS_2026_07.modalidades[modalidade].tetoValorImovel;
      if (teto === undefined) continue;
      expect(teto.padrao, modalidade).toBeGreaterThan(0);
      for (const sobrescrita of Object.values(teto.porUf ?? {})) {
        expect(sobrescrita, modalidade).toBeGreaterThan(0);
      }
    }
  });

  it("regras gerais: comprometimento ~30%, idade máx 80a6m (966 meses), LTV SAC ≥ Price", () => {
    const gerais = PARAMETROS_2026_07.parametrosGerais;
    expect(gerais.comprometimentoRendaMax).toBeGreaterThan(0);
    expect(gerais.comprometimentoRendaMax).toBeLessThanOrEqual(1);
    expect(gerais.comprometimentoRendaMax).toBe(0.3);
    expect(gerais.idadeMaxMeses).toBe(966);
    expect(gerais.ltvMax.sac).toBeGreaterThanOrEqual(gerais.ltvMax.price);
  });

  it("faixas MCMV 2026 verificadas contra as fontes (limites de renda)", () => {
    const faixas = PARAMETROS_2026_07.modalidades.mcmv.faixas!;
    expect(faixas.map((f) => f.rendaMensalAte)).toEqual([
      320_000, // Faixa 1: até R$ 3.200
      500_000, // Faixa 2: até R$ 5.000
      960_000, // Faixa 3: até R$ 9.600
      1_300_000, // Faixa 4: até R$ 13.000
    ]);
  });

  it("tetos de valor POR FAIXA MCMV 2026 (F1/F2: R$ 275 mil; F3: R$ 400 mil; F4: programa)", () => {
    const faixas = PARAMETROS_2026_07.modalidades.mcmv.faixas!;
    expect(faixas.map((f) => f.tetoValorImovel?.padrao)).toEqual([
      27_500_000, // Faixa 1
      27_500_000, // Faixa 2
      40_000_000, // Faixa 3
      undefined, // Faixa 4: vale o teto da modalidade (R$ 600 mil)
    ]);
  });

  it("teto SFH para uso do FGTS: R$ 2,25 mi (CMN out/2025)", () => {
    expect(PARAMETROS_2026_07.parametrosGerais.tetoValorImovelParaFgts).toBe(225_000_000);
  });
});

describe("obterParametrosAtuais (ponto único de acesso dos apps — H-05)", () => {
  it("resolve o snapshot vigente no histórico seed", () => {
    expect(obterParametrosAtuais("2026-08-15")).toBe(PARAMETROS_2026_07);
    expect(HISTORICO_PARAMETROS).toContain(PARAMETROS_2026_07);
  });

  it("data anterior a qualquer vigência → RangeError", () => {
    expect(() => obterParametrosAtuais("2026-06-30")).toThrow(RangeError);
  });
});

describe("obterParametrosVigentes", () => {
  const v2: ParametrosFinanceiros = {
    ...PARAMETROS_2026_07,
    versao: 2,
    vigenciaInicio: "2027-01-01",
    fonte: "Snapshot fictício de teste (v2)",
  };
  // Histórico deliberadamente fora de ordem: a seleção não depende de ordenação.
  const historico = [v2, PARAMETROS_2026_07];

  it("data entre as duas vigências → snapshot mais antigo", () => {
    expect(obterParametrosVigentes("2026-08-15", historico)).toBe(PARAMETROS_2026_07);
  });

  it("data após a segunda vigência → snapshot mais recente", () => {
    expect(obterParametrosVigentes("2027-05-01", historico)).toBe(v2);
  });

  it("data exatamente no início de vigência → aquele snapshot (limite inclusivo)", () => {
    expect(obterParametrosVigentes("2026-07-01", historico)).toBe(PARAMETROS_2026_07);
    expect(obterParametrosVigentes("2027-01-01", historico)).toBe(v2);
  });

  it("data anterior a qualquer vigência → RangeError", () => {
    expect(() => obterParametrosVigentes("2026-06-30", historico)).toThrow(RangeError);
  });

  it("histórico vazio → RangeError", () => {
    expect(() => obterParametrosVigentes("2026-08-15", [])).toThrow(RangeError);
  });

  it("data fora do formato ISO → RangeError", () => {
    expect(() => obterParametrosVigentes("15/08/2026", historico)).toThrow(RangeError);
    expect(() => obterParametrosVigentes("2026-8-15", historico)).toThrow(RangeError);
  });

  it("empate de vigência → maior versão vence", () => {
    const v3 = { ...PARAMETROS_2026_07, versao: 3, fonte: "Correção do snapshot v1" };
    expect(obterParametrosVigentes("2026-07-01", [PARAMETROS_2026_07, v3])).toBe(v3);
    expect(obterParametrosVigentes("2026-07-01", [v3, PARAMETROS_2026_07])).toBe(v3);
  });
});
