import { describe, expect, it } from "vitest";
import { formatarReais } from "./modalidades";
import {
  gerarMensagemWhatsApp,
  montarLinkWhatsApp,
  type ContextoMensagem,
  type ObjetivoMensagem,
} from "./whatsapp";

const BASE: ContextoMensagem = {
  nomeContato: "Sofia Almeida",
  nomeCorretor: "Carlos Corretor",
};

const OBJETIVOS: readonly ObjetivoMensagem[] = [
  "followup",
  "visita",
  "proposta",
  "reativacao",
  "pos_venda",
];

describe("gerarMensagemWhatsApp", () => {
  it("followup com imóvel e sem dias: menciona o imóvel, primeiro nome derivado e corretor", () => {
    const msg = gerarMensagemWhatsApp("followup", {
      ...BASE,
      imovelTitulo: "Apartamento Jardins 3Q",
    });
    expect(msg).toContain("Oi Sofia");
    expect(msg).toContain("Carlos Corretor");
    expect(msg).toContain("pensar no Apartamento Jardins 3Q");
    expect(msg).not.toMatch(/\bdias\b/);
    expect(msg.trim().endsWith("?")).toBe(true);
  });

  it("followup com imóvel e dias parado: 'Faz N dias que não nos falamos'", () => {
    const msg = gerarMensagemWhatsApp("followup", {
      ...BASE,
      imovelTitulo: "Casa Vila Nova",
      diasSemMovimento: 12,
    });
    expect(msg).toContain("Faz 12 dias que não nos falamos");
    expect(msg).toContain("Casa Vila Nova");
  });

  it("followup com 1 dia parado usa o singular ('Faz 1 dia')", () => {
    const msg = gerarMensagemWhatsApp("followup", { ...BASE, diasSemMovimento: 1 });
    expect(msg).toContain("Faz 1 dia que não nos falamos");
    expect(msg).not.toContain("1 dias");
  });

  it("followup sem imóvel e sem dias: genérico, NÃO inventa imóvel nem dias", () => {
    const msg = gerarMensagemWhatsApp("followup", BASE);
    expect(msg).toContain("Oi Sofia, tudo bem?");
    expect(msg).not.toMatch(/\bdias\b/);
    expect(msg).not.toMatch(/im[óo]vel espec/i);
    expect(msg.trim().endsWith("?")).toBe(true);
  });

  it("visita com data e imóvel: confirma com dia da semana e hora", () => {
    const msg = gerarMensagemWhatsApp("visita", {
      ...BASE,
      imovelTitulo: "Cobertura Central",
      dataVisitaISO: "2026-07-04T15:30:00-03:00", // sábado
    });
    expect(msg).toContain("confirmar nossa visita ao Cobertura Central");
    expect(msg).toContain("no sábado (04/07) às 15h30");
  });

  it("visita sem data: propõe visita e pergunta dia/horário", () => {
    const msg = gerarMensagemWhatsApp("visita", { ...BASE, imovelTitulo: "Casa Vila Nova" });
    expect(msg).toContain("conhecer o Casa Vila Nova pessoalmente");
    expect(msg).toContain("Qual dia e horário ficam melhores para você?");
  });

  it("visita sem data e sem imóvel: propõe visita genérica", () => {
    const msg = gerarMensagemWhatsApp("visita", BASE);
    expect(msg).toContain("agendarmos uma visita");
    expect(msg.trim().endsWith("?")).toBe(true);
  });

  it("proposta com valor em centavos usa formatarReais", () => {
    const msg = gerarMensagemWhatsApp("proposta", { ...BASE, valor: 45_000_000_0 });
    expect(msg).toContain(formatarReais(45_000_000_0)); // R$ 450.000,00
    expect(msg).toContain("proposta");
    expect(msg.trim().endsWith("?")).toBe(true);
  });

  it("proposta sem valor não menciona números", () => {
    const msg = gerarMensagemWhatsApp("proposta", { ...BASE, imovelTitulo: "Loft Centro" });
    expect(msg).toContain("próximos passos da proposta do Loft Centro");
    expect(msg).not.toMatch(/\d/);
  });

  it("reativação tem tom de reencontro e usa dias quando há", () => {
    const msg = gerarMensagemWhatsApp("reativacao", {
      ...BASE,
      imovelTitulo: "Apartamento Jardins 3Q",
      diasSemMovimento: 45,
    });
    expect(msg).toContain("quanto tempo");
    expect(msg).toContain("Faz 45 dias que não nos falamos");
    expect(msg).toContain("Apartamento Jardins 3Q");
    expect(msg).toContain("Vamos retomar a conversa?");
  });

  it("reativação sem dados extras não inventa imóvel nem dias", () => {
    const msg = gerarMensagemWhatsApp("reativacao", BASE);
    expect(msg).toContain("quanto tempo");
    expect(msg).not.toMatch(/\bdias\b/);
    expect(msg.trim().endsWith("?")).toBe(true);
  });

  it("pós-venda parabeniza e cita o imóvel quando há", () => {
    const msg = gerarMensagemWhatsApp("pos_venda", { ...BASE, imovelTitulo: "Casa Vila Nova" });
    expect(msg).toContain("Parabéns pela conquista do Casa Vila Nova");
    expect(msg.trim().endsWith("?")).toBe(true);
  });

  it("pós-venda sem imóvel parabeniza pelo negócio, sem citar imóvel", () => {
    const msg = gerarMensagemWhatsApp("pos_venda", BASE);
    expect(msg).toContain("Parabéns pelo fechamento do seu negócio");
    expect(msg).not.toContain("conquista do");
  });

  it("primeiroNome explícito tem prioridade sobre o derivado", () => {
    const msg = gerarMensagemWhatsApp("followup", { ...BASE, primeiroNome: "Sô" });
    expect(msg).toContain("Oi Sô");
  });

  it("TODOS os objetivos: 2–4 frases, terminam com pergunta e no máx. 1 emoji", () => {
    for (const objetivo of OBJETIVOS) {
      const msg = gerarMensagemWhatsApp(objetivo, {
        ...BASE,
        imovelTitulo: "Casa Vila Nova",
        diasSemMovimento: 10,
        valor: 30_000_000,
        dataVisitaISO: "2026-07-06T10:00:00-03:00",
      });
      expect(msg.trim().endsWith("?"), objetivo).toBe(true);
      const frases = msg.split(/[.!?]+\s|[.!?]+$/).filter((s) => s.trim());
      expect(frases.length, `${objetivo}: ${msg}`).toBeGreaterThanOrEqual(2);
      expect(frases.length, `${objetivo}: ${msg}`).toBeLessThanOrEqual(4);
      const emojis = msg.match(/\p{Extended_Pictographic}/gu) ?? [];
      expect(emojis.length, objetivo).toBeLessThanOrEqual(1);
    }
  });
});

