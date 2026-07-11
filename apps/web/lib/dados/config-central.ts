"use server";

// CENTRAL DE CONFIGURAÇÃO (/corretor/config) — camada de dados das seções de
// GESTÃO da migração 0033: tokens de captação, webhooks de saída, equipe &
// convites (RPCs emitir/listar/revogar_convite) e metas por corretor
// (metas_corretor). Tudo aqui é gestor/admin — a RLS reforça e as leituras
// degradam para lista vazia quando o papel não permite.
//
// SEGREDOS (regra inegociável): o token de captação e o segredo do webhook de
// saída aparecem UMA única vez, no retorno da criação — as listagens devolvem
// só prefixo/metadados e NADA disso é logado. O modo WhatsApp/e-mail vive em
// org-config.ts (salvarOrgConfigAction); aqui ficam as coleções.

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  EVENTOS_WEBHOOK,
  eventoWebhookSchema,
  idSchema,
  type EventoWebhook,
  type Papel,
} from "@imobia/domain";
import { obterPerfil, obterSessao } from "@/lib/auth/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import { gerarTokenCaptacao } from "@/lib/dados/captacao-nucleo";
import { assinarCorpoWebhook } from "@/lib/webhooks/saida";

// —— Tipos de saída (camelCase, prontos para a UI) ————————————————————————

export type TokenCaptacaoResumo = {
  id: string;
  origem: string;
  /** Primeiros chars do token ("imob_a1b2") — o claro nunca volta ao cliente. */
  prefixo: string;
  ativo: boolean;
  criadoEm: string;
  ultimoUsoEm: string | null;
};

export type WebhookSaidaResumo = {
  id: string;
  url: string;
  eventos: EventoWebhook[];
  ativo: boolean;
  ultimaEntregaEm: string | null;
  ultimaEntregaStatus: number | null;
  falhasSeguidas: number;
};

export type MembroOrg = {
  id: string;
  nome: string | null;
  papel: Papel;
  desde: string;
};

export type ConviteResumo = {
  id: string;
  email: string;
  papel: string;
  status: "pendente" | "consumido" | "expirado";
  expiraEm: string;
  criadoEm: string;
};

export type MetaCorretorLinha = {
  corretorId: string;
  nome: string | null;
  papel: Papel;
  vendasMes: number;
  /** CENTAVOS (regra do repo) — a UI converte para reais só na exibição. */
  receitaMesCentavos: number;
};

export type ResultadoSimples = { ok: true } | { ok: false; erro: string };

// —— Helpers ——————————————————————————————————————————————————————————————

/** Gate de papel: só gestor/admin gerencia a central (RLS 0033 reforça). */
async function exigirGestor(): Promise<{ usuarioId: string; orgId: string }> {
  const sessao = await obterSessao();
  if (!sessao) {
    throw new Error("não autenticado");
  }
  const perfil = await obterPerfil(sessao.usuarioId);
  if (!perfil || (perfil.papel !== "gestor" && perfil.papel !== "admin") || !perfil.orgId) {
    throw new Error("sem permissão de gestor");
  }
  return { usuarioId: sessao.usuarioId, orgId: perfil.orgId };
}

const SEM_PERMISSAO = "Só gestor ou admin alteram a central de configuração.";

/** Coage o array cru de eventos do banco para o vocabulário conhecido. */
function coagirEventos(brutos: string[]): EventoWebhook[] {
  return (EVENTOS_WEBHOOK as readonly string[])
    .filter((e) => brutos.includes(e)) as EventoWebhook[];
}

// ============================================================================
// 1) TOKENS DE CAPTAÇÃO (POST /api/captacao — Bearer imob_…)
// ============================================================================

/** Tokens da org (gestor/admin; RLS esconde dos demais). Sem permissão ⇒ []. */
export async function listarTokensCaptacao(): Promise<TokenCaptacaoResumo[]> {
  try {
    await exigirGestor();
  } catch {
    return [];
  }
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("tokens_captacao")
    .select("id, origem, prefixo, ativo, criado_em, ultimo_uso_em")
    .order("criado_em", { ascending: false });
  return (data ?? []).map((t) => ({
    id: t.id,
    origem: t.origem,
    prefixo: t.prefixo,
    ativo: t.ativo,
    criadoEm: t.criado_em,
    ultimoUsoEm: t.ultimo_uso_em,
  }));
}

const origemSchema = z.string().trim().min(1).max(60);

