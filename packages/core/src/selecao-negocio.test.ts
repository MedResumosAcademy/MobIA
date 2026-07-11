import { describe, expect, it } from "vitest";
import {
  normalizarParaBusca,
  rotuloDia,
  selecionarNegocioPorContato,
  type NegocioParaSelecao,
} from "./selecao-negocio";

function negocio(
  id: string,
  nome: string,
  resultado: string | null = null,
): NegocioParaSelecao {
  return { id, nome_contato: nome, resultado };
}

describe("normalizarParaBusca", () => {
  it("remove acentos, baixa a caixa e apara espaços", () => {
    expect(normalizarParaBusca("  Patrícia Nunes ")).toBe("patricia nunes");
    expect(normalizarParaBusca("SOFÍA")).toBe("sofia");
    expect(normalizarParaBusca("João-Ângelo Ção")).toBe("joao-angelo cao");
  });
});

describe("rotuloDia", () => {
  it('devolve "hoje" quando o dia é o de hoje', () => {
    expect(rotuloDia("2026-07-11", "2026-07-11")).toBe("hoje");
  });

  it('devolve "no dia DD/MM" para outros dias', () => {
    expect(rotuloDia("2026-07-04", "2026-07-11")).toBe("no dia 04/07");
  });
});

describe("selecionarNegocioPorContato", () => {
  it("casa tolerante a acentos e caixa ('sofia' casa 'Sofía')", () => {
    const sel = selecionarNegocioPorContato([negocio("n1", "Sofía Almeida")], "sofia");
    expect(sel?.negocio.id).toBe("n1");
    expect(sel?.ambiguo).toBe(false);
  });

  it("prefere o ABERTO mais recente sobre um fechado mais recente ainda", () => {
    // Lista já ordenada por atualizado_em desc: o fechado veio primeiro.
    const sel = selecionarNegocioPorContato(
      [negocio("fechado", "Ana Silva", "ganho"), negocio("aberto", "Ana Silva")],
      "ana",
    );
    expect(sel?.negocio.id).toBe("aberto");
  });

  it("só fechados ⇒ devolve o fechado mais recente (para o erro gentil)", () => {
    const sel = selecionarNegocioPorContato(
      [negocio("f1", "Ana Silva", "ganho"), negocio("f2", "Ana Silva", "perdido")],
      "ana",
    );
    expect(sel?.negocio.id).toBe("f1");
    expect(sel?.negocio.resultado).toBe("ganho");
    expect(sel?.ambiguo).toBe(false);
  });

  it("ambiguo=true com 2 abertos de nomes DIFERENTES casando o padrão", () => {
    const sel = selecionarNegocioPorContato(
      [negocio("n1", "Ana Silva"), negocio("n2", "Ana Souza")],
      "ana",
    );
    expect(sel?.negocio.id).toBe("n1"); // o mais recente vence
    expect(sel?.ambiguo).toBe(true);
  });

  it("ambiguo=false com 2 registros do MESMO nome", () => {
    const sel = selecionarNegocioPorContato(
      [negocio("n1", "Ana Silva"), negocio("n2", "ana silva ")],
      "ana",
    );
    expect(sel?.ambiguo).toBe(false);
  });

  it("negócios fechados não contam para a ambiguidade", () => {
    const sel = selecionarNegocioPorContato(
      [negocio("n1", "Ana Silva"), negocio("n2", "Ana Souza", "perdido")],
      "ana",
    );
    expect(sel?.ambiguo).toBe(false);
  });

  it("padrão vazio ou só espaços ⇒ null", () => {
    const lista = [negocio("n1", "Ana Silva")];
    expect(selecionarNegocioPorContato(lista, "")).toBeNull();
    expect(selecionarNegocioPorContato(lista, "   ")).toBeNull();
  });

  it("nenhum casamento ⇒ null", () => {
    expect(selecionarNegocioPorContato([negocio("n1", "Ana Silva")], "pedro")).toBeNull();
  });
});
