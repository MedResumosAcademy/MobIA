// NÚCLEO PURO do webhook da Meta (WhatsApp Cloud API) — assinatura, parse do
// payload e mapeamento de status. SEM IO/banco/env: tudo chega por parâmetro,
// para ser 100% testável (whatsapp.test.ts). A rota
// app/api/meta/webhook/route.ts é uma casca fina em cima deste módulo.
//
// Formato do payload (documentação oficial da Meta, campo "messages"):
//   entry[].changes[].value.messages[]  — mensagens RECEBIDAS de clientes
//   entry[].changes[].value.statuses[]  — atualizações das mensagens ENVIADAS
//   entry[].changes[].value.contacts[]  — perfil (nome) de quem mandou
//
// PRIVACIDADE: este módulo nunca loga nada — telefones e corpos de mensagem
// são dados pessoais (LGPD) e só transitam como valores de retorno.

import { createHmac, timingSafeEqual } from "node:crypto";
import { telefoneWhatsappSchema, type StatusMensagem } from "@imobia/domain";

// ---------------------------------------------------------------------------
// Assinatura X-Hub-Signature-256
// ---------------------------------------------------------------------------

/**
 * Valida a assinatura HMAC-SHA256 que a Meta manda no header
 * `X-Hub-Signature-256` ("sha256=<hex>") sobre o corpo BRUTO da requisição.
 * Comparação em tempo constante (timingSafeEqual); header ausente, prefixo
 * errado ou tamanho diferente ⇒ false (nunca lança).
 */
