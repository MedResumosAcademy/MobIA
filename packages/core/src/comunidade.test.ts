import { describe, expect, it } from "vitest";

import {
  FAIXAS_COMUNIDADE,
  PESOS_COMUNIDADE,
  calcularPontosComunidade,
  calcularStreak,
  faixaComunidade,
} from "./comunidade";

describe("calcularStreak", () => {
  it("lista vazia ⇒ 0/0", () => {
    expect(calcularStreak([], "2026-07-03")).toEqual({ atual: 0, recorde: 0 });
  });

  it("1 dia (hoje) ⇒ atual 1, recorde 1", () => {
    expect(calcularStreak(["2026-07-03"], "2026-07-03")).toEqual({ atual: 1, recorde: 1 });
  });

  it("atividade só ontem ⇒ streak continua válido (atual > 0)", () => {
    expect(calcularStreak(["2026-07-02"], "2026-07-03")).toEqual({ atual: 1, recorde: 1 });
  });

  it("sequência terminando ontem ⇒ atual conta a série", () => {
    const datas = ["2026-06-30", "2026-07-01", "2026-07-02"];
    expect(calcularStreak(datas, "2026-07-03")).toEqual({ atual: 3, recorde: 3 });
  });

  it("sequência consecutiva terminando hoje", () => {
    const datas = ["2026-07-01", "2026-07-02", "2026-07-03"];
    expect(calcularStreak(datas, "2026-07-03")).toEqual({ atual: 3, recorde: 3 });
  });

  it("gap quebra o atual mas o recorde é preservado", () => {
    // Run de 3 no passado (recorde), depois gap, depois 2 dias até hoje.
    const datas = [
      "2026-06-10",
      "2026-06-11",
      "2026-06-12", // recorde = 3
      "2026-07-02",
      "2026-07-03", // atual = 2
    ];
    expect(calcularStreak(datas, "2026-07-03")).toEqual({ atual: 2, recorde: 3 });
  });

  it("atividade só no passado (anterior a ontem) ⇒ atual 0", () => {
    const datas = ["2026-06-01", "2026-06-02", "2026-06-03"];
    expect(calcularStreak(datas, "2026-07-03")).toEqual({ atual: 0, recorde: 3 });
  });

  it("dias fora de ordem e duplicados são normalizados", () => {
    const datas = [
      "2026-07-03",
      "2026-07-01",
      "2026-07-02",
      "2026-07-01", // dup
      "2026-07-03", // dup
    ];
    expect(calcularStreak(datas, "2026-07-03")).toEqual({ atual: 3, recorde: 3 });
  });

  it("ignora a parte de hora (timestamps do mesmo dia contam 1)", () => {
    const datas = ["2026-07-03T08:00:00Z", "2026-07-03T23:59:59Z"];
    expect(calcularStreak(datas, "2026-07-03T12:00:00Z")).toEqual({ atual: 1, recorde: 1 });
  });

  it("hojeISO com hora é comparado só pela data", () => {
    expect(calcularStreak(["2026-07-02"], "2026-07-03T10:30:00-03:00")).toEqual({
      atual: 1,
      recorde: 1,
    });
  });

  it("atravessa fronteira de mês corretamente", () => {
    const datas = ["2026-06-29", "2026-06-30", "2026-07-01"];
    expect(calcularStreak(datas, "2026-07-01")).toEqual({ atual: 3, recorde: 3 });
  });

  it("recorde no passado maior que a sequência atual", () => {
    const datas = [
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
      "2026-01-04", // recorde = 4
      "2026-07-03", // atual = 1
    ];
    expect(calcularStreak(datas, "2026-07-03")).toEqual({ atual: 1, recorde: 4 });
  });
});

describe("calcularPontosComunidade", () => {
  it("stats zeradas ⇒ 0", () => {
    expect(
      calcularPontosComunidade({
        publicacoes: 0,
        curtidasRecebidas: 0,
        seguidores: 0,
        streakAtual: 0,
      }),
    ).toBe(0);
  });

  it("composto usa os pesos exportados", () => {
    const esperado =
      4 * PESOS_COMUNIDADE.publicacao +
      10 * PESOS_COMUNIDADE.curtida +
      7 * PESOS_COMUNIDADE.seguidor +
      3 * PESOS_COMUNIDADE.streak;
    expect(
      calcularPontosComunidade({
        publicacoes: 4,
        curtidasRecebidas: 10,
        seguidores: 7,
        streakAtual: 3,
      }),
    ).toBe(esperado);
    expect(esperado).toBe(40 + 30 + 56 + 15); // 141
  });

  it("nunca negativo (componentes negativos viram 0)", () => {
    expect(
      calcularPontosComunidade({
        publicacoes: -5,
        curtidasRecebidas: -10,
        seguidores: -1,
        streakAtual: -3,
      }),
    ).toBe(0);
  });
});

describe("faixaComunidade", () => {
  it("0 pontos ⇒ Iniciante, nível 1", () => {
    expect(faixaComunidade(0)).toEqual({ nivel: 1, titulo: "Iniciante", proxima: 100 });
  });

  it("no limiar exato sobe de faixa", () => {
    expect(faixaComunidade(100)).toEqual({ nivel: 2, titulo: "Corretor Ativo", proxima: 400 });
    expect(faixaComunidade(500)).toEqual({ nivel: 3, titulo: "Destaque", proxima: 1000 });
    expect(faixaComunidade(1500)).toEqual({ nivel: 4, titulo: "Referência", proxima: 3500 });
  });

  it("logo abaixo do limiar permanece na faixa anterior", () => {
    expect(faixaComunidade(99)).toEqual({ nivel: 1, titulo: "Iniciante", proxima: 1 });
    expect(faixaComunidade(499)).toEqual({ nivel: 2, titulo: "Corretor Ativo", proxima: 1 });
  });

  it("última faixa ⇒ proxima null", () => {
    expect(faixaComunidade(5000)).toEqual({ nivel: 5, titulo: "Lenda", proxima: null });
    expect(faixaComunidade(999999)).toEqual({ nivel: 5, titulo: "Lenda", proxima: null });
  });

  it("pontos negativos tratados como 0", () => {
    expect(faixaComunidade(-50)).toEqual({ nivel: 1, titulo: "Iniciante", proxima: 100 });
  });

  it("os limiares exportados estão em ordem ascendente", () => {
    for (let i = 1; i < FAIXAS_COMUNIDADE.length; i += 1) {
      const anterior = FAIXAS_COMUNIDADE[i - 1]!;
      const atual = FAIXAS_COMUNIDADE[i]!;
      expect(atual.minimo).toBeGreaterThan(anterior.minimo);
    }
  });
});
