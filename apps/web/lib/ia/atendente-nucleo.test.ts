import { describe, expect, it } from "vitest";
import { montarContextoAtendimento } from "@imobia/core";
import {
  LIMITE_RESPOSTA_CHARS,
  limparSaidaLlm,
  validarRespostaAtendente,
  valoresMonetarios,
} from "./atendente-nucleo";

const CONTEXTO =
  "FAQ DA IMOBILIÁRIA:\n- P: Qual o valor do apartamento do Centro?\n  R: R$ 350.000,00 à vista.\n" +
  "HISTÓRICO DA CONVERSA:\nCliente: e a taxa de condomínio?\nAssistente: R$ 450 por mês.";

describe("limparSaidaLlm", () => {
  it("remove cercas de código e aspas acidentais", () => {
    expect(limparSaidaLlm('```\nOlá! Como posso ajudar?\n```')).toBe("Olá! Como posso ajudar?");
    expect(limparSaidaLlm('"Olá, tudo bem?"')).toBe("Olá, tudo bem?");
  });

  it("mantém texto normal intacto", () => {
    expect(limparSaidaLlm("Oi, sou a Lia!")).toBe("Oi, sou a Lia!");
  });

  it("só espaços vira vazio", () => {
    expect(limparSaidaLlm("   ")).toBe("");
  });
});

describe("valoresMonetarios", () => {
  it("extrai os dígitos de cada R$ do texto", () => {
    expect(valoresMonetarios("Custa R$ 350.000,00 e o sinal é R$ 5.000.")).toEqual([
      "35000000",
      "5000",
    ]);
  });

  it('"R$" sem número não vira valor', () => {
    expect(valoresMonetarios("o valor em R$ pode variar")).toEqual([]);
  });

  it("texto sem R$ devolve lista vazia", () => {
    expect(valoresMonetarios("tem 3 quartos e 2 vagas")).toEqual([]);
  });
});

describe("validarRespostaAtendente", () => {
  it("aprova resposta curta sem valores", () => {
    const r = validarRespostaAtendente("Claro! Posso agendar uma visita para você.", CONTEXTO);
    expect(r).toEqual({ ok: true, texto: "Claro! Posso agendar uma visita para você." });
  });

  it("resposta vazia (ou só cercas) escala", () => {
    expect(validarRespostaAtendente("   ", CONTEXTO)).toEqual({
      ok: false,
      motivo: "resposta_vazia",
    });
    expect(validarRespostaAtendente("```\n```", CONTEXTO)).toEqual({
      ok: false,
      motivo: "resposta_vazia",
    });
  });

  it("resposta acima do limite escala", () => {
    const longa = "a".repeat(LIMITE_RESPOSTA_CHARS + 1);
    expect(validarRespostaAtendente(longa, CONTEXTO)).toEqual({
      ok: false,
      motivo: "resposta_longa",
    });
  });

  it("aceita valor que APARECE no contexto (dígitos exatos)", () => {
    const r = validarRespostaAtendente("O condomínio é R$ 450 por mês.", CONTEXTO);
    expect(r.ok).toBe(true);
  });

  it("aceita valor com pontuação/centavos diferentes do contexto (prefixo)", () => {
    // Contexto tem "R$ 350.000,00" (35000000); a IA responde "R$ 350.000" (350000).
    const r = validarRespostaAtendente("O apartamento custa R$ 350.000 à vista.", CONTEXTO);
    expect(r.ok).toBe(true);
  });

  it("valor INVENTADO (não está no contexto) escala por segurança", () => {
    expect(validarRespostaAtendente("Sai por R$ 720.000, aproveite!", CONTEXTO)).toEqual({
      ok: false,
      motivo: "valor_nao_confirmado",
    });
  });

  it("um valor confirmado + um inventado ⇒ escala (todos precisam confirmar)", () => {
    const r = validarRespostaAtendente(
      "O imóvel custa R$ 350.000 e o IPTU é R$ 1.234.",
      CONTEXTO,
    );
    expect(r).toEqual({ ok: false, motivo: "valor_nao_confirmado" });
  });

  it("dígito solto no contexto ('3 quartos') NÃO confirma preço por prefixo", () => {
    const r = validarRespostaAtendente(
      "Custa R$ 320.000.",
      "FAQ:\n- P: Quantos quartos?\n  R: 3 quartos e 2 vagas.",
    );
    expect(r).toEqual({ ok: false, motivo: "valor_nao_confirmado" });
  });
});

// Regressão do furo do fail-safe: a numeração das REGRAS FIXAS do prompt real
// ("1.", "2."… "1 a 3 frases") injetava os tokens 1–5 no contexto e
// "confirmava" por prefixo qualquer preço inventado começando por 1–5.
describe("validarRespostaAtendente — contexto REAL de montarContextoAtendimento", () => {
  const contextoReal = (faq: { pergunta: string; resposta: string }[]) =>
    montarContextoAtendimento(
      { nomeAssistente: "Lia", persona: "Simpática e objetiva.", faq },
      { nome: "Maria", funilEtapa: "Primeiro contato" },
      [{ direcao: "entrada", corpo: "Oi! Vocês têm apartamento no Centro?" }],
    ) + "\nQuanto custa o apartamento do Centro?";

  it.each(["R$ 120.000", "R$ 350.000", "R$ 480.500", "R$ 1.200.000", "R$ 5.900"])(
    "preço inventado %s (começa com dígito 1–5) ESCALA mesmo com as regras no contexto",
    (preco) => {
      const r = validarRespostaAtendente(
        `O apartamento do Centro custa ${preco}.`,
        contextoReal([]),
      );
      expect(r).toEqual({ ok: false, motivo: "valor_nao_confirmado" });
    },
  );

  it("preço que ESTÁ no FAQ passa (com tolerância de centavos/pontuação)", () => {
    const contexto = contextoReal([
      { pergunta: "Valor do apartamento do Centro?", resposta: "R$ 350.000,00 à vista." },
    ]);
    expect(
      validarRespostaAtendente("O apartamento do Centro custa R$ 350.000.", contexto).ok,
    ).toBe(true);
    expect(
      validarRespostaAtendente("Sai por R$ 350.000,00 à vista.", contexto).ok,
    ).toBe(true);
  });

  it("com preço real no FAQ, um preço DIFERENTE inventado ainda escala", () => {
    const contexto = contextoReal([
      { pergunta: "Valor do apartamento do Centro?", resposta: "R$ 350.000,00 à vista." },
    ]);
    expect(
      validarRespostaAtendente("O apartamento do Centro custa R$ 310.000.", contexto),
    ).toEqual({ ok: false, motivo: "valor_nao_confirmado" });
  });
});
