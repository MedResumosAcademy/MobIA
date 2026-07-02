import { describe, expect, it } from "vitest";
import {
  CENTAVOS_POR_XP_VENDA,
  LIMIARES_NIVEL,
  LIMIAR_MILIONARIO_CENTAVOS,
  XP_POR_EM_ABERTO,
  XP_POR_GANHO,
  calcularGamificacao,
  calcularXp,
  type StatsGamificacao,
} from "./gamificacao";

const conquista = (r: ReturnType<typeof calcularGamificacao>, id: string) =>
  r.conquistas.find((c) => c.id === id)!;

describe("calcularGamificacao — stats zerados", () => {
  it("xp 0, nível 1, progresso 0 e nenhuma conquista", () => {
    const r = calcularGamificacao({ negociosGanhos: 0, valorVendido: 0 });
    expect(r.xp).toBe(0);
    expect(r.nivel).toBe(1);
    expect(r.xpNoNivel).toBe(0);
    expect(r.progresso).toBe(0);
    expect(r.conquistas).toHaveLength(5);
    expect(r.conquistas.every((c) => !c.desbloqueada)).toBe(true);
  });
});

describe("calcularXp — fórmula", () => {
  it("compõe ganhos*100 + floor(valor/1.000.000) + emAberto*10", () => {
    const stats: StatsGamificacao = {
      negociosGanhos: 5,
      valorVendido: 100_000_000, // R$ 1 mi ⇒ 100 XP
      negociosEmAberto: 3,
    };
    // 5*100 + 100 + 3*10 = 630
    expect(calcularXp(stats)).toBe(630);
  });

  it("1 XP a cada R$ 10.000 vendidos (divisor CENTAVOS_POR_XP_VENDA)", () => {
    // R$ 10.000 = 1.000.000 centavos ⇒ exatamente 1 XP.
    expect(calcularXp({ negociosGanhos: 0, valorVendido: CENTAVOS_POR_XP_VENDA })).toBe(1);
    // Abaixo do divisor arredonda para baixo ⇒ 0 XP.
    expect(
      calcularXp({ negociosGanhos: 0, valorVendido: CENTAVOS_POR_XP_VENDA - 1 }),
    ).toBe(0);
  });

  it("usa constantes exportadas coerentes", () => {
    expect(XP_POR_GANHO).toBe(100);
    expect(XP_POR_EM_ABERTO).toBe(10);
    expect(calcularXp({ negociosGanhos: 2, valorVendido: 0, negociosEmAberto: 4 })).toBe(
      2 * XP_POR_GANHO + 4 * XP_POR_EM_ABERTO,
    );
  });
});

describe("calcularGamificacao — níveis e progresso", () => {
  it("limiares crescentes: L1=0, L2=100, L3=300, L4=600, L5=1000", () => {
    expect(LIMIARES_NIVEL[0]).toBe(0);
    expect(LIMIARES_NIVEL[1]).toBe(100);
    expect(LIMIARES_NIVEL[2]).toBe(300);
    expect(LIMIARES_NIVEL[3]).toBe(600);
    expect(LIMIARES_NIVEL[4]).toBe(1000);
  });

  it("xp 630 ⇒ nível 4, xpNoNivel 30, xpParaProximo 400, progresso 0.075", () => {
    const r = calcularGamificacao({
      negociosGanhos: 5,
      valorVendido: 100_000_000,
      negociosEmAberto: 3,
    });
    expect(r.xp).toBe(630);
    expect(r.nivel).toBe(4);
    expect(r.xpNoNivel).toBe(30);
    expect(r.xpParaProximoNivel).toBe(400);
    expect(r.progresso).toBeCloseTo(0.075, 10);
  });

  it("exatamente no limiar do nível ⇒ sobe de nível com progresso 0", () => {
    // xp 100 = limiar do nível 2.
    const r = calcularGamificacao({ negociosGanhos: 1, valorVendido: 0 });
    expect(r.xp).toBe(100);
    expect(r.nivel).toBe(2);
    expect(r.xpNoNivel).toBe(0);
    expect(r.progresso).toBe(0);
  });
});

describe("calcularGamificacao — fronteiras de conquista", () => {
  it("1 ganho desbloqueia primeira_venda (não vendedor)", () => {
    const r = calcularGamificacao({ negociosGanhos: 1, valorVendido: 0 });
    expect(conquista(r, "primeira_venda").desbloqueada).toBe(true);
    expect(conquista(r, "vendedor").desbloqueada).toBe(false);
  });

  it("4 ganhos ainda NÃO desbloqueia vendedor; 5 desbloqueia", () => {
    expect(
      conquista(calcularGamificacao({ negociosGanhos: 4, valorVendido: 0 }), "vendedor")
        .desbloqueada,
    ).toBe(false);
    expect(
      conquista(calcularGamificacao({ negociosGanhos: 5, valorVendido: 0 }), "vendedor")
        .desbloqueada,
    ).toBe(true);
  });

  it("10 ganhos desbloqueia top_closer", () => {
    const r = calcularGamificacao({ negociosGanhos: 10, valorVendido: 0 });
    expect(conquista(r, "top_closer").desbloqueada).toBe(true);
  });

  it("R$ 1 mi exato desbloqueia milionário; 1 centavo a menos não", () => {
    expect(
      conquista(
        calcularGamificacao({ negociosGanhos: 0, valorVendido: LIMIAR_MILIONARIO_CENTAVOS }),
        "milionario",
      ).desbloqueada,
    ).toBe(true);
    expect(
      conquista(
        calcularGamificacao({
          negociosGanhos: 0,
          valorVendido: LIMIAR_MILIONARIO_CENTAVOS - 1,
        }),
        "milionario",
      ).desbloqueada,
    ).toBe(false);
  });

  it("taxaConversao 0.7 exata desbloqueia consistente; ausente não", () => {
    expect(
      conquista(
        calcularGamificacao({ negociosGanhos: 0, valorVendido: 0, taxaConversao: 0.7 }),
        "consistente",
      ).desbloqueada,
    ).toBe(true);
    expect(
      conquista(
        calcularGamificacao({ negociosGanhos: 0, valorVendido: 0 }),
        "consistente",
      ).desbloqueada,
    ).toBe(false);
  });
});

describe("calcularGamificacao — monotonicidade", () => {
  it("mais ganhos ⇒ xp não decresce", () => {
    let anterior = -1;
    for (let ganhos = 0; ganhos <= 20; ganhos += 1) {
      const xp = calcularGamificacao({ negociosGanhos: ganhos, valorVendido: 0 }).xp;
      expect(xp).toBeGreaterThanOrEqual(anterior);
      anterior = xp;
    }
  });

  it("mais valor vendido ⇒ xp não decresce", () => {
    let anterior = -1;
    for (let mi = 0; mi <= 10; mi += 1) {
      const xp = calcularGamificacao({
        negociosGanhos: 0,
        valorVendido: mi * 10_000_000,
      }).xp;
      expect(xp).toBeGreaterThanOrEqual(anterior);
      anterior = xp;
    }
  });
});
