// Testes do limitador de taxa (janela deslizante em memória) que protege as
// superfícies de IA paga (assistente 30/min, WhatsApp 20/min). O Map é
// módulo-level, então cada teste reimporta o módulo (vi.resetModules) para
// isolar estado; o relógio é falso (vi.useFakeTimers) — sem IO, sem flakiness.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type ModuloLimitador = typeof import("@/lib/seguranca/limitador");

let permitido: ModuloLimitador["permitido"];

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-11T12:00:00Z"));
  vi.resetModules();
  ({ permitido } = await import("@/lib/seguranca/limitador"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("permitido", () => {
  it("permite exatamente N chamadas na janela e nega a N+1", () => {
    for (let i = 0; i < 30; i += 1) {
      expect(permitido("assistente:u1", 30, 60_000)).toBe(true);
    }
    expect(permitido("assistente:u1", 30, 60_000)).toBe(false);
  });

  it("janela DESLIZANTE: chamadas antigas expiram individualmente", () => {
    // 15 chamadas em t=0 e 15 em t=30s ⇒ em t=59s a janela ainda está cheia;
    // em t=61s as 15 primeiras expiraram e volta a permitir.
    for (let i = 0; i < 15; i += 1) {
      expect(permitido("k", 30, 60_000)).toBe(true);
    }
    vi.advanceTimersByTime(30_000);
    for (let i = 0; i < 15; i += 1) {
      expect(permitido("k", 30, 60_000)).toBe(true);
    }
    vi.advanceTimersByTime(29_000); // t = 59s
    expect(permitido("k", 30, 60_000)).toBe(false);
    vi.advanceTimersByTime(2_000); // t = 61s
    expect(permitido("k", 30, 60_000)).toBe(true);
  });

  it("negação NÃO consome slot nem estende o bloqueio", () => {
    for (let i = 0; i < 5; i += 1) {
      expect(permitido("k", 5, 60_000)).toBe(true);
    }
    // Martela negado várias vezes: nada disso deve empurrar a janela.
    for (let i = 0; i < 10; i += 1) {
      expect(permitido("k", 5, 60_000)).toBe(false);
    }
    vi.advanceTimersByTime(60_001); // as 5 permitidas expiraram
    expect(permitido("k", 5, 60_000)).toBe(true);
  });

  it("chaves independentes não interferem entre si", () => {
    expect(permitido("u1", 1, 60_000)).toBe(true);
    expect(permitido("u1", 1, 60_000)).toBe(false);
    expect(permitido("u2", 1, 60_000)).toBe(true);
  });

  it("COMPORTAMENTO ACEITO: estourar MAX_CHAVES zera o Map inteiro, reabrindo a janela de quem estava bloqueado", () => {
    // Proteção leve contra crescimento sem fim: ao inserir a chave 10.001,
    // o clear() reseta TODOS os contadores — inclusive o de um usuário
    // bloqueado naquele instante. Cravado aqui para não virar surpresa.
    expect(permitido("bloqueado", 1, 60_000)).toBe(true);
    expect(permitido("bloqueado", 1, 60_000)).toBe(false);
    for (let i = 0; i < 9_999; i += 1) {
      permitido(`enchimento:${i}`, 1, 60_000); // Map chega a 10.000 chaves
    }
    expect(permitido("chave-nova", 1, 60_000)).toBe(true); // dispara o clear()
    expect(permitido("bloqueado", 1, 60_000)).toBe(true); // janela reaberta
  });
});
