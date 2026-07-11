// Testes da montagem PURA da fila de prioridades da central de comando —
// ranqueamento, dedup de leads com negócio aberto e truncamento, sem banco.
import { describe, expect, it } from "vitest";
import {
  montarFila,
  type LeadParaFila,
  type NegocioParaFila,
  type TarefaParaFila,
} from "@/lib/dados/prioridades-fila";

function negocio(sobrescreve: Partial<NegocioParaFila> = {}): NegocioParaFila {
  return {
    id: "n1",
    nomeContato: "Ana Silva",
    resultado: null,
    atencao: "ok",
    diasSemMovimento: 0,
    imovelTitulo: null,
    leadId: null,
    ...sobrescreve,
  };
}

function tarefa(sobrescreve: Partial<TarefaParaFila> = {}): TarefaParaFila {
  return {
    id: "t1",
    titulo: "Enviar contrato",
    venceEm: "2026-07-01",
    negocioId: "n1",
    negocioNomeContato: "Ana Silva",
    atrasada: true,
    ...sobrescreve,
  };
}

function lead(sobrescreve: Partial<LeadParaFila> = {}): LeadParaFila {
  return {
    id: "l1",
    clienteNome: "Bruno",
    imovelTitulo: "Apartamento no Centro",
    temperatura: "pronto_para_compra",
    ...sobrescreve,
  };
}

describe("montarFila", () => {
  it("tarefa atrasada (crítico) fica acima de negócio em atenção (alto)", () => {
    const fila = montarFila(
      [negocio({ id: "n1", atencao: "atencao", diasSemMovimento: 8 })],
      [tarefa({ id: "t1" })],
      [],
    );
    expect(fila.map((i) => i.categoria)).toEqual(["tarefa_atrasada", "negocio_parado"]);
    expect(fila[0]?.nivel).toBe("critico");
    expect(fila[1]?.nivel).toBe("alto");
  });

  it("no MESMO nível, negócio parado vem antes de tarefa atrasada", () => {
    const fila = montarFila(
      [negocio({ id: "n1", atencao: "parado", diasSemMovimento: 20 })],
      [tarefa({ id: "t1" })],
      [],
    );
    expect(fila.map((i) => i.categoria)).toEqual(["negocio_parado", "tarefa_atrasada"]);
    expect(fila.every((i) => i.nivel === "critico")).toBe(true);
  });

  it("lead pronto_para_compra COM negócio ABERTO vinculado não entra; com negócio FECHADO entra", () => {
    const comAberto = montarFila(
      [negocio({ id: "n1", leadId: "l1" })],
      [],
      [lead({ id: "l1" })],
    );
    expect(comAberto).toHaveLength(0);

    const comFechado = montarFila(
      [negocio({ id: "n1", leadId: "l1", resultado: "ganho" })],
      [],
      [lead({ id: "l1" })],
    );
    expect(comFechado.map((i) => i.id)).toEqual(["lead_quente:l1"]);
    expect(comFechado[0]?.nivel).toBe("medio");
  });

  it("lead sem temperatura de compra não entra", () => {
    const fila = montarFila([], [], [lead({ temperatura: "quente" })]);
    expect(fila).toHaveLength(0);
  });

  it("negócio FECHADO com atencao='parado' não entra", () => {
    const fila = montarFila(
      [negocio({ atencao: "parado", resultado: "perdido", diasSemMovimento: 30 })],
      [],
      [],
    );
    expect(fila).toHaveLength(0);
  });

  it("tarefa não atrasada não entra", () => {
    const fila = montarFila([], [tarefa({ atrasada: false })], []);
    expect(fila).toHaveLength(0);
  });

  it("trunca em 10 itens, preservando os mais urgentes", () => {
    const tarefas = Array.from({ length: 8 }, (_, i) => tarefa({ id: `t${i}` }));
    const leads = Array.from({ length: 7 }, (_, i) => lead({ id: `l${i}` }));
    const fila = montarFila([], tarefas, leads);
    expect(fila).toHaveLength(10);
    // 8 críticos (tarefas) primeiro; só 2 leads médios sobrevivem ao corte.
    expect(fila.filter((i) => i.categoria === "tarefa_atrasada")).toHaveLength(8);
    expect(fila.filter((i) => i.categoria === "lead_quente")).toHaveLength(2);
  });

  it("subtítulos carregam o contexto acionável", () => {
    const fila = montarFila(
      [
        negocio({
          id: "n9",
          atencao: "parado",
          diasSemMovimento: 15,
          imovelTitulo: "Casa com quintal",
        }),
      ],
      [],
      [],
    );
    expect(fila[0]?.subtitulo).toBe("15 dia(s) sem movimento · Casa com quintal");
    expect(fila[0]?.href).toBe("/corretor/negocios/n9");
  });
});
