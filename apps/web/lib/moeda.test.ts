// Testes do contrato das DUAS variantes de vazio do FormData → centavos:
// null (negócio sem valor) vs 0 (imóvel: valor NOT NULL com default 0).
// O parser pesado (reaisTextoParaCentavos) é testado no @imobia/core.
import { describe, expect, it } from "vitest";
import { reaisParaCentavosOuNull, reaisParaCentavosOuZero } from "@/lib/moeda";

describe("reaisParaCentavosOuNull (negócio sem valor)", () => {
  it("null, vazio e só espaços viram null", () => {
    expect(reaisParaCentavosOuNull(null)).toBeNull();
    expect(reaisParaCentavosOuNull("")).toBeNull();
    expect(reaisParaCentavosOuNull("   ")).toBeNull();
  });

  it("texto preenchido delega ao parser do core (centavos)", () => {
    expect(reaisParaCentavosOuNull("1.280.000,00")).toBe(128_000_000);
    expect(reaisParaCentavosOuNull("850000")).toBe(85_000_000);
  });
});

describe("reaisParaCentavosOuZero (imóvel: NOT NULL default 0)", () => {
  it("null, vazio e só espaços viram 0", () => {
    expect(reaisParaCentavosOuZero(null)).toBe(0);
    expect(reaisParaCentavosOuZero("")).toBe(0);
    expect(reaisParaCentavosOuZero("   ")).toBe(0);
  });

  it("texto preenchido delega ao parser do core (centavos)", () => {
    expect(reaisParaCentavosOuZero("1.280.000,00")).toBe(128_000_000);
  });
});
