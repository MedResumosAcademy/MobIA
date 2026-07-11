import { describe, expect, it } from "vitest";
import { pertenceAFila, type EstadoConversa } from "./atendimento-nucleo";

const EU = "user-1";
const COLEGA = "user-2";

const conversa = (parcial: Partial<EstadoConversa>): EstadoConversa => ({
  atendimento: "humano",
  atribuidoA: null,
  naoLidas: 0,
  ...parcial,
});

describe("pertenceAFila", () => {
  it("precisam: humano com não lidas (inclui escaladas pela IA)", () => {
    expect(pertenceAFila(conversa({ naoLidas: 2 }), "precisam", EU)).toBe(true);
    // Escalada: o pipeline volta para humano E restaura nao_lidas > 0.
    expect(pertenceAFila(conversa({ atendimento: "humano", naoLidas: 1 }), "precisam", EU)).toBe(
      true,
    );
  });

  it("precisam: humano já lido NÃO precisa; IA com não lidas também não", () => {
    expect(pertenceAFila(conversa({ naoLidas: 0 }), "precisam", EU)).toBe(false);
    expect(
      pertenceAFila(conversa({ atendimento: "ia", naoLidas: 3 }), "precisam", EU),
    ).toBe(false);
  });

  it("ia: só quando a IA atende agora", () => {
    expect(pertenceAFila(conversa({ atendimento: "ia" }), "ia", EU)).toBe(true);
    expect(pertenceAFila(conversa({ atendimento: "humano" }), "ia", EU)).toBe(false);
    expect(pertenceAFila(conversa({ atendimento: "resolvido" }), "ia", EU)).toBe(false);
  });

  it("minhas: atribuídas a MIM e não resolvidas", () => {
    expect(pertenceAFila(conversa({ atribuidoA: EU }), "minhas", EU)).toBe(true);
    expect(pertenceAFila(conversa({ atribuidoA: COLEGA }), "minhas", EU)).toBe(false);
    expect(pertenceAFila(conversa({ atribuidoA: null }), "minhas", EU)).toBe(false);
    expect(
      pertenceAFila(conversa({ atribuidoA: EU, atendimento: "resolvido" }), "minhas", EU),
    ).toBe(false);
  });

  it("todas: tudo entra (inclusive resolvidas)", () => {
    expect(pertenceAFila(conversa({ atendimento: "resolvido" }), "todas", EU)).toBe(true);
    expect(pertenceAFila(conversa({ atendimento: "ia" }), "todas", EU)).toBe(true);
  });
});
