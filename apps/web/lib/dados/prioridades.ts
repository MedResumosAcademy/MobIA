// Camada de dados da FILA DE PRIORIDADES da CENTRAL DE COMANDO. Módulo
// server-side (NÃO é "use server": exporta tipos além de funções async).
//
// ESCOPO/RLS: reusa as leituras já escopadas (listarNegocios, minhasTarefas/
// tarefasDaOrg, listarLeads) — a RLS impôs a visão (corretor: os seus;
// gestor/admin: a org). Para "meu", filtramos negócios por corretor da sessão e
// usamos minhasTarefas; para "org", tarefasDaOrg (que exige gestor) com fallback
// gracioso para as próprias tarefas se o usuário não for gestor.
//
// A COMBINAÇÃO/RANQUEAMENTO é pura e vive em prioridades-fila.ts (montarFila,
// testada sem banco); aqui ficam as leituras e o ícone lucide por categoria.

import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Clock, Flame } from "lucide-react";
import { listarLeads } from "@/lib/dados/leads";
import { listarNegocios } from "@/lib/dados/negocios";
import {
  montarFila,
  type CategoriaPrioridade,
  type ItemPrioridadeBase,
} from "@/lib/dados/prioridades-fila";
import { minhasTarefas, tarefasDaOrg } from "@/lib/dados/tarefas";
import { obterSessao } from "@/lib/auth/sessao";

export type { CategoriaPrioridade, NivelPrioridade } from "@/lib/dados/prioridades-fila";

/** Escopo da fila: toda a org (gestor) ou só os dados do corretor. */
export type EscopoPrioridades = "org" | "meu";

/** Um item acionável da fila de prioridades — pronto para a UI. */
export type ItemPrioridade = ItemPrioridadeBase & {
  /** Ícone lucide-react (componente) para a UI renderizar. */
  icone: LucideIcon;
};

/** Ícone por categoria (a montagem pura não conhece componentes de UI). */
const ICONE_POR_CATEGORIA: Record<CategoriaPrioridade, LucideIcon> = {
  negocio_parado: AlertTriangle,
  tarefa_atrasada: Clock,
  lead_quente: Flame,
};

/**
 * Fila de prioridades ranqueada para o `escopo`. Combina negócios parados/em
 * atenção, tarefas atrasadas e leads quentes sem negócio aberto. Ordena por
 * nível (crítico → alto → médio) e depois por categoria (parados/atrasadas antes
 * de leads), truncando em ~10 itens. Anônimo/cliente ⇒ [] (as leituras guardam).
 */
export async function prioridades(escopo: EscopoPrioridades): Promise<ItemPrioridade[]> {
  const sessao = await obterSessao();
  if (!sessao) {
    return [];
  }

  // Negócios do escopo ("meu" filtra por corretor da sessão; "org" = visão RLS).
  const filtrosNegocios = escopo === "meu" ? { responsavelId: sessao.usuarioId } : {};

  // Tarefas: no escopo "org" tenta a visão do gestor; se não for gestor, cai para
  // as próprias tarefas (não quebra a central para um corretor).
  const tarefasPromise =
    escopo === "org"
      ? tarefasDaOrg().catch(() => minhasTarefas())
      : minhasTarefas();

  const [negocios, tarefas, leads] = await Promise.all([
    listarNegocios(filtrosNegocios),
    tarefasPromise,
    listarLeads(),
  ]);

  return montarFila(negocios, tarefas, leads).map((item) => ({
    ...item,
    icone: ICONE_POR_CATEGORIA[item.categoria],
  }));
}
