import { describe, expect, it } from "vitest";
import {
  contarConversaAtual,
  decidirEscalonamento,
  montarContextoAtendimento,
  type ConfigContexto,
} from "./atendimento";

// ---------------------------------------------------------------------------
// decidirEscalonamento — gatilhos de pedido de humano
// ---------------------------------------------------------------------------

describe("decidirEscalonamento — pediu humano", () => {
  it("'quero falar com um atendente' ⇒ pediu_humano", () => {
    expect(decidirEscalonamento("quero falar com um atendente", 2)).toEqual({
      escalar: true,
      motivo: "pediu_humano",
    });
  });

  it("'me passa pra um humano' ⇒ pediu_humano", () => {
    expect(decidirEscalonamento("me passa pra um humano, por favor", 4)).toEqual({
      escalar: true,
      motivo: "pediu_humano",
    });
  });

  it("'quero uma pessoa de verdade' ⇒ pediu_humano", () => {
    expect(decidirEscalonamento("quero uma pessoa de verdade", 1)).toEqual({
      escalar: true,
      motivo: "pediu_humano",
    });
  });

  it("'chama o gerente' (maiúsculas) ⇒ pediu_humano", () => {
    expect(decidirEscalonamento("CHAMA O GERENTE", 3).motivo).toBe("pediu_humano");
  });

  it("'quero um corretor de verdade' ⇒ pediu_humano", () => {
    expect(decidirEscalonamento("quero um corretor de verdade", 5).motivo).toBe(
      "pediu_humano",
    );
  });
});

// ---------------------------------------------------------------------------
// decidirEscalonamento — assunto sensível
// ---------------------------------------------------------------------------

describe("decidirEscalonamento — assunto sensível", () => {
  it("'meu advogado disse que é caso jurídico' (com acento) ⇒ assunto_sensivel", () => {
    expect(
      decidirEscalonamento("meu advogado disse que é caso jurídico", 2).motivo,
    ).toBe("assunto_sensivel");
  });

  it("'vou abrir um processo' ⇒ assunto_sensivel", () => {
    expect(decidirEscalonamento("vou abrir um processo contra vocês", 2)).toEqual({
      escalar: true,
      motivo: "assunto_sensivel",
    });
  });

  it("'vou fazer uma reclamação formal no procon' ⇒ assunto_sensivel", () => {
    expect(
      decidirEscalonamento("vou fazer uma reclamação formal no procon", 1).motivo,
    ).toBe("assunto_sensivel");
  });

  it("'quero cancelar o contrato' ⇒ assunto_sensivel", () => {
    expect(decidirEscalonamento("quero cancelar o contrato", 6).motivo).toBe(
      "assunto_sensivel",
    );
  });
});

// ---------------------------------------------------------------------------
// decidirEscalonamento — frustração e casos que NÃO escalam
// ---------------------------------------------------------------------------

