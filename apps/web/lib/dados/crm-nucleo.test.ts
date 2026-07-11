// Testes do NÚCLEO PURO do CRM 2.0 (crm-nucleo.ts) — timeline unificada,
// agregação da listagem, inbox de conversas, segmentação de campanha (LGPD)
// e mapeamento de status de envio para o resumo do core.

import { describe, expect, it } from "vitest";
import { resumoCampanha } from "@imobia/core";
import {
  agregarPorContato,
  agruparConversas,
  maisQuente,
  montarTimelineContato,
  segmentarContatos,
  statusEnvioParaResumo,
  type ContatoParaSegmentacao,
} from "./crm-nucleo";

// --- montarTimelineContato ---

describe("montarTimelineContato", () => {
  const base = {
    negocios: [{ id: "n1", imovelTitulo: "Casa em Santos/SP", criadoEm: "2026-07-01T10:00:00Z" }],
    atividades: [
      {
        id: "a1",
        negocioId: "n1",
        descricao: "Etapa alterada de novo para visita.",
        criadoEm: "2026-07-03T10:00:00Z",
      },
    ],
    tarefas: [
      {
        id: "t1",
        negocioId: "n1",
        titulo: "Ligar para agendar visita",
        concluida: false,
        venceEm: "2026-07-05",
        criadoEm: "2026-07-02T10:00:00Z",
      },
    ],
    mensagens: [
      { id: "m1", direcao: "entrada", corpo: "Olá, tenho interesse!", criadoEm: "2026-07-04T10:00:00Z" },
    ],
  };

  it("unifica as quatro origens ordenando do mais recente ao mais antigo", () => {
    const timeline = montarTimelineContato(base);
    expect(timeline.map((i) => i.origem)).toEqual([
      "mensagem",
      "atividade",
      "tarefa",
      "negocio",
    ]);
    expect(timeline.map((i) => i.chave)).toEqual([
      "mensagem:m1",
      "atividade:a1",
      "tarefa:t1",
      "negocio:n1",
    ]);
  });

  it("tipa cada item por origem com título/detalhe prontos", () => {
    const timeline = montarTimelineContato(base);
    const negocio = timeline.find((i) => i.origem === "negocio");
    expect(negocio).toMatchObject({
      titulo: "Negócio no funil",
      detalhe: "Casa em Santos/SP",
      negocioId: "n1",
    });
    const mensagem = timeline.find((i) => i.origem === "mensagem");
    expect(mensagem).toMatchObject({
      titulo: "Olá, tenho interesse!",
      detalhe: "Mensagem recebida",
      negocioId: null,
    });
    const tarefa = timeline.find((i) => i.origem === "tarefa");
    expect(tarefa?.detalhe).toBe("Tarefa — vence em 2026-07-05");
  });

  it("mensagem de saída ganha detalhe 'Mensagem enviada' e corpo longo é resumido", () => {
    const timeline = montarTimelineContato({
      negocios: [],
      atividades: [],
      tarefas: [],
      mensagens: [
        { id: "m2", direcao: "saida", corpo: `${"x".repeat(300)}`, criadoEm: "2026-07-04T10:00:00Z" },
      ],
    });
    expect(timeline[0]?.detalhe).toBe("Mensagem enviada");
    expect(timeline[0]?.titulo.length).toBeLessThanOrEqual(200);
    expect(timeline[0]?.titulo.endsWith("…")).toBe(true);
  });

  it("tarefa concluída e sem prazo têm detalhes próprios", () => {
    const timeline = montarTimelineContato({
      negocios: [],
      atividades: [],
      tarefas: [
        { id: "t2", negocioId: "n1", titulo: "A", concluida: true, venceEm: null, criadoEm: "2026-07-02T10:00:00Z" },
        { id: "t3", negocioId: "n1", titulo: "B", concluida: false, venceEm: null, criadoEm: "2026-07-01T10:00:00Z" },
      ],
      mensagens: [],
    });
    expect(timeline[0]?.detalhe).toBe("Tarefa concluída");
    expect(timeline[1]?.detalhe).toBe("Tarefa pendente");
  });

  it("data inválida vai para o fim (nunca quebra a ordenação)", () => {
    const timeline = montarTimelineContato({
      negocios: [{ id: "n2", imovelTitulo: null, criadoEm: "não-é-data" }],
      atividades: [],
      tarefas: [],
      mensagens: [{ id: "m3", direcao: "entrada", corpo: "Oi", criadoEm: "2026-07-04T10:00:00Z" }],
    });
    expect(timeline[timeline.length - 1]?.chave).toBe("negocio:n2");
  });
});

// --- agregarPorContato ---

