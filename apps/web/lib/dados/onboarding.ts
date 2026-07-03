// Camada de dados + Server Action do ONBOARDING DO CORRETOR (primeiro acesso).
// Módulo server-side ("use server": só exporta funções async).
//
// ESCOPO/RLS: as escritas derivam o alvo da SESSÃO (usuario_id/id = auth.uid());
// as policies perfis_update e corretor_profiles_update (self) cobrem. Limitamos
// explicitamente as colunas gravadas (NUNCA repassamos org_id).
//
// PRIVACIDADE: o CPF é DADO SENSÍVEL — este módulo NUNCA o loga nem o devolve
// em mensagens de erro. Validação forte dos dígitos verificadores via
// `validarCpf` (@imobia/core); forma via onboardingCorretorSchema (@imobia/domain).
// Dinheiro em CENTAVOS. pt-BR.

"use server";

import { validarCpf } from "@imobia/core";
import { onboardingCorretorSchema } from "@imobia/domain";
import { obterPerfil, obterSessao } from "@/lib/auth/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";

export type ResultadoOnboarding = { ok: true } | { ok: false; erro: string };

/**
 * Situação do onboarding do usuário logado. Pendente APENAS quando o papel é
 * 'corretor' e corretor_profiles.onboarding_em ainda é null. Gestor/admin/
 * cliente (e sessão anônima ou erro de leitura) ⇒ nunca pendente — degrada
 * graciosamente para não trancar ninguém fora do app.
 */
export async function statusOnboarding(): Promise<{ pendente: boolean }> {
  const sessao = await obterSessao();
  if (!sessao) {
    return { pendente: false };
  }
  const perfil = await obterPerfil(sessao.usuarioId);
  if (perfil?.papel !== "corretor") {
    return { pendente: false };
  }
  try {
    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("corretor_profiles")
      .select("onboarding_em")
      .eq("usuario_id", sessao.usuarioId)
      .maybeSingle();
    if (error || !data) {
      return { pendente: false };
    }
    return { pendente: data.onboarding_em == null };
  } catch {
    return { pendente: false };
  }
}

/**
 * Dados atuais para PRÉ-PREENCHER o wizard (nome do perfil + creci vindo do
 * convite, se houver). Null quando não aplicável.
 */
export async function dadosIniciaisOnboarding(): Promise<{
  nome: string | null;
  creci: string | null;
} | null> {
  const sessao = await obterSessao();
  if (!sessao) {
    return null;
  }
  const perfil = await obterPerfil(sessao.usuarioId);
  if (perfil?.papel !== "corretor") {
    return null;
  }
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("corretor_profiles")
    .select("creci")
    .eq("usuario_id", sessao.usuarioId)
    .maybeSingle();
  return { nome: perfil.nome ?? null, creci: data?.creci ?? null };
}

/**
 * Conclui o onboarding do corretor logado: valida o payload (forma via zod;
 * CPF forte via @imobia/core), grava perfis.nome e os campos de
 * corretor_profiles, e marca onboarding_em = now(). O alvo é SEMPRE a sessão.
 */
export async function concluirOnboardingAction(
  input: unknown,
): Promise<ResultadoOnboarding> {
  const sessao = await obterSessao();
  if (!sessao) {
    return { ok: false, erro: "Sessão expirada. Entre novamente." };
  }
  const perfil = await obterPerfil(sessao.usuarioId);
  if (perfil?.papel !== "corretor") {
    return { ok: false, erro: "Apenas corretores concluem este cadastro." };
  }

  const parsed = onboardingCorretorSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: "Dados inválidos. Revise os campos e tente de novo." };
  }
  const d = parsed.data;
  if (!validarCpf(d.cpf)) {
    return { ok: false, erro: "CPF inválido" };
  }

  const supabase = await criarClienteServidor();

  // Onboarding é de USO ÚNICO: concluído, a action não regrava nada (edições
  // pós-onboarding têm fluxo próprio — EditarPerfil). Evita virar um "trocar
  // CPF a qualquer momento" sem UI correspondente.
  const { data: atual } = await supabase
    .from("corretor_profiles")
    .select("onboarding_em")
    .eq("usuario_id", sessao.usuarioId)
    .maybeSingle();
  if (!atual) {
    return { ok: false, erro: "Perfil de corretor não encontrado." };
  }
  if (atual.onboarding_em != null) {
    return { ok: false, erro: "Seu cadastro já foi concluído." };
  }

  // 1) Dados do corretor — SÓ as colunas do onboarding (nunca org_id). O filtro
  //    onboarding_em IS NULL torna a conclusão atômica também contra corrida
  //    (duas submissões simultâneas: só uma grava).
  const { data: linha, error: erroCp } = await supabase
    .from("corretor_profiles")
    .update({
      cpf: d.cpf,
      creci: d.creci,
      cidade: d.cidade,
      telefone: d.telefone ?? null,
      bio: d.bio?.trim() ? d.bio.trim() : null,
      instagram: d.instagram?.trim() ? d.instagram.trim() : null,
      foto_url: d.fotoUrl ? d.fotoUrl : null,
      permitir_foto: d.permitirFoto,
      vendas_previas_valor: d.vendasPreviasValor ?? null,
      vendas_previas_qtd: d.vendasPreviasQtd ?? null,
      onboarding_em: new Date().toISOString(),
    })
    .eq("usuario_id", sessao.usuarioId)
    .is("onboarding_em", null)
    .select("usuario_id")
    .maybeSingle();

  // NUNCA repassar detalhes do erro do banco (pode ecoar valores da linha).
  if (erroCp) {
    return { ok: false, erro: "Não foi possível concluir o cadastro. Tente novamente." };
  }
  if (!linha) {
    return { ok: false, erro: "Seu cadastro já foi concluído." };
  }

  // 2) Nome em perfis (policy perfis_update: só o próprio id). Best-effort:
  //    o essencial do onboarding já foi gravado acima; se o nome falhar, o
  //    valor do signup permanece — não deixamos o corretor preso no wizard.
  await supabase.from("perfis").update({ nome: d.nome }).eq("id", sessao.usuarioId);

  return { ok: true };
}
