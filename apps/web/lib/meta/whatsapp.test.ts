// TESTES da fundação Meta WhatsApp: assinatura do webhook (HMAC), parse do
// payload oficial da Meta, mapeamento de status, telefone normalizado e o
// cliente de envio (degradação sem env + payloads corretos com fetch mockado).
import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assinaturaWebhookValida,
  extrairEventosWebhook,
  mapearStatusMeta,
  normalizarTelefoneMeta,
  statusAvanca,
} from "./webhook-nucleo";
import {
  enviarTemplateWhatsApp,
  enviarTextoWhatsApp,
  metaDisponivel,
} from "./whatsapp";

const SEGREDO = "app-secret-de-teste";

function assinar(corpo: string, segredo = SEGREDO): string {
  return `sha256=${createHmac("sha256", segredo).update(corpo, "utf8").digest("hex")}`;
}

// Fixture no formato DOCUMENTADO da Meta (campo "messages" do webhook).
const PAYLOAD_MENSAGEM = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "102290129340398",
      changes: [
        {
          value: {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: "15550783881",
              phone_number_id: "106540352242922",
            },
            contacts: [{ profile: { name: "Maria Silva" }, wa_id: "5511988887777" }],
            messages: [
              {
                from: "5511988887777",
                id: "wamid.ENTRADA==",
                timestamp: "1720000000",
                type: "text",
                text: { body: "Olá! Tenho interesse no apartamento." },
              },
            ],
          },
          field: "messages",
        },
      ],
    },
  ],
};

const PAYLOAD_STATUS = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "102290129340398",
      changes: [
        {
          value: {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: "15550783881",
              phone_number_id: "106540352242922",
            },
            statuses: [
              {
                id: "wamid.SAIDA==",
                status: "delivered",
                timestamp: "1720000100",
                recipient_id: "5511988887777",
              },
            ],
          },
          field: "messages",
        },
      ],
    },
  ],
};

describe("assinaturaWebhookValida", () => {
  it("aceita assinatura válida sobre o corpo bruto", () => {
    const corpo = JSON.stringify(PAYLOAD_MENSAGEM);
    expect(assinaturaWebhookValida(corpo, assinar(corpo), SEGREDO)).toBe(true);
  });

  it("rejeita assinatura de outro segredo", () => {
    const corpo = JSON.stringify(PAYLOAD_MENSAGEM);
    expect(assinaturaWebhookValida(corpo, assinar(corpo, "outro"), SEGREDO)).toBe(false);
  });

  it("rejeita corpo adulterado depois de assinado", () => {
    const corpo = JSON.stringify(PAYLOAD_MENSAGEM);
    const cabecalho = assinar(corpo);
    expect(assinaturaWebhookValida(`${corpo} `, cabecalho, SEGREDO)).toBe(false);
  });

  it("rejeita header ausente, vazio ou sem o prefixo sha256=", () => {
    const corpo = "{}";
    expect(assinaturaWebhookValida(corpo, null, SEGREDO)).toBe(false);
    expect(assinaturaWebhookValida(corpo, undefined, SEGREDO)).toBe(false);
    expect(assinaturaWebhookValida(corpo, "", SEGREDO)).toBe(false);
    expect(assinaturaWebhookValida(corpo, "md5=abc", SEGREDO)).toBe(false);
  });

  it("rejeita hex de tamanho errado sem lançar (timingSafeEqual exige tamanhos iguais)", () => {
    expect(assinaturaWebhookValida("{}", "sha256=abc123", SEGREDO)).toBe(false);
  });

  it("rejeita quando o segredo está vazio", () => {
    const corpo = "{}";
    expect(assinaturaWebhookValida(corpo, assinar(corpo, ""), "")).toBe(false);
  });
});