/**
 * Cria um token de captação para a `origem` (ex.: "site", "landing-verao").
 * O TOKEN EM CLARO volta UMA única vez — no banco vive só o sha256.
 */
export async function criarTokenCaptacaoAction(
  origem: string,
): Promise<{ ok: true; token: string } | { ok: false; erro: string }> {
  let ctx: { usuarioId: string; orgId: string };
  try {
    ctx = await exigirGestor();
  } catch {
    return { ok: false, erro: SEM_PERMISSAO };
  }
  const parsed = origemSchema.safeParse(origem);
  if (!parsed.success) {
    return { ok: false, erro: "Informe a origem do token (até 60 caracteres)." };
  }

  const { token, hash, prefixo } = gerarTokenCaptacao();
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("tokens_captacao").insert({
    org_id: ctx.orgId,
    origem: parsed.data,
    token_hash: hash,
    prefixo,
    criado_por: ctx.usuarioId,
  });
  if (error) {
    return { ok: false, erro: "Não foi possível criar o token. Tente novamente." };
  }
  revalidatePath("/corretor/config");
  return { ok: true, token };
}

/** Revoga (desativa) um token — a captação passa a responder 401 para ele. */
export async function revogarTokenCaptacaoAction(id: string): Promise<ResultadoSimples> {
  try {
    await exigirGestor();
  } catch {
    return { ok: false, erro: SEM_PERMISSAO };
  }
  if (!idSchema.safeParse(id).success) {
    return { ok: false, erro: "Token inválido." };
  }
  const supabase = await criarClienteServidor();
  const { error } = await supabase
    .from("tokens_captacao")
    .update({ ativo: false })
    .eq("id", id);
  if (error) {
    return { ok: false, erro: "Não foi possível revogar o token." };
  }
  revalidatePath("/corretor/config");
  return { ok: true };
}

// ============================================================================
// 2) WEBHOOKS DE SAÍDA (POST JSON assinado — header x-imobia-signature)
// ============================================================================

/** Webhooks da org (gestor/admin). Sem permissão ⇒ []. */
export async function listarWebhooksSaida(): Promise<WebhookSaidaResumo[]> {
  try {
    await exigirGestor();
  } catch {
    return [];
  }
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("webhooks_saida")
    .select("id, url, eventos, ativo, ultima_entrega_em, ultima_entrega_status, falhas_seguidas")
    .order("criado_em", { ascending: true });
  return (data ?? []).map((w) => ({
    id: w.id,
    url: w.url,
    eventos: coagirEventos(w.eventos),
    ativo: w.ativo,
    ultimaEntregaEm: w.ultima_entrega_em,
    ultimaEntregaStatus: w.ultima_entrega_status,
    falhasSeguidas: w.falhas_seguidas,
  }));
}

const novoWebhookSchema = z.object({
  url: z.string().trim().url().startsWith("https://", "apenas URLs https://").max(500),
  eventos: z.array(eventoWebhookSchema).min(1).max(EVENTOS_WEBHOOK.length),
});

/**
 * Cadastra um webhook de saída. O SEGREDO (usado para assinar cada entrega
 * com HMAC-SHA256) volta UMA única vez — depois só o destino o conhece.
 */
export async function criarWebhookSaidaAction(input: {
  url: string;
  eventos: EventoWebhook[];
}): Promise<{ ok: true; segredo: string } | { ok: false; erro: string }> {
  let ctx: { orgId: string };
  try {
    ctx = await exigirGestor();
  } catch {
    return { ok: false, erro: SEM_PERMISSAO };
  }
  const parsed = novoWebhookSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      erro: "Confira a URL (precisa ser https://) e marque ao menos um evento.",
    };
  }

  // 256 bits de aleatoriedade; prefixo "whsec_" segue a convenção de mercado.
  const segredo = `whsec_${randomBytes(32).toString("hex")}`;
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("webhooks_saida").insert({
    org_id: ctx.orgId,
    url: parsed.data.url,
    eventos: parsed.data.eventos,
    segredo,
  });
  if (error) {
    return { ok: false, erro: "Não foi possível cadastrar o webhook. Tente novamente." };
  }
  revalidatePath("/corretor/config");
  return { ok: true, segredo };
}

/**
 * Entrega de TESTE: POST do evento `ping` assinado com o segredo do webhook.
 * Registra ultima_entrega_em/status (mas NÃO conta em falhas_seguidas — teste
 * não desativa ninguém). Retorna o status HTTP para a UI mostrar.
 */
