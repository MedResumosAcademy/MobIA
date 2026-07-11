// Testes PUROS da convenção de horário do produto (America/Sao_Paulo).
// Fuso já causou bug real aqui: estes casos cravam o contrato de cada helper
// sem nenhum mock — o instante entra sempre por parâmetro.
import { describe, expect, it } from "vitest";
import {
  diaSaoPaulo,
  instanteDeParedeSaoPaulo,
  intervaloDoDiaSaoPaulo,
  isoSaoPaulo,
  offsetSaoPaulo,
} from "@/lib/fuso";

describe("isoSaoPaulo", () => {
  it("converte um instante UTC para o relógio de São Paulo (UTC-3)", () => {
    expect(isoSaoPaulo(new Date("2026-07-11T18:00:00Z"))).toBe(
      "2026-07-11T15:00:00-03:00",
    );
  });

  it("faz round-trip: o ISO gerado representa o MESMO instante", () => {
    const instante = new Date("2026-01-15T04:30:00Z");
    expect(new Date(isoSaoPaulo(instante)).getTime()).toBe(instante.getTime());
  });
});

describe("diaSaoPaulo", () => {
  it("madrugada UTC cai no dia ANTERIOR de São Paulo", () => {
    // 02:00Z = 23:00-03:00 do dia anterior.
    expect(diaSaoPaulo(new Date("2026-07-11T02:00:00Z"))).toBe("2026-07-10");
  });

  it("aceita string ISO e devolve o dia do relógio brasileiro", () => {
    expect(diaSaoPaulo("2026-07-11T18:00:00Z")).toBe("2026-07-11");
  });

  it('entrada inválida devolve "" (nunca lança)', () => {
    expect(diaSaoPaulo("lixo")).toBe("");
  });
});

describe("intervaloDoDiaSaoPaulo", () => {
  it("devolve os limites de parede do dia com offset explícito", () => {
    const { deISO, ateISO } = intervaloDoDiaSaoPaulo("2026-07-11");
    expect(deISO).toBe("2026-07-11T00:00:00.000-03:00");
    expect(ateISO).toBe("2026-07-11T23:59:59.999-03:00");
  });

  it("os limites são instantes reais e ateISO > deISO", () => {
    const { deISO, ateISO } = intervaloDoDiaSaoPaulo("2026-07-11");
    const de = new Date(deISO);
    const ate = new Date(ateISO);
    expect(Number.isNaN(de.getTime())).toBe(false);
    expect(Number.isNaN(ate.getTime())).toBe(false);
    expect(ate.getTime()).toBeGreaterThan(de.getTime());
  });
});

describe("instanteDeParedeSaoPaulo", () => {
  it("monta o instante da parede brasileira e round-tripa com diaSaoPaulo", () => {
    const iso = instanteDeParedeSaoPaulo("2026-07-11", "15:00");
    expect(iso).toBe("2026-07-11T15:00:00.000-03:00");
    expect(diaSaoPaulo(new Date(iso))).toBe("2026-07-11");
  });
});

describe("offsetSaoPaulo", () => {
  it("sempre devolve um offset no formato ±HH:MM", () => {
    const instantes = [
      new Date("2026-01-01T00:00:00Z"), // verão brasileiro
      new Date("2026-07-11T12:00:00Z"), // inverno brasileiro
      new Date("2030-12-31T23:59:59Z"),
    ];
    for (const instante of instantes) {
      expect(offsetSaoPaulo(instante)).toMatch(/^[+-]\d{2}:\d{2}$/);
    }
  });

  it("sem horário de verão vigente, o offset é -03:00", () => {
    expect(offsetSaoPaulo(new Date("2026-07-11T12:00:00Z"))).toBe("-03:00");
  });
});
