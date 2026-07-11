// Camada de dados + Server Action do PAINEL DO GESTOR (ESCOPO §5). Módulo
// server-side ("use server": só exporta funções async + tipos, que são
// apagados na compilação — mesmo padrão de coringa.ts).
//
// A sessão do gestor é usada via criarClienteServidor; a RLS multi-tenant cuida
// do escopo (própria org) e do PORTÃO DE CONSENTIMENTO LGPD (leads/perfis só de
// clientes que consentiram). Aqui NÃO reforçamos consentimento por conta
// própria: o que a query enxerga já está autorizado.
//
// TERMÔMETRO: a temperatura vem SEMPRE do motor puro (@imobia/core) a partir dos
// contadores materializados na linha do lead — NUNCA da coluna `temperatura`.

"use server";

import { calcularTemperatura } from "@imobia/core";
import type { Database, Papel, StatusImovel, Temperatura } from "@imobia/domain";
import { obterPerfil, obterSessao } from "@/lib/auth/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";

type LinhaLead = Database["public"]["Tables"]["leads"]["Row"];

// --- Tipos de saída (camelCase, prontos para a UI) ---

export type ResumoOrg = {
  imoveisTotal: number;
  imoveisPorStatus: Record<StatusImovel, number>;
  /** Leads visíveis (consentidos) da org. */
  leadsTotal: number;
  /** Distribuição de leads por temperatura calculada (@imobia/core). */
  leadsPorTemperatura: Record<Temperatura, number>;
  corretoresTotal: number;
};

export type CorretorOpcao = { id: string; nome: string | null };

export type ResultadoReatribuir =
  | { ok: true }
  | { ok: false; erro: string };

// --- Helpers ---

/** Contadores da linha do lead → temperatura calculada no motor puro. */
function temperaturaDaLinha(l: LinhaLead): Temperatura {
  return calcularTemperatura({
    visitas: l.visitas,
    simulacoes: l.simulacoes,
    favoritos: l.favoritos,
    cliquesFinanciamento: l.cliques_financiamento,
    retornos: l.retornos,
  }).temperatura;
}

/** Sessão + perfil do gestor/admin. Lança se não autorizado. Reusa obterPerfil. */
async function exigirGestor(): Promise<{ usuarioId: string; orgId: string; papel: Papel }> {
  const sessao = await obterSessao();
  if (!sessao) {
    throw new Error("não autenticado");
  }
  const perfil = await obterPerfil(sessao.usuarioId);
  if (!perfil || (perfil.papel !== "gestor" && perfil.papel !== "admin") || !perfil.orgId) {
    throw new Error("sem permissão de gestor");
  }
  return { usuarioId: sessao.usuarioId, orgId: perfil.orgId, papel: perfil.papel };
}

/** Papel + org do usuário logado (helper reutilizável). null se não autenticado. */
export async function obterPapelEOrg(): Promise<{ papel: Papel; orgId: string | null } | null> {
  const sessao = await obterSessao();
  if (!sessao) {
    return null;
  }
  const perfil = await obterPerfil(sessao.usuarioId);
  return { papel: perfil?.papel ?? "cliente", orgId: perfil?.orgId ?? null };
}

/**
 * Nome da organização do usuário logado (corretor ou gestor). A RLS
 * organizacoes_select libera só a própria org. null se indisponível/não-org.
 * NÃO exige gestor — o painel do corretor também exibe o nome da org.
 */
export async function obterNomeOrg(): Promise<string | null> {
  const contexto = await obterPapelEOrg();
  const orgId = contexto?.orgId;
  if (!orgId) {
    return null;
  }
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("organizacoes")
    .select("nome")
    .eq("id", orgId)
    .maybeSingle();
  if (error) {
    return null;
  }
  return data?.nome ?? null;
}

// --- Leitura (gestor logado; RLS impõe org + consentimento) ---

