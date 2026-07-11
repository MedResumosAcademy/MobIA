"use server";

// CONVERSAS (inbox WhatsApp do CRM 2.0) — lista as conversas da org e envia
// mensagens 1:1 pela Meta Cloud API. Módulo "use server" (padrão newsletter.ts);
// o agrupamento puro vive em crm-nucleo.ts.
//
// LGPD — DISTINÇÃO IMPORTANTE: mensagem 1:1 na conversa é ATENDIMENTO
// (execução do contato/negócio a pedido do cliente — base legal distinta),
// então NÃO exige consentimento de marketing. O que exige opt-in explícito é
// o envio EM MASSA (campanhas.ts) — lá o segmentador força a exclusão.
//
// JANELA DE 24H (regra da Meta): texto livre só até 24h após a última mensagem
// RECEBIDA do contato; fora dela, só template aprovado (enviarTemplateAction).
// Sem Meta conectada, o envio degrada honesto para link wa.me (o corretor
// dispara do próprio aparelho) — nada quebra.

import { revalidatePath } from "next/cache";
import { formatarTelefoneBR, janelaAtendimento, montarLinkWhatsApp } from "@imobia/core";
import type { Papel } from "@imobia/domain";
import { obterPerfil, obterSessao } from "@/lib/auth/sessao";
import {
  enviarTemplateWhatsApp,
  enviarTextoWhatsApp,
  metaDisponivel,
} from "@/lib/meta/whatsapp";
import { permitido } from "@/lib/seguranca/limitador";
import { criarClienteServidor } from "@/lib/supabase/server";
import { agruparConversas } from "./crm-nucleo";

// --- Tipos de saída (camelCase, prontos para a UI) ---

/** Uma conversa do inbox: contato + última mensagem + janela de 24h. */
export type ConversaResumo = {
  contatoId: string;
  contatoNome: string;
  telefoneFormatado: string | null;
  ultimaMensagem: { corpo: string; direcao: string; status: string; criadoEm: string };
  /** Entradas do contato ainda sem resposta da equipe (badge do inbox). */
  naoRespondidas: number;
  /** Janela de atendimento de 24h (aberta ⇒ texto livre permitido). */
  janela: { aberta: boolean; expiraEmISO: string | null };
};

/** Uma mensagem da conversa aberta. */
export type MensagemConversa = {
  id: string;
  direcao: string;
  corpo: string;
  status: string;
  templateNome: string | null;
  criadoEm: string;
};

export type ResultadoMensagem =
  | { ok: true; mensagemId: string }
  | { ok: false; erro: string; waUrl?: string | null };

// --- Helpers internos ---

/** Sessão + papel profissional (corretor/gestor/admin) com org. Lança se não. */
async function exigirEquipe(): Promise<{ usuarioId: string; orgId: string; papel: Papel }> {
  const sessao = await obterSessao();
  if (!sessao) {
    throw new Error("não autenticado");
  }
  const perfil = await obterPerfil(sessao.usuarioId);
  if (!perfil || perfil.papel === "cliente" || !perfil.orgId) {
    throw new Error("sem permissão na org");
  }
  return { usuarioId: sessao.usuarioId, orgId: perfil.orgId, papel: perfil.papel };
}

// Teto de mensagens varridas para montar o inbox (bound explícito).
const LIMITE_MENSAGENS_INBOX = 2000;

// --- Leitura ---

/**
 * Conversas da org (contatos COM mensagens), ordenadas pela última mensagem.
 * 2 queries (mensagens recentes + contatos das conversas) + agregação pura
 * (crm-nucleo agruparConversas). Anônimo recebe [].
 */