export async function testarWebhookSaidaAction(
  id: string,
): Promise<{ ok: true; status: number | null } | { ok: false; erro: string }> {
  try {
    await exigirGestor();
  } catch {
    return { ok: false, erro: SEM_PERMISSAO };
  }
  if (!idSchema.safeParse(id).success) {
    return { ok: false, erro: "Webhook inválido." };
  }
  const supabase = await criarClienteServidor();
  const { data: webhook } = await supabase
    .from("webhooks_saida")
    .select("id, url, segredo")
    .eq("id", id)
    .maybeSingle();
  if (!webhook) {
    return { ok: false, erro: "Webhook não encontrado." };
  }

  const corpo = JSON.stringify({
    evento: "ping",
    dados: { mensagem: "Entrega de teste da central de configuração ImobIA." },
    emitidoEm: new Date().toISOString(),
  });

  let status: number | null = null;
  try {
    const resposta = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-imobia-signature": assinarCorpoWebhook(corpo, webhook.segredo),
      },
      body: corpo,
      signal: AbortSignal.timeout(8_000),
    });
    status = resposta.status;
  } catch {
    status = null; // timeout/rede — devolvemos null e a UI explica
  }

  await supabase
    .from("webhooks_saida")
    .update({ ultima_entrega_em: new Date().toISOString(), ultima_entrega_status: status })
    .eq("id", id);
  revalidatePath("/corretor/config");
  return { ok: true, status };
}

/** Remove o webhook definitivamente (o segredo morre junto). */
export async function removerWebhookSaidaAction(id: string): Promise<ResultadoSimples> {
  try {
    await exigirGestor();
  } catch {
    return { ok: false, erro: SEM_PERMISSAO };
  }
  if (!idSchema.safeParse(id).success) {
    return { ok: false, erro: "Webhook inválido." };
  }
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("webhooks_saida").delete().eq("id", id);
  if (error) {
    return { ok: false, erro: "Não foi possível remover o webhook." };
  }
  revalidatePath("/corretor/config");
  return { ok: true };
}

/** Reativa um webhook desativado por falhas (zera o placar de falhas). */
export async function reativarWebhookSaidaAction(id: string): Promise<ResultadoSimples> {
  try {
    await exigirGestor();
  } catch {
    return { ok: false, erro: SEM_PERMISSAO };
  }
  if (!idSchema.safeParse(id).success) {
    return { ok: false, erro: "Webhook inválido." };
  }
  const supabase = await criarClienteServidor();
  const { error } = await supabase
    .from("webhooks_saida")
    .update({ ativo: true, falhas_seguidas: 0 })
    .eq("id", id);
  if (error) {
    return { ok: false, erro: "Não foi possível reativar o webhook." };
  }
  revalidatePath("/corretor/config");
  return { ok: true };
}

// ============================================================================
// 3) EQUIPE & CONVITES (RPCs SECURITY DEFINER da 0033 + perfis)
// ============================================================================

/** Membros da equipe da org (corretor/gestor/admin), ordem alfabética. */
export async function listarMembrosDaOrg(): Promise<MembroOrg[]> {
  try {
    await exigirGestor();
  } catch {
    return [];
  }
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("perfis")
    .select("id, nome, papel, criado_em")
    .in("papel", ["corretor", "gestor", "admin"])
    .order("nome", { ascending: true, nullsFirst: false });
  return (data ?? []).map((p) => ({
    id: p.id,
    nome: p.nome,
    papel: p.papel as Papel,
    desde: p.criado_em,
  }));
}

/** Convites da org (pendentes/consumidos/expirados) — SEM o código. */
export async function listarConvites(): Promise<ConviteResumo[]> {
  const sessao = await obterSessao();
  if (!sessao) {
    return [];
  }
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("listar_convites");
  if (error) {
    return []; // 42501 (não é gestor) degrada para lista vazia
  }
  return (data ?? []).map((c) => ({
    id: c.id,
    email: c.email,
    papel: c.papel,
    status: (["pendente", "consumido", "expirado"].includes(c.status)
      ? c.status
      : "expirado") as ConviteResumo["status"],
    expiraEm: c.expira_em,
    criadoEm: c.criado_em,
  }));
}

const conviteSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(160),
  papel: z.enum(["corretor", "gestor"]),
});

