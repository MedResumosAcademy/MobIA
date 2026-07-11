// WEBHOOK DA META (WhatsApp Cloud API) — GET /api/meta/webhook (verificação)
// e POST /api/meta/webhook (eventos: mensagens recebidas + status de envio).
//
// SEGURANÇA:
//   - GET: só ecoa hub.challenge se hub.verify_token === META_WEBHOOK_VERIFY_TOKEN.
//   - POST: valida a assinatura HMAC-SHA256 do CORPO BRUTO (X-Hub-Signature-256
//     com META_APP_SECRET, comparação em tempo constante) ANTES de parsear.
//   - Grava via SERVICE ROLE (SUPABASE_SERVICE_ROLE_KEY): o webhook não tem
//     sessão de usuário — a RLS é bypassada DE PROPÓSITO, e o trigger
//     privado.mensagens_preencher_org ainda deriva a org do contato (anti-forja).
//     A service key é server-only e NUNCA chega ao client.
//   - Envs ausentes ⇒ 503 (a Meta reagenda a entrega); nada quebra sem elas.
//
// LIMITAÇÃO MULTI-TENANT (fase atual, documentada de propósito): o webhook é
// da CONTA Meta (1 número por deploy), então os eventos são atribuídos a UMA
// org — a de META_ORG_ID, ou, sem essa env, a org do primeiro admin criado.
// Multi-tenant real exige mapear phone_number_id → org em tabela própria
// (fica para quando houver mais de um número conectado).
//
// CONTRATO COM A META: responder 200 RÁPIDO sempre que o evento foi aceito
// (mesmo que o processamento interno falhe — erro aqui NÃO pode virar loop de
// reentrega). Dedup por mensagens.meta_message_id (índice único parcial).
//
// PRIVACIDADE (LGPD): nunca loga telefone, nome ou corpo de mensagem.

import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { formatarTelefoneBR } from "@imobia/core";
import { statusMensagemSchema, type Database } from "@imobia/domain";
import { processarMensagemEntrada } from "@/lib/dados/atendimento";
import {
  assinaturaWebhookValida,
  extrairEventosWebhook,
  statusAvanca,
  type MensagemRecebidaMeta,
  type StatusAtualizadoMeta,
} from "@/lib/meta/webhook-nucleo";
import { SUPABASE_URL } from "@/lib/supabase/config";

export const runtime = "nodejs";

type ClienteServico = SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// GET — verificação do webhook (feita 1x pela Meta ao configurar).
// ---------------------------------------------------------------------------
export async function GET(request: Request) {
  const url = new URL(request.url);
  const modo = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const desafio = url.searchParams.get("hub.challenge");

  const esperado = process.env.META_WEBHOOK_VERIFY_TOKEN;
  if (modo === "subscribe" && esperado && token === esperado && desafio !== null) {
    // A Meta exige o challenge ecoado como TEXTO puro.
    return new Response(desafio, { status: 200 });
  }
  return new Response("token de verificação inválido", { status: 403 });
}

// ---------------------------------------------------------------------------
// POST — eventos (mensagens recebidas + status das enviadas).
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  const appSecret = process.env.META_APP_SECRET;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!appSecret || !serviceKey) {
    // Integração não configurada — 503 avisa a Meta para tentar de novo depois.
    return NextResponse.json(
      { erro: "webhook da Meta não configurado neste ambiente" },
      { status: 503 },
    );
  }

  // Assinatura sobre o corpo BRUTO — obrigatoriamente antes do JSON.parse.
  const corpoBruto = await request.text();
  const assinatura = request.headers.get("x-hub-signature-256");
  if (!assinaturaWebhookValida(corpoBruto, assinatura, appSecret)) {
    return NextResponse.json({ erro: "assinatura inválida" }, { status: 401 });
  }

  // Daqui em diante SEMPRE 200: o evento é autêntico e foi aceito; falha de
  // processamento não pode virar loop de reentrega da Meta.
  try {
    const payload: unknown = JSON.parse(corpoBruto);
    const eventos = extrairEventosWebhook(payload);
    if (eventos.mensagensRecebidas.length === 0 && eventos.statusAtualizados.length === 0) {
      return NextResponse.json({ ok: true });
    }

    const supabase = createClient<Database>(SUPABASE_URL, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    for (const status of eventos.statusAtualizados) {
      await aplicarStatus(supabase, status);
    }

    if (eventos.mensagensRecebidas.length > 0) {
      const destino = await resolverDestino(supabase);
      if (destino !== null) {
        for (const mensagem of eventos.mensagensRecebidas) {
          await registrarMensagemRecebida(supabase, destino, mensagem);
        }
      }
    }
  } catch {
    // Aceito e descartado — ver contrato com a Meta no topo do arquivo.
  }

  return NextResponse.json({ ok: true });
}

// ---------------------------------------------------------------------------
// Processamento
// ---------------------------------------------------------------------------

type DestinoWebhook = { orgId: string; responsavelId: string };

