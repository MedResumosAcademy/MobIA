// META WHATSAPP CLOUD API — cliente de ENVIO (módulo server-only: lê envs
// secretas; JAMAIS importar em client component).
//
// 100% pluggável por env: sem META_WHATSAPP_TOKEN + META_WHATSAPP_PHONE_NUMBER_ID
// o envio degrada com { ok: false, erro } honesto — nada quebra (padrão
// Groq/Resend do repo). Regras da Meta:
//   - Texto livre SÓ dentro da janela de 24h após a última mensagem RECEBIDA
//     do cliente (fora dela a Meta recusa — mapeamos o erro em pt-BR).
//   - Para INICIAR conversa: template APROVADO na Meta (enviarTemplateWhatsApp).
//
// PRIVACIDADE/SEGURANÇA: nunca loga token, telefone ou corpo; nunca repassa a
// resposta bruta da Meta ao chamador (só mensagens pt-BR curtas).

import { normalizarTelefoneMeta } from "@/lib/meta/webhook-nucleo";

const VERSAO_GRAPH = "v21.0";
const TIMEOUT_MS = 15_000;

/** Resultado padrão de envio (contrato do repo: nunca lança para o chamador). */
export type ResultadoEnvioMeta =
  | { ok: true; metaMessageId: string }
  | { ok: false; erro: string };

/** true quando as credenciais de ENVIO estão configuradas no ambiente. */
export function metaDisponivel(): boolean {
  return Boolean(
    process.env.META_WHATSAPP_TOKEN && process.env.META_WHATSAPP_PHONE_NUMBER_ID,
  );
}

// Erros conhecidos da Graph API → mensagem pt-BR curta (sem vazar detalhes).
const ERRO_POR_CODIGO: Record<number, string> = {
  131047: "Fora da janela de 24h — inicie a conversa com um template aprovado.",
  131026: "Este número não recebe mensagens de WhatsApp.",
  132001: "Template não encontrado ou ainda não aprovado na Meta.",
  131056: "Muitas mensagens para este número — aguarde um instante.",
};

/** Extrai o código de erro da resposta da Graph API sem expor o corpo. */
function codigoDeErro(corpo: unknown): number | null {
  if (typeof corpo !== "object" || corpo === null) return null;
  const erro = (corpo as { error?: unknown }).error;
  if (typeof erro !== "object" || erro === null) return null;
  const codigo = (erro as { code?: unknown }).code;
  return typeof codigo === "number" ? codigo : null;
}

/** Extrai messages[0].id ("wamid...") da resposta de sucesso da Graph API. */
function extrairMetaMessageId(corpo: unknown): string | null {
  if (typeof corpo !== "object" || corpo === null) return null;
  const mensagens = (corpo as { messages?: unknown }).messages;
  if (!Array.isArray(mensagens) || mensagens.length === 0) return null;
  const primeira = mensagens[0] as { id?: unknown };
  return typeof primeira?.id === "string" && primeira.id !== "" ? primeira.id : null;
}

/** POST /{PHONE_NUMBER_ID}/messages com timeout e tradução de erros. */
async function enviarParaGraph(payload: Record<string, unknown>): Promise<ResultadoEnvioMeta> {
  const token = process.env.META_WHATSAPP_TOKEN;
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    return {
      ok: false,
      erro: "WhatsApp não conectado — configure a integração Meta nas variáveis de ambiente.",
    };
  }

  try {
    const resposta = await fetch(
      `https://graph.facebook.com/${VERSAO_GRAPH}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );

    const corpo: unknown = await resposta.json().catch(() => null);

    if (!resposta.ok) {
      const codigo = codigoDeErro(corpo);
      if (codigo !== null && ERRO_POR_CODIGO[codigo]) {
        return { ok: false, erro: ERRO_POR_CODIGO[codigo] };
      }
      if (resposta.status === 401 || resposta.status === 403) {
        return { ok: false, erro: "Credenciais da Meta inválidas ou expiradas." };
      }
      if (resposta.status === 429) {
        return { ok: false, erro: "Limite de envios da Meta atingido — tente mais tarde." };
      }
      return { ok: false, erro: "O WhatsApp não aceitou o envio agora — tente de novo." };
    }

    const metaMessageId = extrairMetaMessageId(corpo);
    if (metaMessageId === null) {
      return { ok: false, erro: "O WhatsApp não confirmou o envio — tente de novo." };
    }
    return { ok: true, metaMessageId };
  } catch {
    // Timeout/rede — mensagem genérica, sem detalhes técnicos.
    return { ok: false, erro: "Não consegui falar com o WhatsApp agora — tente de novo." };
  }
}

/**
 * Envia TEXTO LIVRE (válido só na janela de 24h). `paraE164` aceita máscara
 * livre ("+55 (11) 98888-7777", "11 98888-7777", "5511988887777") — é
 * normalizado para dígitos com DDI 55 antes do envio.
 */
export async function enviarTextoWhatsApp(
  paraE164: string,
  corpo: string,
): Promise<ResultadoEnvioMeta> {
  const para = normalizarTelefoneMeta(paraE164);
  if (para === null) {
    return { ok: false, erro: "Telefone inválido — confira o DDD e o número." };
  }
  const texto = corpo.trim();
  if (texto === "") {
    return { ok: false, erro: "A mensagem está vazia." };
  }
  return enviarParaGraph({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: para,
    type: "text",
    text: { preview_url: false, body: texto },
  });
}

/**
 * Envia um TEMPLATE aprovado na Meta (única forma de INICIAR conversa fora da
 * janela de 24h). `variaveis` preenchem os {{1}}, {{2}}... do corpo do
 * template, na ordem. Idioma default: pt_BR.
 */
export async function enviarTemplateWhatsApp(
  paraE164: string,
  templateNome: string,
  idioma = "pt_BR",
  variaveis?: string[],
): Promise<ResultadoEnvioMeta> {
  const para = normalizarTelefoneMeta(paraE164);
  if (para === null) {
    return { ok: false, erro: "Telefone inválido — confira o DDD e o número." };
  }
  const nome = templateNome.trim();
  if (nome === "") {
    return { ok: false, erro: "Informe o nome do template aprovado na Meta." };
  }

  const template: Record<string, unknown> = {
    name: nome,
    language: { code: idioma },
  };
  if (variaveis !== undefined && variaveis.length > 0) {
    template.components = [
      {
        type: "body",
        parameters: variaveis.map((valor) => ({ type: "text", text: valor })),
      },
    ];
  }

  return enviarParaGraph({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: para,
    type: "template",
    template,
  });
}