describe("decidirEscalonamento — frustração e não-escala", () => {
  it("'você não está ajudando' (com acentos) ⇒ frustracao", () => {
    expect(decidirEscalonamento("você não está ajudando em nada", 4)).toEqual({
      escalar: true,
      motivo: "frustracao",
    });
  });

  it("'já falei isso três vezes' ⇒ frustracao", () => {
    expect(decidirEscalonamento("já falei isso três vezes", 8).motivo).toBe(
      "frustracao",
    );
  });

  it("'pare de mandar mensagem' ⇒ frustracao", () => {
    expect(decidirEscalonamento("pare de mandar mensagem", 3).motivo).toBe(
      "frustracao",
    );
  });

  it("conversa longa (historicoLen >= 20) escala por frustracao mesmo sem gatilho", () => {
    expect(decidirEscalonamento("qual o horário de visita?", 20)).toEqual({
      escalar: true,
      motivo: "frustracao",
    });
  });

  it("precedência: pedido de humano + frustração ⇒ pediu_humano", () => {
    expect(
      decidirEscalonamento("chega, quero falar com um atendente", 25).motivo,
    ).toBe("pediu_humano");
  });

  it("pergunta comum de imóvel NÃO escala (sem motivo)", () => {
    expect(decidirEscalonamento("o apartamento tem 2 quartos?", 3)).toEqual({
      escalar: false,
    });
  });

  it("'chegando aí' não dispara o gatilho 'chega' (fronteira de palavra)", () => {
    expect(decidirEscalonamento("estou chegando aí para a visita", 2).escalar).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// contarConversaAtual
// ---------------------------------------------------------------------------

describe("contarConversaAtual", () => {
  const AGORA = "2026-07-11T12:00:00Z";

  it("conta todas as mensagens quando não há silêncio > 24h", () => {
    expect(
      contarConversaAtual(
        ["2026-07-11T09:00:00Z", "2026-07-11T10:00:00Z", "2026-07-11T11:00:00Z"],
        AGORA,
      ),
    ).toBe(3);
  });

  it("silêncio > 24h separa conversas: só a atual conta", () => {
    expect(
      contarConversaAtual(
        // Conversa antiga (meses atrás) + conversa atual com 2 mensagens.
        ["2026-03-01T10:00:00Z", "2026-03-01T10:05:00Z", "2026-07-11T10:00:00Z", "2026-07-11T10:10:00Z"],
        AGORA,
      ),
    ).toBe(2);
  });

  it("cliente que volta depois de dias começa conversa NOVA (zero)", () => {
    const vinteMensagensAntigas = Array.from({ length: 20 }, (_, i) =>
      `2026-07-01T10:${String(i).padStart(2, "0")}:00Z`,
    );
    expect(contarConversaAtual(vinteMensagensAntigas, AGORA)).toBe(0);
  });

  it("mensagem dentro da janela mantém a corrente; histórico vazio é zero", () => {
    expect(contarConversaAtual(["2026-07-10T14:00:00Z"], AGORA)).toBe(1);
    expect(contarConversaAtual([], AGORA)).toBe(0);
  });

  it("instante inválido interrompe a contagem (conservador)", () => {
    expect(
      contarConversaAtual(["data-quebrada", "2026-07-11T11:00:00Z"], AGORA),
    ).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// montarContextoAtendimento
// ---------------------------------------------------------------------------

const cfgBase: ConfigContexto = {
  nomeAssistente: "Lia",
  persona: "Tom leve e acolhedor, trata o cliente por você.",
  faq: [
    { pergunta: "Vocês trabalham com aluguel?", resposta: "Sim, locação e venda." },
    { pergunta: "Qual o horário?", resposta: "Seg a sex, 9h às 18h." },
  ],
  escalarQuando: "Cliente perguntando sobre permuta de imóveis.",
};

describe("montarContextoAtendimento", () => {
  const prompt = montarContextoAtendimento(
    cfgBase,
    { nome: "Maria", funilEtapa: "Em conversa", negociosAbertos: 2 },
    [
      { direcao: "entrada", corpo: "Oi, vi o anúncio do apê" },
      { direcao: "saida", corpo: "Olá! Sou a Lia, assistente virtual. Como posso ajudar?" },
    ],
  );

  it("apresenta o assistente pelo nome como assistente virtual (transparência)", () => {
    expect(prompt).toContain("Você é Lia, assistente virtual de uma imobiliária");
    expect(prompt).toContain("Nunca finja ser humano");
  });

  it("embute a regra fixa de NUNCA inventar imóvel/preço/endereço", () => {
    expect(prompt).toContain("NUNCA invente dados de imóvel, preço, endereço");
    expect(prompt).toContain("Só cite informações presentes neste contexto");
  });

  it("embute respostas curtas (1 a 3 frases) e 1 pergunta por vez", () => {
    expect(prompt).toContain("1 a 3 frases");
    expect(prompt).toContain("máximo 1 pergunta por vez");
  });

  it("embute a regra de escalar em caso de dúvida", () => {
    expect(prompt).toContain("Em caso de dúvida");
    expect(prompt).toContain("corretor humano");
  });

  it("inclui persona, FAQ (pergunta e resposta) e escalarQuando da org", () => {
    expect(prompt).toContain("Tom leve e acolhedor");
    expect(prompt).toContain("Vocês trabalham com aluguel?");
    expect(prompt).toContain("Sim, locação e venda.");
    expect(prompt).toContain("permuta de imóveis");
  });

  it("inclui contato (nome, etapa, negócios) e histórico rotulado", () => {
    expect(prompt).toContain("- Nome: Maria");
    expect(prompt).toContain("- Etapa do funil: Em conversa");
    expect(prompt).toContain("- Negócios abertos: 2");
    expect(prompt).toContain("Cliente: Oi, vi o anúncio do apê");
    expect(prompt).toContain("Assistente: Olá! Sou a Lia");
  });

  it("omite blocos opcionais quando persona/faq/escalarQuando/histórico vazios", () => {
    const enxuto = montarContextoAtendimento(
      { nomeAssistente: "Assistente", faq: [] },
      { nome: "João" },
      [],
    );
    expect(enxuto).not.toContain("PERSONA");
    expect(enxuto).not.toContain("FAQ DA IMOBILIÁRIA");
    expect(enxuto).not.toContain("ESCALAR TAMBÉM QUANDO");
    expect(enxuto).not.toContain("HISTÓRICO DA CONVERSA");
    expect(enxuto).not.toContain("- Etapa do funil:");
    // As regras fixas continuam mesmo no prompt mínimo.
    expect(enxuto).toContain("REGRAS FIXAS");
    expect(enxuto).toContain("- Nome: João");
  });
});