describe("montarLinkWhatsApp", () => {
  it("11 dígitos (DDD + celular) ganha o DDI 55", () => {
    expect(montarLinkWhatsApp("11988887777", "Oi")).toBe("https://wa.me/5511988887777?text=Oi");
  });

  it("10 dígitos (fixo) também ganha o 55", () => {
    expect(montarLinkWhatsApp("1133334444", "Oi")).toBe("https://wa.me/551133334444?text=Oi");
  });

  it("ignora formatação: '(11) 98888-7777' e '+55 11 98888-7777'", () => {
    expect(montarLinkWhatsApp("(11) 98888-7777", "Oi")).toBe(
      "https://wa.me/5511988887777?text=Oi",
    );
    expect(montarLinkWhatsApp("+55 11 98888-7777", "Oi")).toBe(
      "https://wa.me/5511988887777?text=Oi",
    );
  });

  it("13 dígitos já começando com 55 usa como está", () => {
    expect(montarLinkWhatsApp("5511988887777", "Oi")).toBe(
      "https://wa.me/5511988887777?text=Oi",
    );
  });

  it("inválidos devolvem null: curto, longo demais e 12 dígitos sem 55", () => {
    expect(montarLinkWhatsApp("988887777", "Oi")).toBeNull(); // 9 dígitos
    expect(montarLinkWhatsApp("551198888777712", "Oi")).toBeNull(); // 15 dígitos
    expect(montarLinkWhatsApp("491198888777", "Oi")).toBeNull(); // 12 sem 55
    expect(montarLinkWhatsApp("", "Oi")).toBeNull();
  });

  it("codifica acentos, espaços e quebras de linha na mensagem", () => {
    const link = montarLinkWhatsApp("11988887777", "Olá João!\nTudo bem?");
    expect(link).toBe(
      `https://wa.me/5511988887777?text=${encodeURIComponent("Olá João!\nTudo bem?")}`,
    );
    expect(link).toContain("%C3%A1"); // á
    expect(link).toContain("%0A"); // quebra de linha
    expect(link).not.toContain(" ");
  });
});
