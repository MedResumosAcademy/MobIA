// WEBHOOKS DE SAÍDA (migração 0033, tabela webhooks_saida) — avisa sistemas
// externos (Zapier/Make/RD…) quando algo acontece no CRM: contato.criado,
// contato.mudou_etapa, negocio.ganho.
//
// CONTRATO DA ENTREGA: POST JSON { evento, dados, emitidoEm } com o header
// x-imobia-signature = HMAC-SHA256 (hex) do CORPO EXATO, assinado com o
// segredo do webhook (o destino valida recalculando sobre o corpo bruto).
// Timeout de 8s por entrega; 5 falhas SEGUIDAS desativam o webhook (ativo =
// false — o gestor reativa na central após corrigir o destino).
//
// EXECUÇÃO: sempre via after() do next/server nos pontos de emissão — a
// entrega NUNCA atrasa a action do usuário. Usa o client SERVICE ROLE
// (server-only): quem dispara o evento pode ser um corretor, e a RLS de
// webhooks_saida (gestor/admin) esconderia os webhooks dele — o emissor
// precisa enxergar os webhooks da org de qualquer gatilho autorizado. Sem
// SUPABASE_SERVICE_ROLE_KEY no ambiente, degrada para no-op silencioso.
//
// SEGURANÇA/PRIVACIDADE: o segredo JAMAIS é logado ou retornado; o payload é
// mínimo (sem CPF — telefone ok: o destino é do próprio gestor). Nunca lança.

import { createHmac } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database, EventoWebhook } from "@imobia/domain";
import { SUPABASE_URL } from "@/lib/supabase/config";

const TIMEOUT_ENTREGA_MS = 8_000;
const FALHAS_PARA_DESATIVAR = 5;

/** HMAC-SHA256 (hex) do corpo com o segredo — especificação PURA, testada. */
export function assinarCorpoWebhook(corpo: string, segredo: string): string {
  return createHmac("sha256", segredo).update(corpo, "utf8").digest("hex");
}

function clienteServico(): SupabaseClient<Database> | null {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return null;
  }
  return createClient<Database>(SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type LinhaWebhook = {
  id: string;
  url: string;
  segredo: string;
  falhas_seguidas: number;
};

/** Entrega para UM webhook e atualiza o placar (falhas seguidas/desativação). */
async function entregar(
  supabase: SupabaseClient<Database>,
  webhook: LinhaWebhook,
  corpo: string,
): Promise<void> {
  let status: number | null = null;
  try {
    const resposta = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-imobia-signature": assinarCorpoWebhook(corpo, webhook.segredo),
      },
      body: corpo,
      signal: AbortSignal.timeout(TIMEOUT_ENTREGA_MS),
    });
    status = resposta.status;
  } catch {
    status = null; // timeout/rede — conta como falha, sem detalhes em log
  }

  const sucesso = status !== null && status >= 200 && status < 300;
  const falhas = sucesso ? 0 : webhook.falhas_seguidas + 1;
  await supabase
    .from("webhooks_saida")
    .update({
      ultima_entrega_em: new Date().toISOString(),
      ultima_entrega_status: status,
      falhas_seguidas: falhas,
      // 5 falhas seguidas ⇒ desativa (registro fica; o gestor reativa depois).
      ...(falhas >= FALHAS_PARA_DESATIVAR ? { ativo: false } : {}),
    })
    .eq("id", webhook.id);
}

/**
 * Emite `evento` para todos os webhooks ATIVOS da org que o assinam.
 * Chame dentro de after() — nunca bloqueie a action. Nunca lança.
 */
export async function emitirEvento(
  orgId: string,
  evento: EventoWebhook,
  dados: Record<string, unknown>,
): Promise<void> {
  try {
    const supabase = clienteServico();
    if (supabase === null) {
      return; // ambiente sem service role — webhooks de saída indisponíveis
    }
    const { data: webhooks } = await supabase
      .from("webhooks_saida")
      .select("id, url, segredo, falhas_seguidas")
      .eq("org_id", orgId)
      .eq("ativo", true)
      .contains("eventos", [evento]);
    if (!webhooks || webhooks.length === 0) {
      return;
    }
    const corpo = JSON.stringify({
      evento,
      dados,
      emitidoEm: new Date().toISOString(),
    });
    await Promise.all(webhooks.map((w) => entregar(supabase, w, corpo)));
  } catch {
    // Best-effort de propósito: entrega externa nunca derruba o fluxo interno.
  }
}
