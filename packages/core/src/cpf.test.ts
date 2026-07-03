import { describe, expect, it } from "vitest";
import { formatarCpf, limparCpf, validarCpf } from "./cpf";

describe("limparCpf", () => {
  it("remove máscara padrão", () => {
    expect(limparCpf("529.982.247-25")).toBe("52998224725");
  });

  it("remove qualquer não-dígito (espaços, letras, símbolos)", () => {
    expect(limparCpf(" 529 982 247/25 abc ")).toBe("52998224725");
  });

  it("string vazia ⇒ vazia", () => {
    expect(limparCpf("")).toBe("");
  });
});

describe("validarCpf", () => {
  it("aceita CPFs de teste válidos (sem máscara)", () => {
    expect(validarCpf("52998224725")).toBe(true);
    expect(validarCpf("11144477735")).toBe(true);
    expect(validarCpf("12345678909")).toBe(true);
  });

  it("aceita CPF válido com máscara", () => {
    expect(validarCpf("529.982.247-25")).toBe(true);
  });

  it("rejeita primeiro dígito verificador errado", () => {
    expect(validarCpf("52998224735")).toBe(false);
  });

  it("rejeita segundo dígito verificador errado", () => {
    expect(validarCpf("52998224726")).toBe(false);
  });

  it("rejeita CPF com máscara e dígito errado", () => {
    expect(validarCpf("123.456.789-00")).toBe(false);
  });

  it("rejeita todas as sequências de dígitos repetidos", () => {
    for (let d = 0; d <= 9; d++) {
      expect(validarCpf(String(d).repeat(11))).toBe(false);
    }
  });

  it("rejeita curto, longo e vazio", () => {
    expect(validarCpf("5299822472")).toBe(false);
    expect(validarCpf("529982247255")).toBe(false);
    expect(validarCpf("")).toBe(false);
  });

  it("rejeita string sem dígitos suficientes mesmo com símbolos", () => {
    expect(validarCpf("abc.def.ghi-jk")).toBe(false);
  });
});

describe("formatarCpf", () => {
  it("formata CPF sem máscara", () => {
    expect(formatarCpf("52998224725")).toBe("529.982.247-25");
  });

  it("reformata CPF já mascarado (idempotente)", () => {
    expect(formatarCpf("529.982.247-25")).toBe("529.982.247-25");
  });

  it("input com tamanho inválido ⇒ retorna o input limpo", () => {
    expect(formatarCpf("12345")).toBe("12345");
    expect(formatarCpf("123.45")).toBe("12345");
    expect(formatarCpf("")).toBe("");
  });

  it("formata mesmo CPF com verificadores errados (formatação não valida)", () => {
    expect(formatarCpf("52998224799")).toBe("529.982.247-99");
  });
});