describe("agregarPorContato", () => {
  it("conta negócios abertos e escolhe a última mensagem por data (não por posição)", () => {
    const agregados = agregarPorContato(
      [{ contatoId: "c1" }, { contatoId: "c1" }, { contatoId: "c2" }, { contatoId: null }],
      [
        // Fora de ordem de propósito — a mais RECENTE de c1 vem primeiro na lista.
        { contatoId: "c1", corpo: "antiga", direcao: "saida", criadoEm: "2026-07-01T10:00:00Z" },
        { contatoId: "c1", corpo: "recente", direcao: "entrada", criadoEm: "2026-07-05T10:00:00Z" },
      ],
    );
    expect(agregados.get("c1")).toEqual({
      negociosAbertos: 2,
      ultimaMensagem: { corpo: "recente", direcao: "entrada", criadoEm: "2026-07-05T10:00:00Z" },
    });
    expect(agregados.get("c2")).toEqual({ negociosAbertos: 1, ultimaMensagem: null });
    expect(agregados.has("null")).toBe(false);
  });

  it("contato só com mensagens (sem negócio) entra com contagem zero", () => {
    const agregados = agregarPorContato(
      [],
      [{ contatoId: "c3", corpo: "oi", direcao: "entrada", criadoEm: "2026-07-01T10:00:00Z" }],
    );
    expect(agregados.get("c3")?.negociosAbertos).toBe(0);
    expect(agregados.get("c3")?.ultimaMensagem?.corpo).toBe("oi");
  });
});

// --- agruparConversas ---

describe("agruparConversas", () => {
  it("agrupa por contato com última mensagem, última entrada e não respondidas", () => {
    const conversas = agruparConversas([
      { contatoId: "c1", corpo: "resposta", direcao: "saida", status: "enviada", criadoEm: "2026-07-02T10:00:00Z" },
      { contatoId: "c1", corpo: "oi", direcao: "entrada", status: "recebida", criadoEm: "2026-07-01T10:00:00Z" },
      { contatoId: "c1", corpo: "e aí?", direcao: "entrada", status: "recebida", criadoEm: "2026-07-03T10:00:00Z" },
      { contatoId: "c1", corpo: "alô?", direcao: "entrada", status: "recebida", criadoEm: "2026-07-04T10:00:00Z" },
    ]);
    expect(conversas).toHaveLength(1);
    const c = conversas[0]!;
    expect(c.ultima.corpo).toBe("alô?");
    expect(c.ultimaEntradaEm).toBe("2026-07-04T10:00:00Z");
    // Duas entradas DEPOIS da última saída (2026-07-02) aguardam resposta.
    expect(c.naoRespondidas).toBe(2);
  });

  it("sem nenhuma saída, todas as entradas contam como não respondidas", () => {
    const conversas = agruparConversas([
      { contatoId: "c2", corpo: "a", direcao: "entrada", status: "recebida", criadoEm: "2026-07-01T10:00:00Z" },
      { contatoId: "c2", corpo: "b", direcao: "entrada", status: "recebida", criadoEm: "2026-07-02T10:00:00Z" },
    ]);
    expect(conversas[0]?.naoRespondidas).toBe(2);
  });

  it("conversa só de saída tem zero não respondidas e ultimaEntradaEm null (janela fechada)", () => {
    const conversas = agruparConversas([
      { contatoId: "c3", corpo: "olá!", direcao: "saida", status: "enviada", criadoEm: "2026-07-01T10:00:00Z" },
    ]);
    expect(conversas[0]?.naoRespondidas).toBe(0);
    expect(conversas[0]?.ultimaEntradaEm).toBeNull();
  });

  it("ordena as conversas pela última mensagem (mais recente primeiro)", () => {
    const conversas = agruparConversas([
      { contatoId: "antiga", corpo: "a", direcao: "entrada", status: "recebida", criadoEm: "2026-07-01T10:00:00Z" },
      { contatoId: "nova", corpo: "b", direcao: "entrada", status: "recebida", criadoEm: "2026-07-05T10:00:00Z" },
    ]);
    expect(conversas.map((c) => c.contatoId)).toEqual(["nova", "antiga"]);
  });
});

// --- segmentarContatos (LGPD invariante) ---