/**
 * Emite um convite para `email` entrar na org com `papel`. O CÓDIGO volta UMA
 * única vez — quem se cadastrar com este e-mail + código é promovido no signup
 * (handle_new_user 0004). Se perder o código: revogue e emita outro.
 */
export async function emitirConviteAction(input: {
  email: string;
  papel: "corretor" | "gestor";
}): Promise<
  | { ok: true; codigo: string; email: string; papel: string; expiraEm: string }
  | { ok: false; erro: string }
> {
  const parsed = conviteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: "Confira o e-mail e o papel (corretor ou gestor)." };
  }
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("emitir_convite", {
    p_email: parsed.data.email,
    p_papel: parsed.data.papel,
  });
  if (error || !data || data.length === 0) {
    const erro =
      error?.code === "23505"
        ? "Já existe convite pendente para este e-mail — revogue-o para emitir outro."
        : error?.code === "42501"
          ? "Só gestor ou admin da organização emitem convites."
          : "Não foi possível emitir o convite. Tente novamente.";
    return { ok: false, erro };
  }
  const convite = data[0];
  revalidatePath("/corretor/config");
  return {
    ok: true,
    codigo: convite.codigo,
    email: convite.email,
    papel: convite.papel,
    expiraEm: convite.expira_em,
  };
}

/** Revoga um convite ainda não consumido. */
export async function revogarConviteAction(id: string): Promise<ResultadoSimples> {
  if (!idSchema.safeParse(id).success) {
    return { ok: false, erro: "Convite inválido." };
  }
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("revogar_convite", { p_id: id });
  if (error) {
    return { ok: false, erro: "Não foi possível revogar o convite." };
  }
  if (data !== true) {
    return { ok: false, erro: "Convite não encontrado (ou já consumido)." };
  }
  revalidatePath("/corretor/config");
  return { ok: true };
}

// ============================================================================
// 4) METAS DO TIME (metas_corretor — alvo individual de vendas/receita)
// ============================================================================

/** Corretores + gestores da org com a meta individual atual (0 = sem meta). */
export async function listarMetasDoTime(): Promise<MetaCorretorLinha[]> {
  try {
    await exigirGestor();
  } catch {
    return [];
  }
  const supabase = await criarClienteServidor();
  const [{ data: perfis }, { data: metas }] = await Promise.all([
    supabase
      .from("perfis")
      .select("id, nome, papel")
      .in("papel", ["corretor", "gestor"])
      .order("nome", { ascending: true, nullsFirst: false }),
    supabase.from("metas_corretor").select("corretor_id, vendas_mes, receita_mes_centavos"),
  ]);
  const porCorretor = new Map(
    (metas ?? []).map((m) => [
      m.corretor_id,
      { vendas: m.vendas_mes ?? 0, receita: m.receita_mes_centavos ?? 0 },
    ]),
  );
  return (perfis ?? []).map((p) => ({
    corretorId: p.id,
    nome: p.nome,
    papel: p.papel as Papel,
    vendasMes: porCorretor.get(p.id)?.vendas ?? 0,
    receitaMesCentavos: porCorretor.get(p.id)?.receita ?? 0,
  }));
}

const metasTimeSchema = z
  .array(
    z.object({
      corretorId: idSchema,
      vendasMes: z.number().int().min(0).max(100_000),
      receitaMesCentavos: z.number().int().min(0).max(1_000_000_000_000),
    }),
  )
  .min(1)
  .max(200);

/** Upsert em LOTE das metas individuais (unique org_id+corretor_id, 0033). */
export async function salvarMetasTimeAction(
  itens: { corretorId: string; vendasMes: number; receitaMesCentavos: number }[],
): Promise<ResultadoSimples> {
  let ctx: { orgId: string };
  try {
    ctx = await exigirGestor();
  } catch {
    return { ok: false, erro: SEM_PERMISSAO };
  }
  const parsed = metasTimeSchema.safeParse(itens);
  if (!parsed.success) {
    return { ok: false, erro: "Confira as metas: use números inteiros não negativos." };
  }
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("metas_corretor").upsert(
    parsed.data.map((m) => ({
      org_id: ctx.orgId,
      corretor_id: m.corretorId,
      vendas_mes: m.vendasMes,
      receita_mes_centavos: m.receitaMesCentavos,
    })),
    { onConflict: "org_id,corretor_id" },
  );
  if (error) {
    return { ok: false, erro: "Não foi possível salvar as metas do time." };
  }
  revalidatePath("/corretor/config");
  revalidatePath("/corretor/equipe");
  return { ok: true };
}
