import { describe, expect, it } from "vitest";
import {
  extrairTokenBearer,
  gerarTokenCaptacao,
  hashTokenCaptacao,
  payloadCaptacaoSchema,
} from "./captacao-nucleo";

describe("payloadCaptacaoSchema", () => {
  it("aceita o payload mínimo (só nome)", () => {
    const r = payloadCaptacaoSchema.safeParse({ nome: "Maria" });
    expect(r.success).toBe(true);
  });

  it("normaliza o telefone para dígitos com DDI 55", () => {
    const r = payloadCaptacaoSchema.parse({
      nome: "Maria",
      telefone: "(11) 98888-7777",
    });
    expect(r.telefone).toBe("5511988887777");
  });

  it("rejeita nome vazio, e-mail inválido e telefone curto", () => {
    expect(payloadCaptacaoSchema.safeParse({ nome: "  " }).success).toBe(false);
    expect(
      payloadCaptacaoSchema.safeParse({ nome: "Ana", email: "nao-e-email" }).success,
    ).toBe(false);
    expect(
      payloadCaptacaoSchema.safeParse({ nome: "Ana", telefone: "123" }).success,
    ).toBe(false);
  });

  it("rejeita chaves desconhecidas (strict) e mensagem longa demais", () => {
    expect(
      payloadCaptacaoSchema.safeParse({ nome: "Ana", orgId: "forjada" }).success,
    ).toBe(false);
    expect(
      payloadCaptacaoSchema.safeParse({ nome: "Ana", mensagem: "x".repeat(2001) })
        .success,
    ).toBe(false);
  });

  it("consentimentoMarketing é opcional e NUNCA assumido", () => {
    const r = payloadCaptacaoSchema.parse({ nome: "Ana" });
    expect(r.consentimentoMarketing).toBeUndefined();
  });
});

describe("extrairTokenBearer", () => {
  it("extrai o token de 'Bearer imob_…'", () => {
    const { token } = gerarTokenCaptacao();
    expect(extrairTokenBearer(`Bearer ${token}`)).toBe(token);
    // Case-insensitive no esquema, como o RFC permite.
    expect(extrairTokenBearer(`bearer ${token}`)).toBe(token);
  });

  it("rejeita ausente, esquema errado e formato fora do padrão", () => {
    expect(extrairTokenBearer(null)).toBeNull();
    expect(extrairTokenBearer("Basic imob_abc123")).toBeNull();
    expect(extrairTokenBearer("Bearer outro_prefixo")).toBeNull();
    expect(extrairTokenBearer("Bearer imob_curto")).toBeNull();
    expect(extrairTokenBearer("Bearer")).toBeNull();
  });
});

describe("hashTokenCaptacao / gerarTokenCaptacao", () => {
  it("hash é o sha256 hex do token completo (vetor conhecido)", () => {
    // sha256("abc") — vetor clássico do FIPS 180-2.
    expect(hashTokenCaptacao("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("geração fecha o ciclo: hash confere e prefixo tem 9 chars do claro", () => {
    const { token, hash, prefixo } = gerarTokenCaptacao();
    expect(token).toMatch(/^imob_[0-9a-f]{48}$/);
    expect(hash).toBe(hashTokenCaptacao(token));
    expect(prefixo).toBe(token.slice(0, 9));
  });

  it("dois tokens gerados nunca coincidem", () => {
    expect(gerarTokenCaptacao().token).not.toBe(gerarTokenCaptacao().token);
  });
});