describe("segmentarContatos", () => {
  const consentido = (id: string, extras: ContatoParaSegmentacao["extras"] = {}): ContatoParaSegmentacao => ({
    id,
    contato: {
      tags: ["vip"],
      consentimentoMarketingEm: "2026-07-01T10:00:00Z",
      telefone: "5511988887777",
    },
    extras,
  });

  it("LGPD: contato sem consentimento NUNCA vira alvo, mesmo casando com tudo", () => {
    const seg = segmentarContatos(
      [
        consentido("ok"),
        {
          id: "sem-optin",
          contato: { tags: ["vip"], consentimentoMarketingEm: null, telefone: "5511988887777" },
          extras: {},
        },
      ],
      { tags: ["vip"] },
    );
    expect(seg.alvos).toEqual(["ok"]);
    expect(seg.semConsentimento).toEqual(["sem-optin"]);
  });

  it("telefone ausente ou inválido exclui como sem_telefone", () => {
    const seg = segmentarContatos(
      [
        {
          id: "sem-tel",
          contato: { tags: [], consentimentoMarketingEm: "2026-07-01T10:00:00Z", telefone: null },
          extras: {},
        },
        {
          id: "tel-invalido",
          contato: { tags: [], consentimentoMarketingEm: "2026-07-01T10:00:00Z", telefone: "123" },
          extras: {},
        },
      ],
      {},
    );
    expect(seg.semTelefone).toEqual(["sem-tel", "tel-invalido"]);
    expect(seg.alvos).toEqual([]);
  });

  it("filtros de etapa/temperatura são E entre si e o não-casado vai para foraDoSegmento", () => {
    const seg = segmentarContatos(
      [
        consentido("casa", { etapasAbertas: ["proposta"], temperatura: "pronto_para_compra" }),
        consentido("etapa-errada", { etapasAbertas: ["novo"], temperatura: "pronto_para_compra" }),
        consentido("frio", { etapasAbertas: ["proposta"], temperatura: "quente" }),
      ],
      { etapas: ["proposta"], temperaturas: ["pronto_para_compra"] },
    );
    expect(seg.alvos).toEqual(["casa"]);
    expect(seg.foraDoSegmento).toEqual(["etapa-errada", "frio"]);
    expect(seg.semConsentimento).toEqual([]);
  });

  it("segmento vazio alcança todos os consentidos com telefone", () => {
    const seg = segmentarContatos([consentido("a"), consentido("b")], {});
    expect(seg.alvos).toEqual(["a", "b"]);
  });

  it("sem consentimento E fora do segmento sai como foraDoSegmento (não infla a auditoria)", () => {
    const seg = segmentarContatos(
      [
        {
          id: "fora-e-sem-optin",
          contato: { tags: [], consentimentoMarketingEm: null, telefone: null },
          extras: { etapasAbertas: ["novo"] },
        },
        {
          id: "dentro-sem-optin",
          contato: { tags: [], consentimentoMarketingEm: null, telefone: "5511988887777" },
          extras: { etapasAbertas: ["proposta"] },
        },
      ],
      { etapas: ["proposta"] },
    );
    expect(seg.foraDoSegmento).toEqual(["fora-e-sem-optin"]);
    expect(seg.semConsentimento).toEqual(["dentro-sem-optin"]);
    expect(seg.semTelefone).toEqual([]);
    expect(seg.alvos).toEqual([]);
  });
});

// --- statusEnvioParaResumo + resumoCampanha (integração pura) ---

describe("statusEnvioParaResumo", () => {
  it("mapeia exclusões LGPD/telefone para 'excluido' e deixa o resto passar", () => {
    expect(statusEnvioParaResumo("sem_consentimento")).toBe("excluido");
    expect(statusEnvioParaResumo("sem_telefone")).toBe("excluido");
    expect(statusEnvioParaResumo("enviado")).toBe("enviado");
    expect(statusEnvioParaResumo("falhou")).toBe("falhou");
    expect(statusEnvioParaResumo("pendente")).toBe("pendente");
  });

  it("alimenta o resumoCampanha do core com os números certos", () => {
    const envios = [
      { status: "enviado" },
      { status: "enviado" },
      { status: "falhou" },
      { status: "sem_consentimento" },
      { status: "sem_telefone" },
      { status: "pendente" },
    ].map((e) => ({ status: statusEnvioParaResumo(e.status) }));
    expect(resumoCampanha(envios)).toEqual({
      alvo: 6,
      enviados: 2,
      falhas: 1,
      excluidos: 2,
    });
  });
});

// --- maisQuente ---

describe("maisQuente", () => {
  it("devolve a temperatura mais quente do rank", () => {
    expect(maisQuente(["quente", "pronto_para_compra", "muito_quente"])).toBe(
      "pronto_para_compra",
    );
    expect(maisQuente(["quente", "muito_quente"])).toBe("muito_quente");
  });

  it("ignora valores desconhecidos e devolve null para lista vazia", () => {
    expect(maisQuente(["qualquer_coisa"])).toBeNull();
    expect(maisQuente([])).toBeNull();
  });
});
