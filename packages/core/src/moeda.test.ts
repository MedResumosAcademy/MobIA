import { describe, expect, it } from "vitest";
import { centavosParaReaisInput, reaisTextoParaCentavos } from "./moeda";

describe("reaisTextoParaCentavos", () => {
  it('ponto único com 2 casas é DECIMAL: "1280000.00" (prefill de edição)', () => {
    expect(reaisTextoParaCentavos("1280000.00")).toBe(128000000);
  });

  it('ponto único com 1 casa é decimal: "1500.5"', () => {
    expect(reaisTextoParaCentavos("1500.5")).toBe(150050);
  });

  it('formato pt-BR completo: "1.280.000,00"', () => {
    expect(reaisTextoParaCentavos("1.280.000,00")).toBe(128000000);
  });

  it('vírgula decimal sem milhar: "1280000,00"', () => {
    expect(reaisTextoParaCentavos("1280000,00")).toBe(128000000);
  });

  it('decimal com ponto: "1500.50"', () => {
    expect(reaisTextoParaCentavos("1500.50")).toBe(150050);
  });

  it('pontos de milhar sem decimal: "1.280.000"', () => {
    expect(reaisTextoParaCentavos("1.280.000")).toBe(128000000);
  });

  it('inteiro sem separador: "1280000"', () => {
    expect(reaisTextoParaCentavos("1280000")).toBe(128000000);
  });

  it('ponto único com 3 casas é MILHAR: "1.234"', () => {
    expect(reaisTextoParaCentavos("1.234")).toBe(123400);
  });

  it('vírgula com 1 casa: "450000,5"', () => {
    expect(reaisTextoParaCentavos("450000,5")).toBe(45000050);
  });

  it("aceita espaços nas bordas", () => {
    expect(reaisTextoParaCentavos(" 1500,50 ")).toBe(150050);
  });

  it("lança para vazio", () => {
    expect(() => reaisTextoParaCentavos("")).toThrow("valor inválido");
    expect(() => reaisTextoParaCentavos("   ")).toThrow("valor inválido");
  });

  it("lança para não numérico", () => {
    expect(() => reaisTextoParaCentavos("abc")).toThrow("valor inválido");
    expect(() => reaisTextoParaCentavos("R$ x")).toThrow("valor inválido");
  });

  it("lança para negativo", () => {
    expect(() => reaisTextoParaCentavos("-100")).toThrow("valor inválido");
    expect(() => reaisTextoParaCentavos("-1.000,00")).toThrow("valor inválido");
  });
});

describe("centavosParaReaisInput", () => {
  it('formata centavos com vírgula decimal: 128000000 → "1280000,00"', () => {
    expect(centavosParaReaisInput(128000000)).toBe("1280000,00");
  });

  it('mantém as duas casas: 150050 → "1500,50"', () => {
    expect(centavosParaReaisInput(150050)).toBe("1500,50");
  });

  it('zero → "0,00"', () => {
    expect(centavosParaReaisInput(0)).toBe("0,00");
  });

  it('null → "" (input vazio)', () => {
    expect(centavosParaReaisInput(null)).toBe("");
  });

  it("ida-e-volta com reaisTextoParaCentavos preserva o valor", () => {
    for (const centavos of [1, 99, 100, 150050, 45000050, 128000000]) {
      expect(reaisTextoParaCentavos(centavosParaReaisInput(centavos))).toBe(centavos);
    }
  });
});