/**
 * Resolve a org que recebe as mensagens deste número (ver LIMITAÇÃO
 * MULTI-TENANT no topo) + o perfil responsável padrão por contatos novos:
 * com META_ORG_ID, o primeiro profissional da org (admin > gestor > corretor);
 * sem a env, o primeiro admin criado na base.
 */
async function resolverDestino(supabase: ClienteServico): Promise<DestinoWebhook | null> {
  const orgEnv = process.env.META_ORG_ID;
  if (orgEnv) {
    const { data } = await supabase
      .from("perfis")
      .select("id, papel")
      .eq("org_id", orgEnv)
      .in("papel", ["admin", "gestor", "corretor"])
      .order("criado_em", { ascending: true });
    const perfis = data ?? [];
    const escolhido =
      perfis.find((p) => p.papel === "admin") ??
      perfis.find((p) => p.papel === "gestor") ??
      perfis[0];
    return escolhido ? { orgId: orgEnv, responsavelId: escolhido.id } : null;
  }

  const { data } = await supabase
    .from("perfis")
    .select("id, org_id")
    .eq("papel", "admin")
    .not("org_id", "is", null)
    .order("criado_em", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data?.org_id) return null;
  return { orgId: data.org_id, responsavelId: data.id };
}

/**
 * Acha o contato pelo telefone na org; se não existe, cria (origem whatsapp).
 * Contato NOVO nasce com a IA atendendo quando a org tem ia_ativa (0029) —
 * "a IA responde sozinha e só o que precisa de humano sobe para a fila";
 * contatos existentes preservam o estado que já têm.
 */
async function encontrarOuCriarContato(
  supabase: ClienteServico,
  destino: DestinoWebhook,
  mensagem: MensagemRecebidaMeta,
): Promise<string | null> {
  const existente = await supabase
    .from("contatos")
    .select("id")
    .eq("org_id", destino.orgId)
    .eq("telefone", mensagem.telefone)
    .maybeSingle();
  if (existente.data) return existente.data.id;

  const { data: config } = await supabase
    .from("atendimento_config")
    .select("ia_ativa")
    .eq("org_id", destino.orgId)
    .maybeSingle();

  const criado = await supabase
    .from("contatos")
    .insert({
      org_id: destino.orgId,
      responsavel_id: destino.responsavelId,
      nome: mensagem.nomePerfil ?? formatarTelefoneBR(mensagem.telefone),
      telefone: mensagem.telefone,
      origem: "whatsapp",
      atendimento: config?.ia_ativa ? "ia" : "humano",
    })
    .select("id")
    .single();
  if (criado.data) return criado.data.id;

  // Corrida com outro evento do mesmo número (índice único org+telefone):
  // o INSERT perdeu, então o contato JÁ existe — busca de novo.
  const denovo = await supabase
    .from("contatos")
    .select("id")
    .eq("org_id", destino.orgId)
    .eq("telefone", mensagem.telefone)
    .maybeSingle();
  return denovo.data?.id ?? null;
}

/**
 * Mensagem RECEBIDA → PIPELINE DE ATENDIMENTO (lib/dados/atendimento.ts):
 * grava a entrada, deixa a IA responder/escalar quando configurada e mantém
 * a fila. Dedup pelo índice único de meta_message_id (a Meta reentrega
 * eventos) — checado barato aqui E garantido no INSERT do pipeline.
 */
async function registrarMensagemRecebida(
  supabase: ClienteServico,
  destino: DestinoWebhook,
  mensagem: MensagemRecebidaMeta,
): Promise<void> {
  const duplicada = await supabase
    .from("mensagens")
    .select("id")
    .eq("meta_message_id", mensagem.metaMessageId)
    .maybeSingle();
  if (duplicada.data) return;

  const contatoId = await encontrarOuCriarContato(supabase, destino, mensagem);
  if (contatoId === null) return;

  await processarMensagemEntrada(supabase, contatoId, mensagem.corpo, {
    origem: "webhook",
    metaMessageId: mensagem.metaMessageId,
  });
}

/** Aplica um status da Meta à mensagem ENVIADA correspondente (nunca regride). */
async function aplicarStatus(
  supabase: ClienteServico,
  status: StatusAtualizadoMeta,
): Promise<void> {
  const { data } = await supabase
    .from("mensagens")
    .select("id, status")
    .eq("meta_message_id", status.metaMessageId)
    .eq("direcao", "saida")
    .maybeSingle();
  if (!data) return; // mensagem desconhecida (ex.: enviada fora do app).

  // Status atual fora do vocabulário (não deveria acontecer) conta como
  // "pendente" — qualquer status da Meta avança sobre ele.
  const atual = statusMensagemSchema.safeParse(data.status);
  if (!statusAvanca(status.status, atual.success ? atual.data : "pendente")) return;

  await supabase
    .from("mensagens")
    .update({ status: status.status, erro: status.erro })
    .eq("id", data.id);
}
