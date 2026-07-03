import { describe, expect, it } from "vitest";
import {
  classificarAtencao,
  diasSemMovimento,
  LIMIAR_ATENCAO,
  LIMIAR_PARADO,
} from "./atencao";

describe("diasSemMovimento", () => {
  it("conta dias inteiros entre datas conhecidas", () => {
    expect(diasSemMovimento("2026-07-01T00:00:00.000Z", "2026-07-11T00:00:00.000Z")).toBe(10);
    expect(diasSemMovimento("2026-06-20T00:00:00.000Z", "2026-07-02T00:00:00.000Z")).toBe(12);
  });

  it("hoje == atualizado ⇒ 0", () => {
    expect(diasSemMovimento("2026-07-02T09:30:00.000Z", "2026-07-02T09:30:00.000Z")).toBe(0);
  });

  it("nunca é negativo (atualizado no futuro ⇒ 0)", () => {
    expect(diasSemMovimento("2026-07-10T00:00:00.000Z", "2026-07-02T00:00:00.000Z")).toBe(0);
  });

  it("fração de dia é truncada para baixo", () => {
    expect(diasSemMovimento("2026-07-01T00:00:00.000Z", "2026-07-02T23:59:00.000Z")).toBe(1);
  });
});

describe("classificarAtencao", () => {
  it("fronteiras 0/6/7/13/14 ⇒ ok/ok/atencao/atencao/parado", () => {
    expect(classificarAtencao(0)).toBe("ok");
    expect(classificarAtencao(6)).toBe("ok");
    expect(classificarAtencao(7)).toBe("atencao");
    expect(classificarAtencao(13)).toBe("atencao");
    expect(classificarAtencao(14)).toBe("parado");
  });

  it("limiares nas fronteiras exatas", () => {
    expect(classificarAtencao(LIMIAR_ATENCAO - 1)).toBe("ok");
    expect(classificarAtencao(LIMIAR_ATENCAO)).toBe("atencao");
    expect(classificarAtencao(LIMIAR_PARADO - 1)).toBe("atencao");
    expect(classificarAtencao(LIMIAR_PARADO)).toBe("parado");
  });
});

describe("integração: hoje == atualizado", () => {
  it("0 dias ⇒ ok", () => {
    const dias = diasSemMovimento("2026-07-02T00:00:00.000Z", "2026-07-02T00:00:00.000Z");
    expect(dias).toBe(0);
    expect(classificarAtencao(dias)).toBe("ok");
  });
});