export async function listarConversas(): Promise<ConversaResumo[]> {
  const sessao = await obterSessao();
  if (!sessao) {
    return [];
  }
  const supabase = await criarClienteServidor();
  const { data: mensagens, error } = await supabase
    .from("mensagens")
    .select("contato_id, direcao, corpo, status, criado_em")
    .order("criado_em", { ascending: false })
    .limit(LIMITE_MENSAGENS_INBOX);
  if (error) {
    throw new Error(`listarConversas: ${error.message}`);
  }

  const agrupadas = agruparConversas(
    (mensagens ?? []).map((m) => ({
      contatoId: m.contato_id,
      corpo: m.corpo,
      direcao: m.direcao,
      status: m.status,
      criadoEm: m.criado_em,
    })),
  );
  if (agrupadas.length === 0) {
    return [];
  }

  const { data: contatos, error: erroContatos } = await supabase
    .from("contatos")
    .select("id, nome, telefone")
    .in(
      "id",
      agrupadas.map((c) => c.contatoId),
    );
  if (erroContatos) {
    throw new Error(`listarConversas(contatos): ${erroContatos.message}`);
  }
  const porId = new Map((contatos ?? []).map((c) => [c.id, c]));

  const agora = new Date().toISOString();
  return agrupadas.map((c) => {
    const contato = porId.get(c.contatoId);
    return {
      contatoId: c.contatoId,
      contatoNome: contato?.nome ?? "Contato",
      telefoneFormatado: contato?.telefone ? formatarTelefoneBR(contato.telefone) : null,
      ultimaMensagem: c.ultima,
      naoRespondidas: c.naoRespondidas,
      janela: janelaAtendimento(c.ultimaEntradaEm, agora),
    };
  });
}

/**
 * Mensagens de uma conversa (cronológico, as `limite` mais recentes). RLS
 * escopa por org. Anônimo recebe [].
 */
export async function listarMensagensDoContato(
  contatoId: string,
  limite = 100,
): Promise<MensagemConversa[]> {
  const sessao = await obterSessao();
  if (!sessao) {
    return [];
  }
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("mensagens")
    .select("id, direcao, corpo, status, template_nome, criado_em")
    .eq("contato_id", contatoId)
    .order("criado_em", { ascending: false })
    .limit(limite);
  if (error) {
    throw new Error(`listarMensagensDoContato: ${error.message}`);
  }
  // Query desc (pega as mais recentes) → exibição em ordem cronológica.
  return (data ?? [])
    .map((m) => ({
      id: m.id,
      direcao: m.direcao,
      corpo: m.corpo,
      status: m.status,
      templateNome: m.template_nome,
      criadoEm: m.criado_em,
    }))
    .reverse();
}

// --- Envio 1:1 (contrato { ok } — nunca lança) ---

/**
 * Envia TEXTO LIVRE ao contato pela Meta Cloud API.
 *   - Sem Meta conectada ⇒ { ok: false, erro, waUrl } — fallback honesto para
 *     wa.me (link pronto com a mensagem; o corretor envia do aparelho).
 *   - Janela de 24h FECHADA ⇒ { ok: false, erro } instruindo a usar template.
 *   - Com janela aberta: registra a saída como 'pendente', envia e promove a
 *     'enviada' (com meta_message_id — o webhook atualiza entregue/lida).
 */
export async function enviarMensagemAction(
  contatoId: string,
  corpo: string,
): Promise<ResultadoMensagem> {
  let ctx: { usuarioId: string; orgId: string };
  try {
    ctx = await exigirEquipe();
  } catch {
    return { ok: false, erro: "Sem permissão para enviar mensagens. Entre novamente." };
  }
  const texto = corpo.trim();
  if (texto === "" || texto.length > 4096) {
    return { ok: false, erro: "Escreva uma mensagem de 1 a 4096 caracteres." };
  }
  // Rate limit leve por usuário (mesmo padrão do redator de WhatsApp).
  if (!permitido(`conversa:${ctx.usuarioId}`, 30, 60_000)) {
    return { ok: false, erro: "Muitas mensagens em sequência — aguarde um instante." };
  }

  const supabase = await criarClienteServidor();
  const { data: contato, error } = await supabase
    .from("contatos")
    .select("id, telefone")
    .eq("id", contatoId)
    .maybeSingle();
  if (error || !contato) {
    return { ok: false, erro: "Contato não encontrado ou fora do seu acesso." };
  }
  if (!contato.telefone) {
    return { ok: false, erro: "Este contato não tem telefone cadastrado." };
  }

  // Sem Meta conectada: degrade honesto — link wa.me pronto (sem registrar em
  // mensagens: não sabemos se o corretor de fato enviou pelo aparelho).
  if (!metaDisponivel()) {
    return {
      ok: false,
      erro: "WhatsApp não conectado ainda",
      waUrl: montarLinkWhatsApp(contato.telefone, texto),
    };
  }

  // Janela de 24h (regra da Meta): texto livre só com janela ABERTA.
  const { data: ultimaEntrada } = await supabase
    .from("mensagens")
    .select("criado_em")
    .eq("contato_id", contatoId)
    .eq("direcao", "entrada")
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  const janela = janelaAtendimento(
    ultimaEntrada?.criado_em ?? null,
    new Date().toISOString(),
  );
  if (!janela.aberta) {
    return { ok: false, erro: "fora da janela de 24h — use um template" };
  }

  // Registra a saída ANTES do envio (histórico nunca se perde); org_id da
  // sessão satisfaz a policy — o trigger 0026 rederiva do contato (anti-forja).
  const { data: pendente, error: erroInsert } = await supabase
    .from("mensagens")
    .insert({
      org_id: ctx.orgId,
      contato_id: contatoId,
      canal: "whatsapp",
      direcao: "saida",
      corpo: texto,
      status: "pendente",
    })
    .select("id")
    .single();
  if (erroInsert || !pendente) {
    return { ok: false, erro: "Não foi possível registrar a mensagem — tente de novo." };
  }

  const envio = await enviarTextoWhatsApp(contato.telefone, texto);
  if (!envio.ok) {
    await supabase
      .from("mensagens")
      .update({ status: "falhou", erro: envio.erro })
      .eq("id", pendente.id);
    return { ok: false, erro: envio.erro };
  }
  // Falha ao promover o status é tolerada de propósito: a mensagem JÁ saiu —
  // devolver erro aqui induziria reenvio duplicado.
  await supabase
    .from("mensagens")
    .update({ status: "enviada", meta_message_id: envio.metaMessageId })
    .eq("id", pendente.id);
  revalidatePath("/corretor/crm/conversas");
  return { ok: true, mensagemId: pendente.id };
}

