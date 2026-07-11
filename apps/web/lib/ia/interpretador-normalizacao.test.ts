// Testes da fronteira de segurança contra a saída do LLM: normalizar() e os
// helpers de calendário são puros e determinísticos — sem mock, sem rede.
import { describe, expect, it } from "vitest";
import {
  calendarioProximosDias,
  dataValida,
  diaDaSemanaLocal,
  normalizar,
} from "@/lib/ia/interpretador-normalizacao";

describe("normalizar — dinheiro em CENTAVOS inteiro e não negativo", () => {
  it("criar_negocio com valor float ou negativo é rejeitado", () => {
    expect(normalizar({ intencao: "criar_negocio", contato: "Ana", valor: 1.5 })).toBeNull();
    expect(normalizar({ intencao: "criar_negocio", contato: "Ana", valor: -100 })).toBeNull();
  });

  it("marcar_resultado com valor float ou negativo é rejeitado", () => {
    expect(
      normalizar({ intencao: "marcar_resultado", contato: "Ana", resultado: "ganho", valor: 1.5 }),
    ).toBeNull();
    expect(
      normalizar({ intencao: "marcar_resultado", contato: "Ana", resultado: "ganho", valor: -1 }),
    ).toBeNull();
  });

  it("atualizar_valor exige inteiro ≥ 0", () => {
    expect(normalizar({ intencao: "atualizar_valor", contato: "Ana", valor: 1.5 })).toBeNull();
    expect(normalizar({ intencao: "atualizar_valor", contato: "Ana", valor: -100 })).toBeNull();
    expect(normalizar({ intencao: "atualizar_valor", contato: "Ana", valor: 85_000_000 })).toEqual({
      intencao: "atualizar_valor",
      contato: "Ana",
      valor: 85_000_000,
    });
  });

  it("valor null do LLM vira omissão (spread condicional)", () => {
    expect(normalizar({ intencao: "criar_negocio", contato: "Ana", valor: null })).toEqual({
      intencao: "criar_negocio",
      contato: "Ana",
    });
  });
});

describe("normalizar — atualizar_contato_info", () => {
  it("telefone formatado vira só dígitos", () => {
    expect(
      normalizar({
        intencao: "atualizar_contato_info",
        contato: "Sofia",
        telefone: "(11) 98888-7777",
      }),
    ).toEqual({
      intencao: "atualizar_contato_info",
      contato: "Sofia",
      telefone: "11988887777",
    });
  });

  it("telefone curto demais é descartado; com e-mail válido o comando sobrevive", () => {
    expect(
      normalizar({
        intencao: "atualizar_contato_info",
        contato: "Sofia",
        telefone: "123",
        email: "sofia@exemplo.com.br",
      }),
    ).toEqual({
      intencao: "atualizar_contato_info",
      contato: "Sofia",
      email: "sofia@exemplo.com.br",
    });
  });

  it("sem telefone válido E sem e-mail válido ⇒ null", () => {
    expect(
      normalizar({ intencao: "atualizar_contato_info", contato: "Sofia", telefone: "123" }),
    ).toBeNull();
    expect(
      normalizar({ intencao: "atualizar_contato_info", contato: "Sofia", email: "sem-arroba" }),
    ).toBeNull();
    expect(normalizar({ intencao: "atualizar_contato_info", contato: "Sofia" })).toBeNull();
  });
});

describe("normalizar — datas", () => {
  it("criar_tarefa com venceEm inexistente no calendário invalida o comando inteiro", () => {
    expect(
      normalizar({ intencao: "criar_tarefa", titulo: "Enviar contrato", venceEm: "2026-02-30" }),
    ).toBeNull();
  });

  it("consultar_agenda exige dia YYYY-MM-DD real", () => {
    expect(normalizar({ intencao: "consultar_agenda", dia: "amanhã" })).toBeNull();
    expect(normalizar({ intencao: "consultar_agenda", dia: "2026-07-11" })).toEqual({
      intencao: "consultar_agenda",
      dia: "2026-07-11",
    });
  });

  it("criar_evento com inicioISO inválido ⇒ null", () => {
    expect(
      normalizar({
        intencao: "criar_evento",
        titulo: "Visita",
        tipo: "visita",
        inicioISO: "lixo",
      }),
    ).toBeNull();
  });
});

describe("normalizar — campos obrigatórios e opcionais", () => {
  it("contato vazio/só espaços ⇒ null", () => {
    expect(normalizar({ intencao: "registrar_nota", contato: "  ", nota: "oi" })).toBeNull();
    expect(normalizar({ intencao: "mudar_etapa", contato: "", etapa: "proposta" })).toBeNull();
  });

  it("concluir_tarefa sem contato E sem título ⇒ null", () => {
    expect(normalizar({ intencao: "concluir_tarefa", contato: null, titulo: null })).toBeNull();
    expect(normalizar({ intencao: "concluir_tarefa", titulo: "enviar contrato" })).toEqual({
      intencao: "concluir_tarefa",
      titulo: "enviar contrato",
    });
  });

  it("opcionais null do LLM viram omissão em criar_evento", () => {
    expect(
      normalizar({
        intencao: "criar_evento",
        titulo: "Visita com Ana",
        tipo: "visita",
        inicioISO: "2026-07-12T15:00:00-03:00",
        local: null,
        contato: null,
      }),
    ).toEqual({
      intencao: "criar_evento",
      titulo: "Visita com Ana",
      tipo: "visita",
      inicioISO: "2026-07-12T15:00:00-03:00",
    });
  });
});

describe("dataValida", () => {
  it("rejeita 29/02 em ano não bissexto e aceita em bissexto", () => {
    expect(dataValida("2026-02-29")).toBe(false);
    expect(dataValida("2028-02-29")).toBe(true);
  });

  it("rejeita formato fora de YYYY-MM-DD", () => {
    expect(dataValida("11/07/2026")).toBe(false);
    expect(dataValida("2026-7-1")).toBe(false);
  });
});

describe("calendário para o prompt", () => {
  it("diaDaSemanaLocal usa os componentes locais do ISO", () => {
    expect(diaDaSemanaLocal("2026-07-11T09:00:00-03:00")).toBe("sábado");
    expect(diaDaSemanaLocal("lixo")).toBe("");
  });

  it("cruza a virada de mês com os dias da semana corretos", () => {
    const cal = calendarioProximosDias("2026-07-29T09:00:00-03:00");
    expect(cal).toBe(
      "quarta-feira 2026-07-29 (hoje), quinta-feira 2026-07-30 (amanhã), " +
        "sexta-feira 2026-07-31, sábado 2026-08-01, domingo 2026-08-02, " +
        "segunda-feira 2026-08-03, terça-feira 2026-08-04, quarta-feira 2026-08-05",
    );
  });

  it("cruza a virada de ano", () => {
    const cal = calendarioProximosDias("2026-12-28T09:00:00-03:00");
    expect(cal).toContain("quinta-feira 2026-12-31");
    expect(cal).toContain("sexta-feira 2027-01-01");
  });
});
