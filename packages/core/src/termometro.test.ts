import { describe, expect, it } from "vitest";
import type { SinaisLead } from "@mobia/domain";
import {
  calcularTemperatura,
  LIMIARES_TERMOMETRO,
  PESOS_TERMOMETRO,
} from "./termometro";

const ZERO: SinaisLead = {
  visitas: 0,
  simulacoes: 0,
  favoritos: 0,
  cliquesFinanciamento: 0,
  retornos: 0,
};

function sinais(parcial: Partial<SinaisLead>): SinaisLead {
  return { ...ZERO, ...parcial };
}

describe("calcularTemperatura", () => {
  it("sinais zerados ⇒ score 0 e 'quente'", () => {
    expect(calcularTemperatura(ZERO)).toEqual({ temperatura: "quente", score: 0 });
  });

  it("sinais mínimos (1 visita) ⇒ 'quente'", () => {
    const r = calcularTemperatura(sinais({ visitas: 1 }));
    expect(r.score).toBe(PESOS_TERMOMETRO.visitas);
    expect(r.temperatura).toBe("quente");
  });

  it("muitas visitas + favoritos, sem intenção forte ⇒ 'muito_quente'", () => {
    // 3 visitas (3) + 2 favoritos (6) = 9: >= muitoQuente (6), < pronto (12),
    // sem clique_financiamento nem simulações suficientes.
    const r = calcularTemperatura(sinais({ visitas: 3, favoritos: 2 }));
    expect(r.score).toBe(3 * 1 + 2 * 3);
    expect(r.temperatura).toBe("muito_quente");
  });

  it("clique em financiamento presente ⇒ 'pronto_para_compra' (atalho)", () => {
    const r = calcularTemperatura(sinais({ cliquesFinanciamento: 1 }));
    expect(r.temperatura).toBe("pronto_para_compra");
  });

  it(`>= ${LIMIARES_TERMOMETRO.simulacoesParaPronto} simulações ⇒ 'pronto_para_compra' (atalho), mesmo com score baixo`, () => {
    const r = calcularTemperatura(sinais({ simulacoes: LIMIARES_TERMOMETRO.simulacoesParaPronto }));
    expect(r.temperatura).toBe("pronto_para_compra");
  });

  it("score alto por acúmulo (sem atalho) ⇒ 'pronto_para_compra'", () => {
    // 4 retornos (16) >= pronto (12); 0 cliques financiamento, < N simulações.
    const r = calcularTemperatura(sinais({ retornos: 4 }));
    expect(r.score).toBe(4 * PESOS_TERMOMETRO.retornos);
    expect(r.score).toBeGreaterThanOrEqual(LIMIARES_TERMOMETRO.pronto);
    expect(r.temperatura).toBe("pronto_para_compra");
  });

  describe("fronteiras exatas dos limiares", () => {
    it("score = muitoQuente - 1 ⇒ 'quente'; = muitoQuente ⇒ 'muito_quente'", () => {
      // Constrói scores exatos usando visitas (peso 1).
      const abaixo = calcularTemperatura(sinais({ visitas: LIMIARES_TERMOMETRO.muitoQuente - 1 }));
      expect(abaixo.score).toBe(LIMIARES_TERMOMETRO.muitoQuente - 1);
      expect(abaixo.temperatura).toBe("quente");

      const naFronteira = calcularTemperatura(sinais({ visitas: LIMIARES_TERMOMETRO.muitoQuente }));
      expect(naFronteira.score).toBe(LIMIARES_TERMOMETRO.muitoQuente);
      expect(naFronteira.temperatura).toBe("muito_quente");
    });

    it("score = pronto - 1 ⇒ 'muito_quente'; = pronto ⇒ 'pronto_para_compra'", () => {
      const abaixo = calcularTemperatura(sinais({ visitas: LIMIARES_TERMOMETRO.pronto - 1 }));
      expect(abaixo.score).toBe(LIMIARES_TERMOMETRO.pronto - 1);
      expect(abaixo.temperatura).toBe("muito_quente");

      const naFronteira = calcularTemperatura(sinais({ visitas: LIMIARES_TERMOMETRO.pronto }));
      expect(naFronteira.score).toBe(LIMIARES_TERMOMETRO.pronto);
      expect(naFronteira.temperatura).toBe("pronto_para_compra");
    });

    it(`${LIMIARES_TERMOMETRO.simulacoesParaPronto - 1} simulações NÃO dispara o atalho de simulação`, () => {
      // Isola o atalho de simulação: com N-1 simulações o resultado depende só do score.
      const n = LIMIARES_TERMOMETRO.simulacoesParaPronto - 1;
      const r = calcularTemperatura(sinais({ simulacoes: n }));
      const scoreEsperado = n * PESOS_TERMOMETRO.simulacoes;
      expect(r.score).toBe(scoreEsperado);
      // Não deve ser 'pronto' POR CAUSA do atalho de simulação; só se o score alcançar.
      if (scoreEsperado < LIMIARES_TERMOMETRO.pronto) {
        expect(r.temperatura).not.toBe("pronto_para_compra");
      }
    });
  });

  describe("monotonicidade: mais sinal ⇒ score não decresce", () => {
    const base: SinaisLead = {
      visitas: 2,
      simulacoes: 1,
      favoritos: 1,
      cliquesFinanciamento: 0,
      retornos: 1,
    };
    const chaves: (keyof SinaisLead)[] = [
      "visitas",
      "simulacoes",
      "favoritos",
      "cliquesFinanciamento",
      "retornos",
    ];

    for (const chave of chaves) {
      it(`incrementar ${chave} não reduz o score`, () => {
        const antes = calcularTemperatura(base).score;
        const depois = calcularTemperatura({ ...base, [chave]: base[chave] + 1 }).score;
        expect(depois).toBeGreaterThanOrEqual(antes);
        // Como todos os pesos são positivos, incrementar SEMPRE aumenta.
        expect(depois).toBe(antes + PESOS_TERMOMETRO[chave]);
      });
    }
  });

  describe("validação de entrada", () => {
    it("rejeita sinal negativo", () => {
      expect(() => calcularTemperatura(sinais({ visitas: -1 }))).toThrow(RangeError);
    });

    it("rejeita sinal não inteiro", () => {
      expect(() => calcularTemperatura(sinais({ simulacoes: 1.5 }))).toThrow(RangeError);
    });
  });
});