/**
 * Envia um TEMPLATE aprovado na Meta (única forma de falar FORA da janela de
 * 24h — inclusive para iniciar conversa). Sem Meta conectada não há fallback
 * wa.me: template renderizado só existe na API oficial.
 */
export async function enviarTemplateAction(
  contatoId: string,
  templateNome: string,
  variaveis?: string[],
): Promise<ResultadoMensagem> {
  let ctx: { usuarioId: string; orgId: string };
  try {
    ctx = await exigirEquipe();
  } catch {
    return { ok: false, erro: "Sem permissão para enviar mensagens. Entre novamente." };
  }
  const nome = templateNome.trim();
  if (nome === "") {
    return { ok: false, erro: "Informe o nome do template aprovado na Meta." };
  }
  if (!permitido(`conversa:${ctx.usuarioId}`, 30, 60_000)) {
    return { ok: false, erro: "Muitas mensagens em sequência — aguarde um instante." };
  }
  if (!metaDisponivel()) {
    return {
      ok: false,
      erro: "WhatsApp não conectado ainda — templates só saem pela API oficial da Meta.",
    };
  }

  const supabase = await criarClienteServidor();
  const { data: contato, error } = await supabase
    .from("contatos")
    .select("id, telefone")
    .eq("id", contatoId)
    .maybeSingle();
  if (error || !contato) {
    return { ok: false, erro: "Contato não encontrado ou fora do seu acesso." };
  }
  if (!contato.telefone) {
    return { ok: false, erro: "Este contato não tem telefone cadastrado." };
  }

  // Corpo descritivo no histórico (o texto real vive no template da Meta).
  const corpo =
    variaveis !== undefined && variaveis.length > 0
      ? `Template "${nome}": ${variaveis.join(" · ")}`
      : `Template "${nome}"`;

  const { data: pendente, error: erroInsert } = await supabase
    .from("mensagens")
    .insert({
      org_id: ctx.orgId,
      contato_id: contatoId,
      canal: "whatsapp",
      direcao: "saida",
      corpo,
      template_nome: nome,
      status: "pendente",
    })
    .select("id")
    .single();
  if (erroInsert || !pendente) {
    return { ok: false, erro: "Não foi possível registrar a mensagem — tente de novo." };
  }

  const envio = await enviarTemplateWhatsApp(contato.telefone, nome, "pt_BR", variaveis);
  if (!envio.ok) {
    await supabase
      .from("mensagens")
      .update({ status: "falhou", erro: envio.erro })
      .eq("id", pendente.id);
    return { ok: false, erro: envio.erro };
  }
  await supabase
    .from("mensagens")
    .update({ status: "enviada", meta_message_id: envio.metaMessageId })
    .eq("id", pendente.id);
  revalidatePath("/corretor/crm/conversas");
  return { ok: true, mensagemId: pendente.id };
}