/**
 * Panorama da org: totais de imóveis (por status), de leads visíveis (por
 * temperatura calculada) e de corretores. A RLS limita a query à própria org
 * do gestor e aos leads de clientes consentidos.
 */
export async function resumoDaOrg(): Promise<ResumoOrg> {
  const { orgId } = await exigirGestor();
  const supabase = await criarClienteServidor();

  const [{ data: imoveis, error: erroImoveis }, { data: leads, error: erroLeads }, corretores] =
    await Promise.all([
      // Escopo explícito à org: a RLS de imoveis tem `imoveis_select_publico`
      // (status='disponivel') em OR com a policy da org, o que faria vazar para
      // o KPI todo imóvel disponível de OUTRAS orgs. Filtramos por org_id.
      supabase.from("imoveis").select("status").eq("org_id", orgId),
      supabase
        .from("leads")
        .select("visitas, simulacoes, favoritos, cliques_financiamento, retornos"),
      supabase.from("perfis").select("id").eq("papel", "corretor"),
    ]);

  if (erroImoveis) {
    throw new Error(`resumoDaOrg(imoveis): ${erroImoveis.message}`);
  }
  if (erroLeads) {
    throw new Error(`resumoDaOrg(leads): ${erroLeads.message}`);
  }
  if (corretores.error) {
    throw new Error(`resumoDaOrg(corretores): ${corretores.error.message}`);
  }

  const imoveisPorStatus: Record<StatusImovel, number> = {
    disponivel: 0,
    reservado: 0,
    vendido: 0,
  };
  for (const im of imoveis ?? []) {
    if (im.status === "disponivel" || im.status === "reservado" || im.status === "vendido") {
      imoveisPorStatus[im.status] += 1;
    }
  }

  const leadsPorTemperatura: Record<Temperatura, number> = {
    quente: 0,
    muito_quente: 0,
    pronto_para_compra: 0,
  };
  for (const l of leads ?? []) {
    leadsPorTemperatura[temperaturaDaLinha(l as LinhaLead)] += 1;
  }

  return {
    imoveisTotal: (imoveis ?? []).length,
    imoveisPorStatus,
    leadsTotal: (leads ?? []).length,
    leadsPorTemperatura,
    corretoresTotal: (corretores.data ?? []).length,
  };
}

/**
 * Corretores/gestores da org (para o SELECT de reatribuição). RLS de perfis
 * (gestor/admin veem os perfis da própria org) já limita o escopo.
 */
export async function listarCorretoresDaOrg(): Promise<CorretorOpcao[]> {
  await exigirGestor();
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("perfis")
    .select("id, nome")
    .in("papel", ["corretor", "gestor"])
    .order("nome", { ascending: true });
  if (error) {
    throw new Error(`listarCorretoresDaOrg: ${error.message}`);
  }
  return (data ?? []).map((p) => ({ id: p.id, nome: p.nome ?? null }));
}

// --- Escrita (Server Action) ---

/**
 * Reatribui um lead a outro corretor da org. A RLS (policy leads_update do
 * 0010) garante: só gestor/admin, só na própria org, só leads de clientes
 * consentidos, e corretor_id destino corretor/gestor da org. O trigger
 * bloquear_alteracao_estrutural_lead impede mudar cliente/imóvel/org.
 * Só gestor/admin. Retorna resultado tipado (ok/erro).
 */
export async function reatribuirLeadAction(
  leadId: string,
  corretorId: string,
): Promise<ResultadoReatribuir> {
  try {
    await exigirGestor();
  } catch {
    return { ok: false, erro: "Sem permissão para reatribuir leads." };
  }

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("leads")
    .update({ corretor_id: corretorId, atualizado_em: new Date().toISOString() })
    .eq("id", leadId)
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false, erro: "Não foi possível reatribuir o lead. Verifique o corretor." };
  }
  if (!data) {
    return { ok: false, erro: "Lead não encontrado ou fora do seu acesso." };
  }
  return { ok: true };
}