describe("extrairEventosWebhook", () => {
  it("extrai mensagem de texto com telefone normalizado e nome do perfil", () => {
    const eventos = extrairEventosWebhook(PAYLOAD_MENSAGEM);
    expect(eventos.statusAtualizados).toEqual([]);
    expect(eventos.mensagensRecebidas).toEqual([
      {
        metaMessageId: "wamid.ENTRADA==",
        telefone: "5511988887777",
        nomePerfil: "Maria Silva",
        corpo: "Olá! Tenho interesse no apartamento.",
        tipo: "text",
      },
    ]);
  });

  it("extrai atualização de status delivered → entregue, sem erro", () => {
    const eventos = extrairEventosWebhook(PAYLOAD_STATUS);
    expect(eventos.mensagensRecebidas).toEqual([]);
    expect(eventos.statusAtualizados).toEqual([
      { metaMessageId: "wamid.SAIDA==", status: "entregue", erro: null },
    ]);
  });

  it("status failed carrega o título do erro da Meta", () => {
    const payload = structuredClone(PAYLOAD_STATUS);
    payload.entry[0].changes[0].value.statuses[0] = {
      id: "wamid.SAIDA==",
      status: "failed",
      timestamp: "1720000200",
      recipient_id: "5511988887777",
      errors: [{ code: 131047, title: "Re-engagement message" }],
    } as never;
    const eventos = extrairEventosWebhook(payload);
    expect(eventos.statusAtualizados).toEqual([
      { metaMessageId: "wamid.SAIDA==", status: "falhou", erro: "Re-engagement message" },
    ]);
  });

  it("mensagem que não é texto vira placeholder legível", () => {
    const payload = structuredClone(PAYLOAD_MENSAGEM);
    payload.entry[0].changes[0].value.messages[0] = {
      from: "5511988887777",
      id: "wamid.AUDIO==",
      timestamp: "1720000000",
      type: "audio",
      audio: { id: "media-1" },
    } as never;
    const [msg] = extrairEventosWebhook(payload).mensagensRecebidas;
    expect(msg.tipo).toBe("audio");
    expect(msg.corpo).toBe("[mensagem de audio recebida no WhatsApp]");
  });

  it("ignora payload deformado sem lançar (null, lista, campos trocados)", () => {
    expect(extrairEventosWebhook(null)).toEqual({
      mensagensRecebidas: [],
      statusAtualizados: [],
    });
    expect(extrairEventosWebhook([1, 2])).toEqual({
      mensagensRecebidas: [],
      statusAtualizados: [],
    });
    expect(
      extrairEventosWebhook({ entry: [{ changes: [{ value: { messages: "x" } }] }] }),
    ).toEqual({ mensagensRecebidas: [], statusAtualizados: [] });
  });

  it("descarta mensagem de número irreconhecível (nunca chuta telefone)", () => {
    const payload = structuredClone(PAYLOAD_MENSAGEM);
    (payload.entry[0].changes[0].value.messages[0] as { from: string }).from = "4915123456789";
    expect(extrairEventosWebhook(payload).mensagensRecebidas).toEqual([]);
  });
});

describe("mapearStatusMeta / statusAvanca", () => {
  it("mapeia os 4 status documentados e rejeita desconhecidos", () => {
    expect(mapearStatusMeta("sent")).toBe("enviada");
    expect(mapearStatusMeta("delivered")).toBe("entregue");
    expect(mapearStatusMeta("read")).toBe("lida");
    expect(mapearStatusMeta("failed")).toBe("falhou");
    expect(mapearStatusMeta("deleted")).toBeNull();
  });

  it("status só anda para frente (eventos da Meta chegam fora de ordem)", () => {
    expect(statusAvanca("entregue", "enviada")).toBe(true);
    expect(statusAvanca("lida", "pendente")).toBe(true);
    expect(statusAvanca("enviada", "lida")).toBe(false); // não regride
    expect(statusAvanca("entregue", "entregue")).toBe(false); // idempotente
    expect(statusAvanca("falhou", "entregue")).toBe(true); // falha é terminal
    expect(statusAvanca("lida", "falhou")).toBe(false);
  });
});

describe("normalizarTelefoneMeta", () => {
  it("normaliza máscaras BR para dígitos com DDI 55", () => {
    expect(normalizarTelefoneMeta("+55 (11) 98888-7777")).toBe("5511988887777");
    expect(normalizarTelefoneMeta("11 98888-7777")).toBe("5511988887777");
    expect(normalizarTelefoneMeta("5511988887777")).toBe("5511988887777");
    expect(normalizarTelefoneMeta("1133334444")).toBe("551133334444");
  });

  it("rejeita número irreconhecível sem chutar", () => {
    expect(normalizarTelefoneMeta("abc")).toBeNull();
    expect(normalizarTelefoneMeta("123")).toBeNull();
    expect(normalizarTelefoneMeta("4915123456789")).toBeNull(); // DDI não-BR
  });
});

