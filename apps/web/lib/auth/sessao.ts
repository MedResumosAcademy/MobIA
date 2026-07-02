import { cache } from "react";
import { papelSchema, type Papel } from "@mobia/domain";
import { criarClienteServidor } from "@/lib/supabase/server";

export type Sessao = { usuarioId: string; email: string | null };

export type Perfil = { papel: Papel; orgId: string | null; nome: string | null };

/** Sessão verificada (claims do JWT validadas) — null quando não logado. */
export const obterSessao = cache(async (): Promise<Sessao | null> => {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) {
    return null;
  }
  const { claims } = data;
  return {
    usuarioId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
  };
});

/**
 * Perfil em public.perfis. Degrada graciosamente: tabela ausente, linha
 * inexistente ou papel inválido ⇒ null (quem chama trata como 'cliente').
 */
export const obterPerfil = cache(async (usuarioId: string): Promise<Perfil | null> => {
  try {
    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("perfis")
      .select("papel, org_id, nome")
      .eq("id", usuarioId)
      .maybeSingle();
    if (error || !data) {
      return null;
    }
    const papel = papelSchema.safeParse(data.papel);
    if (!papel.success) {
      return null;
    }
    return { papel: papel.data, orgId: data.org_id ?? null, nome: data.nome ?? null };
  } catch {
    return null;
  }
});
