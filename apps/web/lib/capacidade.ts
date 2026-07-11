// Leitura da CAPACIDADE atual do cliente (E5 / H-18) — fonte para filtrar o
// catálogo por "imóveis compatíveis". Prioriza o cookie 'imobia_capacidade'
// (serve anônimo e é a última interação do Sonhômetro); no fallback, para o
// cliente logado, lê cliente_profiles.capacidade_calculada.
"use server";

import { cookies } from "next/headers";
import { obterSessao } from "@/lib/auth/sessao";
import { COOKIE_CAPACIDADE, lerCookieCapacidade } from "@/lib/capacidade-cookie";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * Capacidade atual em CENTAVOS, ou null se desconhecida/desligada. Ordem:
 * cookie 'imobia_capacidade' → (se logado) cliente_profiles.capacidade_calculada.
 */
export async function obterCapacidadeAtual(): Promise<number | null> {
  const cookieStore = await cookies();
  const doCookie = lerCookieCapacidade(cookieStore.get(COOKIE_CAPACIDADE)?.value);
  if (doCookie !== null) {
    return doCookie;
  }

  const sessao = await obterSessao();
  if (!sessao) {
    return null;
  }
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("cliente_profiles")
    .select("capacidade_calculada")
    .eq("usuario_id", sessao.usuarioId)
    .maybeSingle();
  if (error || !data || data.capacidade_calculada === null) {
    return null;
  }
  return data.capacidade_calculada;
}

/** Apaga o cookie de capacidade — usado pelo toggle "ver todos" (H-18). */
export async function limparCapacidade(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_CAPACIDADE);
}
