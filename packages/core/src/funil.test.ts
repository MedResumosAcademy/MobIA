import { describe, expect, it } from "vitest";
import { ETAPAS_NEGOCIO } from "@imobia/domain";
import { resumoFunil, type NegocioFunil } from "./funil";

describe("resumoFunil", () => {
  it("funil vazio ⇒ tudo zerado e conversão 0", () => {
    const r = resumoFunil([]);
    expect(r.abertos).toBe(0);
    expect(r.ganhos).toBe(0);
    expect(r.perdidos).toBe(0);
    expect(r.valorEmAberto).toBe(0);
    expect(r.valorGanho).toBe(0);
    expect(r.taxaConversao).toBe(0);
    // Todas as etapas presentes e zeradas.
    for (const etapa of ETAPAS_NEGOCIO) {
      expect(r.porEtapa[etapa]).toEqual({ quantidade: 0, valor: 0 });
    }
  });

  it("mix de etapas soma quantidade e valor certo por etapa", () => {
    const negocios: NegocioFunil[] = [
      { etapa: "novo", valor: 10_000 },
      { etapa: "novo", valor: 5_000 },
      { etapa: "visita", valor: 20_000 },
      { etapa: "proposta", valor: 30_000, resultado: null },
    ];
    const r = resumoFunil(negocios);
    expect(r.porEtapa.novo).toEqual({ quantidade: 2, valor: 15_000 });
    expect(r.porEtapa.visita).toEqual({ quantidade: 1, valor: 20_000 });
    expect(r.porEtapa.proposta).toEqual({ quantidade: 1, valor: 30_000 });
    expect(r.porEtapa.contato).toEqual({ quantidade: 0, valor: 0 });
    expect(r.porEtapa.fechamento).toEqual({ quantidade: 0, valor: 0 });
  });

  it("ganhos/perdidos e taxaConversao: 2 ganhos + 1 perdido ⇒ 0.666…", () => {
    const negocios: NegocioFunil[] = [
      { etapa: "fechamento", resultado: "ganho", valor: 100_000 },
      { etapa: "fechamento", resultado: "ganho", valor: 200_000 },
      { etapa: "fechamento", resultado: "perdido", valor: 50_000 },
    ];
    const r = resumoFunil(negocios);
    expect(r.ganhos).toBe(2);
    expect(r.perdidos).toBe(1);
    expect(r.abertos).toBe(0);
    expect(r.taxaConversao).toBeCloseTo(2 / 3, 10);
    expect(r.valorGanho).toBe(300_000);
  });

  it("valorEmAberto exclui fechados (ganho/perdido)", () => {
    const negocios: NegocioFunil[] = [
      { etapa: "novo", valor: 10_000 }, // aberto
      { etapa: "contato", valor: 7_000, resultado: null }, // aberto
      { etapa: "fechamento", valor: 999_999, resultado: "ganho" }, // fechado
      { etapa: "proposta", valor: 888_888, resultado: "perdido" }, // fechado
    ];
    const r = resumoFunil(negocios);
    expect(r.abertos).toBe(2);
    expect(r.valorEmAberto).toBe(17_000);
    expect(r.valorGanho).toBe(999_999);
  });

  it("negócios sem valor contam quantidade mas somam valor 0", () => {
    const negocios: NegocioFunil[] = [
      { etapa: "novo" }, // valor undefined
      { etapa: "novo", valor: null }, // valor null
      { etapa: "novo", valor: 4_000 },
    ];
    const r = resumoFunil(negocios);
    expect(r.porEtapa.novo).toEqual({ quantidade: 3, valor: 4_000 });
    expect(r.abertos).toBe(3);
    expect(r.valorEmAberto).toBe(4_000);
  });

  it("ganho sem valor: conta ganho, valorGanho não soma", () => {
    const r = resumoFunil([{ etapa: "fechamento", resultado: "ganho" }]);
    expect(r.ganhos).toBe(1);
    expect(r.valorGanho).toBe(0);
    expect(r.taxaConversao).toBe(1);
  });

  it("só perdidos ⇒ taxaConversao 0 (sem divisão inválida)", () => {
    const r = resumoFunil([{ etapa: "proposta", resultado: "perdido", valor: 1_000 }]);
    expect(r.taxaConversao).toBe(0);
  });
});