export function assinaturaWebhookValida(
  corpoBruto: string,
  cabecalho: string | null | undefined,
  appSecret: string,
): boolean {
  if (!cabecalho || !appSecret || !cabecalho.startsWith("sha256=")) {
    return false;
  }
  const esperada = createHmac("sha256", appSecret).update(corpoBruto, "utf8").digest("hex");
  const recebida = cabecalho.slice("sha256=".length).trim().toLowerCase();
  const a = Buffer.from(esperada, "utf8");
  const b = Buffer.from(recebida, "utf8");
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------
// Telefone
// ---------------------------------------------------------------------------

/**
 * Normaliza o telefone que a Meta manda (wa_id/from, ex.: "5511988887777")
 * para o formato canônico do banco: SÓ DÍGITOS com DDI 55. Reusa o
 * telefoneWhatsappSchema do domínio; irreconhecível ⇒ null (nunca chuta).
 */
export function normalizarTelefoneMeta(bruto: string): string | null {
  const r = telefoneWhatsappSchema.safeParse(bruto);
  return r.success ? r.data : null;
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/** Status da Meta → status do banco (mensagens.status). Desconhecido ⇒ null. */
const STATUS_META_PARA_BANCO: Record<string, StatusMensagem> = {
  sent: "enviada",
  delivered: "entregue",
  read: "lida",
  failed: "falhou",
};

export function mapearStatusMeta(statusMeta: string): StatusMensagem | null {
  return STATUS_META_PARA_BANCO[statusMeta] ?? null;
}

// A Meta pode entregar eventos FORA DE ORDEM (ex.: "read" antes de
// "delivered"). O status só anda para frente; "falhou" é terminal por rank.
const RANK_STATUS: Record<StatusMensagem, number> = {
  pendente: 0,
  recebida: 0,
  enviada: 1,
  entregue: 2,
  lida: 3,
  falhou: 4,
};

/** true se `novo` representa um AVANÇO sobre `atual` (nunca regride). */
export function statusAvanca(novo: StatusMensagem, atual: StatusMensagem): boolean {
  return RANK_STATUS[novo] > RANK_STATUS[atual];
}

// ---------------------------------------------------------------------------
// Parse do payload
// ---------------------------------------------------------------------------

/** Mensagem recebida de um cliente, já normalizada para o banco. */
export interface MensagemRecebidaMeta {
  metaMessageId: string;
  /** Só dígitos com DDI 55 (formato do banco). */
  telefone: string;
  /** Nome do perfil do WhatsApp (contacts[].profile.name), se veio. */
  nomePerfil: string | null;
  corpo: string;
  tipo: string;
}

/** Atualização de status de uma mensagem que NÓS enviamos. */
export interface StatusAtualizadoMeta {
  metaMessageId: string;
  status: StatusMensagem;
  /** Título do erro da Meta (curto) quando failed; senão null. */
  erro: string | null;
}

export interface EventosWebhookMeta {
  mensagensRecebidas: MensagemRecebidaMeta[];
  statusAtualizados: StatusAtualizadoMeta[];
}

function comoRegistro(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function comoLista(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function comoTexto(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

/** Nome do perfil em contacts[] cujo wa_id bate com o remetente. */
function nomeDoPerfil(contacts: unknown[], waId: string): string | null {
  for (const item of contacts) {
    const contato = comoRegistro(item);
    if (!contato || comoTexto(contato.wa_id) !== waId) continue;
    const perfil = comoRegistro(contato.profile);
    const nome = perfil ? comoTexto(perfil.name) : null;
    if (nome !== null) return nome.slice(0, 160);
  }
  return null;
}

/** Corpo exibível da mensagem: texto quando type=text; placeholder senão. */
function corpoDaMensagem(mensagem: Record<string, unknown>, tipo: string): string {
  if (tipo === "text") {
    const texto = comoRegistro(mensagem.text);
    const corpo = texto ? comoTexto(texto.body) : null;
    if (corpo !== null) return corpo;
  }
  // button: resposta de botão de template — texto útil, aproveita.
  if (tipo === "button") {
    const botao = comoRegistro(mensagem.button);
    const rotulo = botao ? comoTexto(botao.text) : null;
    if (rotulo !== null) return rotulo;
  }
  return `[mensagem de ${tipo} recebida no WhatsApp]`;
}

/**
 * Extrai as mensagens recebidas e as atualizações de status de um payload
 * de webhook da Meta. Tolerante a lixo: campos ausentes/deformados são
 * IGNORADOS em silêncio (a Meta reenvia o evento se respondermos erro — o
 * caminho seguro é aceitar e descartar o que não dá para entender).
 */
export function extrairEventosWebhook(payload: unknown): EventosWebhookMeta {
  const mensagensRecebidas: MensagemRecebidaMeta[] = [];
  const statusAtualizados: StatusAtualizadoMeta[] = [];

  const raiz = comoRegistro(payload);
  for (const itemEntry of comoLista(raiz?.entry)) {
    const entry = comoRegistro(itemEntry);
    for (const itemChange of comoLista(entry?.changes)) {
      const change = comoRegistro(itemChange);
      const value = comoRegistro(change?.value);
      if (!value) continue;

      // Mensagens RECEBIDAS de clientes.
      const contacts = comoLista(value.contacts);
      for (const itemMsg of comoLista(value.messages)) {
        const msg = comoRegistro(itemMsg);
        if (!msg) continue;
        const metaMessageId = comoTexto(msg.id);
        const de = comoTexto(msg.from);
        if (metaMessageId === null || de === null) continue;
        const telefone = normalizarTelefoneMeta(de);
        if (telefone === null) continue; // número fora do padrão BR — ignora.
        const tipo = comoTexto(msg.type) ?? "desconhecido";
        mensagensRecebidas.push({
          metaMessageId,
          telefone,
          nomePerfil: nomeDoPerfil(contacts, de),
          corpo: corpoDaMensagem(msg, tipo),
          tipo,
        });
      }

      // Status das mensagens ENVIADAS.
      for (const itemStatus of comoLista(value.statuses)) {
        const st = comoRegistro(itemStatus);
        if (!st) continue;
        const metaMessageId = comoTexto(st.id);
        const statusMeta = comoTexto(st.status);
        if (metaMessageId === null || statusMeta === null) continue;
        const status = mapearStatusMeta(statusMeta);
        if (status === null) continue; // status desconhecido — ignora.
        let erro: string | null = null;
        if (status === "falhou") {
          const primeiroErro = comoRegistro(comoLista(st.errors)[0]);
          erro =
            (primeiroErro
              ? (comoTexto(primeiroErro.title) ?? comoTexto(primeiroErro.message))
              : null)?.slice(0, 300) ?? "falha no envio pelo WhatsApp";
        }
        statusAtualizados.push({ metaMessageId, status, erro });
      }
    }
  }

  return { mensagensRecebidas, statusAtualizados };
}