describe("cliente de envio (Graph API)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function conectarMeta() {
    vi.stubEnv("META_WHATSAPP_TOKEN", "token-teste");
    vi.stubEnv("META_WHATSAPP_PHONE_NUMBER_ID", "106540352242922");
  }

  it("metaDisponivel reflete a presença das duas envs de envio", () => {
    expect(metaDisponivel()).toBe(false);
    conectarMeta();
    expect(metaDisponivel()).toBe(true);
  });

  it("sem envs degrada com { ok: false } honesto e NÃO chama a rede", async () => {
    const fetchEspiao = vi.fn();
    vi.stubGlobal("fetch", fetchEspiao);
    const resultado = await enviarTextoWhatsApp("5511988887777", "Oi!");
    expect(resultado).toEqual({
      ok: false,
      erro: "WhatsApp não conectado — configure a integração Meta nas variáveis de ambiente.",
    });
    expect(fetchEspiao).not.toHaveBeenCalled();
  });

  it("telefone inválido falha ANTES de tocar a rede, mesmo conectado", async () => {
    conectarMeta();
    const fetchEspiao = vi.fn();
    vi.stubGlobal("fetch", fetchEspiao);
    const resultado = await enviarTextoWhatsApp("123", "Oi!");
    expect(resultado.ok).toBe(false);
    expect(fetchEspiao).not.toHaveBeenCalled();
  });

  it("texto livre: monta o payload documentado e devolve o metaMessageId", async () => {
    conectarMeta();
    const fetchEspiao = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ messages: [{ id: "wamid.NOVO==" }] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchEspiao);

    const resultado = await enviarTextoWhatsApp("+55 (11) 98888-7777", "Olá, Maria!");
    expect(resultado).toEqual({ ok: true, metaMessageId: "wamid.NOVO==" });

    const [url, init] = fetchEspiao.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://graph.facebook.com/v21.0/106540352242922/messages");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer token-teste");
    expect(JSON.parse(String(init.body))).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "5511988887777",
      type: "text",
      text: { preview_url: false, body: "Olá, Maria!" },
    });
  });

  it("template: nome + idioma default pt_BR + variáveis viram parameters do body", async () => {
    conectarMeta();
    const fetchEspiao = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ messages: [{ id: "wamid.TPL==" }] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchEspiao);

    const resultado = await enviarTemplateWhatsApp(
      "5511988887777",
      "boas_vindas_imobia",
      undefined,
      ["Maria", "Apartamento Jardins"],
    );
    expect(resultado).toEqual({ ok: true, metaMessageId: "wamid.TPL==" });

    const [, init] = fetchEspiao.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "5511988887777",
      type: "template",
      template: {
        name: "boas_vindas_imobia",
        language: { code: "pt_BR" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: "Maria" },
              { type: "text", text: "Apartamento Jardins" },
            ],
          },
        ],
      },
    });
  });

  it("template sem variáveis NÃO manda components (a Meta rejeita lista vazia)", async () => {
    conectarMeta();
    const fetchEspiao = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ messages: [{ id: "wamid.TPL2==" }] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchEspiao);

    await enviarTemplateWhatsApp("5511988887777", "boas_vindas_imobia");
    const [, init] = fetchEspiao.mock.calls[0] as [string, RequestInit];
    const corpo = JSON.parse(String(init.body)) as { template: Record<string, unknown> };
    expect(corpo.template).toEqual({ name: "boas_vindas_imobia", language: { code: "pt_BR" } });
  });

  it("erro 131047 (fora da janela de 24h) vira mensagem pt-BR sem vazar a resposta", async () => {
    conectarMeta();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { message: "(#131047) Re-engagement message", code: 131047 },
          }),
          { status: 400 },
        ),
      ),
    );
    const resultado = await enviarTextoWhatsApp("5511988887777", "Oi!");
    expect(resultado).toEqual({
      ok: false,
      erro: "Fora da janela de 24h — inicie a conversa com um template aprovado.",
    });
  });

  it("falha de credencial (401) e timeout/rede degradam sem vazar token", async () => {
    conectarMeta();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 401 })),
    );
    const r401 = await enviarTextoWhatsApp("5511988887777", "Oi!");
    expect(r401).toEqual({ ok: false, erro: "Credenciais da Meta inválidas ou expiradas." });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    const rRede = await enviarTextoWhatsApp("5511988887777", "Oi!");
    expect(rRede.ok).toBe(false);
    if (!rRede.ok) {
      expect(rRede.erro).toBe("Não consegui falar com o WhatsApp agora — tente de novo.");
      expect(rRede.erro).not.toContain("token-teste");
    }
  });
});
