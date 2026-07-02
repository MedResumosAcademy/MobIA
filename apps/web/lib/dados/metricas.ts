// Camada de dados do DASHBOARD GERENCIAL (KPIs do funil). Módulo server-side
// (NÃO é "use server": exporta tipos além de funções async).
//
// ESCOPO/RLS: a sessão é usada via criarClienteServidor; a RLS multi-tenant cuida
// do escopo. Aqui traduzimos um `escopo` de negócio ("org" = toda a org do
// gestor; "meu" = os negócios do corretor logado) em um filtro explícito por
// corretor_id quando "meu". Para "org", a query enxerga o que a RLS permite (o
// gestor vê a org; o corretor sempre vê só os seus — então "org" degrada para os
// seus, o que é seguro).
//
// A agregação é PURA: reduzimos os negócios ao formato de @imobia/core e
// chamamos metricasGerenciais(negocios, hoje), com `hoje` (ISO YYYY-MM-DD)
// injetado. Somamos KPIs de tarefas (pendentes/atrasadas) e a distribuição de
// leads por temperatura para o topo do painel. Objeto rico e serializável.

import {
  metricasGerenciais,
  type MetricasGerenciais,
  type NegocioMetricas,
} from "@imobia/core";
import type { Database, Temperatura } from "@imobia/domain";
import { obterSessao } from "@/lib/auth/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import { resumoDaOrg } from "./gestor";

type LinhaNegocio = Database["public"]["Tables"]["negocios"]["Row"];

/** Escopo do dashboard: toda a org (gestor) ou só os negócios do corretor. */
export type EscopoDashboard = "org" | "meu";

/** Contagem de tarefas pendentes do escopo (total + quantas atrasadas). */
export type ResumoTarefas = {
  pendentes: number;
  atrasadas: number;
};

/** Dashboard gerencial completo (serializável). */
export type DashboardGerencial = {
  escopo: EscopoDashboard;
  /** Métricas puras do funil (@imobia/core). */
  metricas: MetricasGerenciais;
  tarefas: ResumoTarefas;
  /**
   * Distribuição de leads por temperatura calculada — só preenchida no escopo
   * "org" (gestor). Em "meu" fica com zeros (o corretor usa outra visão).
   */
  leadsPorTemperatura: Record<Temperatura, number>;
};

/** Data ISO (YYYY-MM-DD) de "hoje" no servidor. */
function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

type LinhaNegocioMetricas = Pick<
  LinhaNegocio,
  "etapa" | "resultado" | "valor" | "criado_em" | "fechado_em" | "corretor_id"
> & { corretor: { nome: string | null } | null };

function coagirResultadoMetricas(v: string | null): "ganho" | "perdido" | null {
  return v === "ganho" || v === "perdido" ? v : null;
}

function paraNegocioMetricas(linha: LinhaNegocioMetricas): NegocioMetricas {
  return {
    etapa: linha.etapa as NegocioMetricas["etapa"],
    resultado: coagirResultadoMetricas(linha.resultado),
    valor: linha.valor,
    criadoEm: linha.criado_em,
    fechadoEm: linha.fechado_em,
    corretorId: linha.corretor_id,
    corretorNome: linha.corretor?.nome ?? undefined,
  };
}

const TEMPERATURA_ZERADA: Record<Temperatura, number> = {
  quente: 0,
  muito_quente: 0,
  pronto_para_compra: 0,
};

/**
 * Monta o dashboard gerencial para o `escopo`:
 * - "org": todos os negócios visíveis (gestor: a org) + tarefas pendentes da
 *   visão + leads por temperatura (via resumoDaOrg).
 * - "meu": apenas os negócios/tarefas do corretor logado; leads zerados.
 *
 * Carrega os negócios com o nome do corretor (join em perfis), reduz ao formato
 * de @imobia/core e chama metricasGerenciais(negocios, hoje). Sessão anônima ⇒
 * dashboard vazio (métricas zeradas). Objeto serializável.
 */
export async function dashboardGerencial(escopo: EscopoDashboard): Promise<DashboardGerencial> {
  const hoje = hojeIso();
  const sessao = await obterSessao();
  if (!sessao) {
    return {
      escopo,
      metricas: metricasGerenciais([], hoje),
      tarefas: { pendentes: 0, atrasadas: 0 },
      leadsPorTemperatura: { ...TEMPERATURA_ZERADA },
    };
  }

  const supabase = await criarClienteServidor();

  // Negócios do escopo (a RLS já restringe; "meu" filtra pelo corretor logado).
  let negociosQuery = supabase
    .from("negocios")
    .select(
      "etapa, resultado, valor, criado_em, fechado_em, corretor_id, corretor:perfis!negocios_corretor_id_fkey(nome)",
    );
  if (escopo === "meu") {
    negociosQuery = negociosQuery.eq("corretor_id", sessao.usuarioId);
  }

  // Tarefas pendentes do escopo (para os KPIs; vence_em p/ contar atrasadas).
  let tarefasQuery = supabase
    .from("negocio_tarefas")
    .select("vence_em")
    .eq("concluida", false);
  if (escopo === "meu") {
    tarefasQuery = tarefasQuery.eq("corretor_id", sessao.usuarioId);
  }

  const [{ data: negocios, error: erroNegocios }, { data: tarefas, error: erroTarefas }] =
    await Promise.all([negociosQuery, tarefasQuery]);

  if (erroNegocios) {
    throw new Error(`dashboardGerencial(negocios): ${erroNegocios.message}`);
  }
  if (erroTarefas) {
    throw new Error(`dashboardGerencial(tarefas): ${erroTarefas.message}`);
  }

  const metricas = metricasGerenciais(
    (negocios ?? []).map((n) => paraNegocioMetricas(n as LinhaNegocioMetricas)),
    hoje,
  );

  const tarefasResumo: ResumoTarefas = { pendentes: 0, atrasadas: 0 };
  for (const t of tarefas ?? []) {
    tarefasResumo.pendentes += 1;
    if (t.vence_em !== null && t.vence_em < hoje) {
      tarefasResumo.atrasadas += 1;
    }
  }

  // Leads por temperatura só no escopo "org" (reusa resumoDaOrg do gestor).
  let leadsPorTemperatura: Record<Temperatura, number> = { ...TEMPERATURA_ZERADA };
  if (escopo === "org") {
    try {
      const resumo = await resumoDaOrg();
      leadsPorTemperatura = resumo.leadsPorTemperatura;
    } catch {
      // Corretor sem permissão de gestor: mantém zerado (não quebra o painel).
      leadsPorTemperatura = { ...TEMPERATURA_ZERADA };
    }
  }

  return { escopo, metricas, tarefas: tarefasResumo, leadsPorTemperatura };
}
