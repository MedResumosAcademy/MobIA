// Consentimento LGPD do cliente (Decisão 6 / ESCOPO §5). Portão OPT-IN: enquanto
// o cliente não consentir, corretor/gestor NÃO enxergam seu comportamento
// (leads, eventos, favoritos, simulações). A RLS impõe isso via
// privado.cliente_consentiu; aqui só gravamos/lemos a flag do PRÓPRIO cliente.
"use server";

import type { Database } from "@imobia/domain";
import { z } from "zod";
import { obterSessao } from "@/lib/auth/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";

type InsertClienteProfile = Database["public"]["Tables"]["cliente_profiles"]["Insert"];

// Telefone: 10–15 dígitos após remover a formatação (DDD + número, com/sem 55).
// Vazio/whitespace ⇒ null (limpa o telefone). Guarda só os dígitos.
const telefoneSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ""))
  .refine((d) => d.length === 0 || (d.length >= 10 && d.length <= 15), {
    message: "telefone inválido",
  })
  .transform((d) => (d.length === 0 ? null : d));

/**
 * Define o consentimento de leads do cliente logado (opt-in). UPSERT no próprio
 * cliente_profiles: grava consentimento_leads e carimba consentimento_leads_em
 * = now() quando concedido (limpa para null ao revogar). Só cliente autenticado;
 * anônimo é no-op silencioso (não há a quem gravar).
 */
export async function definirConsentimento(concedido: boolean): Promise<void> {
  const sessao = await obterSessao();
  if (!sessao) {
    return;
  }
  const supabase = await criarClienteServidor();
  const linha: InsertClienteProfile = {
    usuario_id: sessao.usuarioId,
    consentimento_leads: concedido,
    consentimento_leads_em: concedido ? new Date().toISOString() : null,
    atualizado_em: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("cliente_profiles")
    .upsert(linha, { onConflict: "usuario_id" });
  if (error) {
    throw new Error(`definirConsentimento: ${error.message}`);
  }
}

/**
 * Consentimento atual do cliente logado. `null` quando anônimo ou sem linha em
 * cliente_profiles (ainda não decidiu); caso contrário o boolean gravado.
 */
export async function obterConsentimento(): Promise<boolean | null> {
  const sessao = await obterSessao();
  if (!sessao) {
    return null;
  }
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("cliente_profiles")
    .select("consentimento_leads")
    .eq("usuario_id", sessao.usuarioId)
    .maybeSingle();
  if (error) {
    throw new Error(`obterConsentimento: ${error.message}`);
  }
  return data ? data.consentimento_leads : null;
}

/**
 * Grava o telefone de contato do PRÓPRIO cliente logado. UPSERT em
 * cliente_profiles (usuario_id = auth.uid()); a policy cliente_profiles_update
 * (0007) restringe ao próprio registro. Só armazena dígitos; string vazia limpa
 * o telefone (null). Só cliente autenticado; anônimo é no-op silencioso.
 */
export async function atualizarMeuTelefone(telefone: string): Promise<void> {
  const sessao = await obterSessao();
  if (!sessao) {
    return;
  }
  const telefoneLimpo = telefoneSchema.parse(telefone);
  const supabase = await criarClienteServidor();
  const linha: InsertClienteProfile = {
    usuario_id: sessao.usuarioId,
    telefone: telefoneLimpo,
    atualizado_em: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("cliente_profiles")
    .upsert(linha, { onConflict: "usuario_id" });
  if (error) {
    throw new Error(`atualizarMeuTelefone: ${error.message}`);
  }
}

/**
 * Telefone atual (dígitos) do cliente logado. `null` quando anônimo, sem linha
 * em cliente_profiles ou sem telefone gravado.
 */
export async function obterMeuTelefone(): Promise<string | null> {
  const sessao = await obterSessao();
  if (!sessao) {
    return null;
  }
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("cliente_profiles")
    .select("telefone")
    .eq("usuario_id", sessao.usuarioId)
    .maybeSingle();
  if (error) {
    throw new Error(`obterMeuTelefone: ${error.message}`);
  }
  return data?.telefone ?? null;
}
