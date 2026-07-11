// Testes do parse resiliente do cookie 'imobia_capacidade' — entrada NÃO
// confiável (o cliente pode mandar qualquer coisa): nunca lança, null no lixo.
import { describe, expect, it } from "vitest";
import { lerCookieCapacidade } from "@/lib/capacidade-cookie";

describe("lerCookieCapacidade", () => {
  it("cookie ausente ou vazio ⇒ null", () => {
    expect(lerCookieCapacidade(undefined)).toBeNull();
    expect(lerCookieCapacidade("")).toBeNull();
  });

  it("JSON malformado ⇒ null (nunca lança)", () => {
    expect(lerCookieCapacidade("{lixo")).toBeNull();
    expect(lerCookieCapacidade("não é json")).toBeNull();
  });

  it("valor com tipo errado ⇒ null", () => {
    expect(lerCookieCapacidade('{"valor":"abc"}')).toBeNull();
    expect(lerCookieCapacidade('{"criadoEm":"2026-07-11"}')).toBeNull();
    expect(lerCookieCapacidade("null")).toBeNull();
  });

  it("valor não finito ⇒ null (1e999 parseia como Infinity)", () => {
    expect(lerCookieCapacidade('{"valor":1e999}')).toBeNull();
  });

  it("valor numérico finito ⇒ centavos", () => {
    expect(lerCookieCapacidade('{"valor":85000000,"criadoEm":"2026-07-11"}')).toBe(85_000_000);
    expect(lerCookieCapacidade('{"valor":0}')).toBe(0);
  });
});
