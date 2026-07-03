import { describe, expect, it } from "vitest";
import { calcularProgressoMeta } from "./metas";

describe("calcularProgressoMeta", () => {
  it("alvo 0 ⇒ progresso 0 (evita divisão por zero)", () => {
    expect(calcularProgressoMeta(0, 0)).toEqual({ progresso: 0, atingida: true });
    expect(calcularProgressoMeta(0, 5)).toEqual({ progresso: 0, atingida: true });
  });

  it("atual 0 ⇒ progresso 0, não atingida", () => {
    expect(calcularProgressoMeta(10, 0)).toEqual({ progresso: 0, atingida: false });
  });

  it("progresso parcial", () => {
    expect(calcularProgressoMeta(10, 4)).toEqual({ progresso: 0.4, atingida: false });
    expect(calcularProgressoMeta(4, 1)).toEqual({ progresso: 0.25, atingida: false });
  });

  it("atual == alvo ⇒ progresso 1, atingida", () => {
    expect(calcularProgressoMeta(10, 10)).toEqual({ progresso: 1, atingida: true });
  });

  it("atual acima do alvo ⇒ progresso cap em 1, atingida", () => {
    expect(calcularProgressoMeta(10, 25)).toEqual({ progresso: 1, atingida: true });
  });

  it("atual negativo ⇒ progresso piso 0, não atingida", () => {
    expect(calcularProgressoMeta(10, -5)).toEqual({ progresso: 0, atingida: false });
  });
});
