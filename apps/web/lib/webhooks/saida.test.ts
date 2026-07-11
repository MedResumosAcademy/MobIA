import { describe, expect, it } from "vitest";
import { assinarCorpoWebhook } from "./saida";

describe("assinarCorpoWebhook", () => {
  it("bate com o vetor de teste oficial do HMAC-SHA256 (RFC 4231, caso 2)", () => {
    expect(assinarCorpoWebhook("what do ya want for nothing?", "Jefe")).toBe(
      "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
    );
  });

  it("é determinística para o mesmo corpo+segredo", () => {
    const corpo = JSON.stringify({ evento: "contato.criado", dados: { a: 1 } });
    expect(assinarCorpoWebhook(corpo, "s3gr3do")).toBe(
      assinarCorpoWebhook(corpo, "s3gr3do"),
    );
  });

  it("muda com qualquer alteração no corpo ou no segredo", () => {
    const base = assinarCorpoWebhook("corpo", "segredo");
    expect(assinarCorpoWebhook("corpo!", "segredo")).not.toBe(base);
    expect(assinarCorpoWebhook("corpo", "segredo2")).not.toBe(base);
  });

  it("devolve hex de 64 caracteres (sha256)", () => {
    expect(assinarCorpoWebhook("x", "y")).toMatch(/^[0-9a-f]{64}$/);
  });
});
