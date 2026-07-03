// Camada de dados de FAVORITOS (E6 / H-19) — funções server-side.
// RLS: favoritos.cliente_id = auth.uid() nas policies; org_id é preenchido por
// TRIGGER a partir do imóvel — NUNCA enviado no insert (anti-forja).
// Anônimo/corretor-gestor: leitura vazia; escrita exige cliente logado.
"use server";

import type { Database } from "@imobia/domain";
import { obterSessao } from "@/lib/auth/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import { registrarEvento } from "./eventos";
import { PrecisaLoginError } from "./favoritos-erros";
import { mapCardImovel, type CardImovel } from "./imoveis";

type LinhaImovel = Database["public"]["Tables"]["imoveis"]["Row"];
type InsertFavorito = Database["public"]["Tables"]["favoritos"]["Insert"];

/**
 * Favoritos do cliente logado, como cards prontos para a UI (join no imóvel).
 * Reusa o mapeamento de card de imoveis.ts. Vazio se anônimo (a RLS já limita
 * ao próprio cliente; o guard evita a query desnecessária).
 */
export async function listarFavoritos(): Promise<CardImovel[]> {
  const sessao = await obterSessao();
  if (!sessao) {
    return [];
  }
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("favoritos")
    .select("imovel:imoveis(*)")
    .order("criado_em", { ascending: false });
  if (error) {
    throw new Error(`listarFavoritos: ${error.message}`);
  }
  return (data ?? [])
    .map((linha) => linha.imovel as LinhaImovel | null)
    .filter((imovel): imovel is LinhaImovel => imovel !== null)
    .map(mapCardImovel);
}

/** Conjunto dos imovel_id favoritados pelo cliente (marca corações no catálogo). Vazio se anônimo. */
export async function idsFavoritos(): Promise<Set<string>> {
  const sessao = await obterSessao();
  if (!sessao) {
    return new Set();
  }
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("favoritos").select("imovel_id");
  if (error) {
    throw new Error(`idsFavoritos: ${error.message}`);
  }
  return new Set((data ?? []).map((linha) => linha.imovel_id));
}

/**
 * Alterna o favorito do imóvel para o cliente logado: se já favoritado, remove;
 * senão insere. NÃO envia org_id (o trigger preenche a partir do imóvel).
 * Registra evento 'favorito' apenas no insert. Lança PrecisaLoginError se
 * anônimo. Retorna o estado resultante (true = agora favoritado).
 */
export async function alternarFavorito(imovelId: string): Promise<boolean> {
  const sessao = await obterSessao();
  if (!sessao) {
    throw new PrecisaLoginError();
  }
  const supabase = await criarClienteServidor();

  const { data: existente, error: erroBusca } = await supabase
    .from("favoritos")
    .select("id")
    .eq("cliente_id", sessao.usuarioId)
    .eq("imovel_id", imovelId)
    .maybeSingle();
  if (erroBusca) {
    throw new Error(`alternarFavorito(busca): ${erroBusca.message}`);
  }

  if (existente) {
    const { error } = await supabase.from("favoritos").delete().eq("id", existente.id);
    if (error) {
      throw new Error(`alternarFavorito(remover): ${error.message}`);
    }
    return false;
  }

  // org_id NÃO é enviado — o trigger o preenche a partir do imóvel. O tipo
  // gerado o marca obrigatório, daí o cast do payload parcial.
  const insert = {
    cliente_id: sessao.usuarioId,
    imovel_id: imovelId,
  } as InsertFavorito;
  const { error } = await supabase.from("favoritos").insert(insert);
  // 23505 = unique_violation (duplo-clique passou duas vezes pelo check acima):
  // a linha já existe — idempotente, é sucesso (mesmo padrão de curtirAction).
  if (error && error.code !== "23505") {
    throw new Error(`alternarFavorito(inserir): ${error.message}`);
  }
  if (!error) {
    // O favorito JÁ está salvo: falha na captura do sinal (E7) não pode
    // desfazer a percepção de sucesso — loga e segue.
    try {
      await registrarEvento("favorito", { imovelId });
    } catch (e) {
      console.error("alternarFavorito(evento):", e);
    }
  }
  return true;
}
