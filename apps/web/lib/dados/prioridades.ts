// Camada de dados da FILA DE PRIORIDADES da CENTRAL DE COMANDO. Módulo
// server-side (NÃO é "use server": exporta tipos além de funções async).
//
// ESCOPO/RLS: reusa as leituras já escopadas (listarNegocios, minhasTarefas/
// tarefasDaOrg, listarLeads) — a RLS impôs a visão (corretor: os seus;
// gestor/admin: a org). Para "meu", filtramos negócios por corretor da sessão e
// usamos minhasTarefas; para "org", tarefasDaOrg (que exige gestor) com fallback
// gracioso para as próprias tarefas se o usuário não for gestor.
//
// A fila combina, ranqueada por urgência:
//   (a) NEGÓCIOS PARADOS: abertos com atenção 'parado' (>=14d) e depois 'atencao'
//       (7-13d) — a atenção vem do motor puro (via listarNegocios);
//   (b) TAREFAS ATRASADAS: vence_em < hoje e não concluída;
//   (c) LEADS QUENTES sem negócio: temperatura 'pronto_para_compra' que ainda NÃO
//       têm negócio ABERTO vinculado.
// Ordena por nível (crítico no topo) e limita a ~10 itens. pt-BR.

import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Clock, Flame } from "lucide-react";
import { listarLeads } from "@/lib/dados/leads";
import { listarNegocios, type NegocioResumo } from "@/lib/dados/negocios";
import { minhasTarefas, tarefasDaOrg, type TarefaResumo } from "@/lib/dados/tarefas";
import { obterSessao } from "@/lib/auth/sessao";

/** Escopo da fila: toda a org (gestor) ou só os dados do corretor. */
export type EscopoPrioridades = "org" | "meu";

/** Categoria do item — governa ícone/cor e ordenação secundária. */
export type CategoriaPrioridade = "negocio_parado" | "tarefa_atrasada" | "lead_quente";

/** Nível de urgência (governa a cor do selo e o ranqueamento primário). */
export type NivelPrioridade = "critico" | "alto" | "medio";

/** Um item acionável da fila de prioridades — pronto para a UI. */
export type ItemPrioridade = {
  /** Chave estável (categoria + id da entidade). */
  id: string;
  categoria: CategoriaPrioridade;
  nivel: NivelPrioridade;
  titulo: string;
  subtitulo: string;
  /** Rota de ação (ficha do negócio, tarefas do negócio ou conversão do lead). */
  href: string;
  /** Ícone lucide-react (componente) para a UI renderizar. */
  icone: LucideIcon;
};

// Peso de ordenação primário por nível (crítico primeiro).
const PESO_NIVEL: Record<NivelPrioridade, number> = { critico: 0, alto: 1, medio: 2 };
// Desempate por categoria: parados/atrasadas acima de leads quentes.
const PESO_CATEGORIA: Record<CategoriaPrioridade, number> = {
  negocio_parado: 0,
  tarefa_atrasada: 1,
  lead_quente: 2,
};

const LIMITE_ITENS = 10;

/** Um negócio está ABERTO quando ainda não tem resultado (ganho/perdido). */
function negocioAberto(n: NegocioResumo): boolean {
  return n.resultado === null;
}

/** Monta o item de um NEGÓCIO PARADO/EM ATENÇÃO (aberto, sem movimento). */
function itemNegocioParado(n: NegocioResumo): ItemPrioridade {
  const critico = n.atencao === "parado";
  return {
    id: `negocio_parado:${n.id}`,
    categoria: "negocio_parado",
    nivel: critico ? "critico" : "alto",
    titulo: n.nomeContato,
    subtitulo: `${n.diasSemMovimento} dia(s) sem movimento${
      n.imovelTitulo ? ` · ${n.imovelTitulo}` : ""
    }`,
    href: `/corretor/negocios/${n.id}`,
    icone: AlertTriangle,
  };
}

/** Monta o item de uma TAREFA ATRASADA (vence_em passado, não concluída). */
function itemTarefaAtrasada(t: TarefaResumo): ItemPrioridade {
  const sobre = t.negocioNomeContato ? ` · ${t.negocioNomeContato}` : "";
  return {
    id: `tarefa_atrasada:${t.id}`,
    categoria: "tarefa_atrasada",
    nivel: "critico",
    titulo: t.titulo,
    subtitulo: `Vencida em ${t.venceEm ?? "—"}${sobre}`,
    // As tarefas de um negócio vivem na ficha do negócio (não há sub-rota /tarefas).
    href: `/corretor/negocios/${t.negocioId}`,
    icone: Clock,
  };
}

/** Monta o item de um LEAD QUENTE sem negócio aberto (pronto para converter). */
function itemLeadQuente(lead: {
  id: string;
  clienteNome: string | null;
  imovelTitulo: string;
}): ItemPrioridade {
  return {
    id: `lead_quente:${lead.id}`,
    categoria: "lead_quente",
    nivel: "medio",
    titulo: lead.clienteNome ?? "Lead pronto para compra",
    subtitulo: `Pronto para compra · ${lead.imovelTitulo}`,
    // A conversão em negócio acontece na ficha do lead (não há sub-rota /converter).
    href: `/corretor/leads/${lead.id}`,
    icone: Flame,
  };
}

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

  const itens: ItemPrioridade[] = [];

  // (a) Negócios abertos parados (>=14d) ou em atenção (7-13d).
  for (const n of negocios) {
    if (negocioAberto(n) && (n.atencao === "parado" || n.atencao === "atencao")) {
      itens.push(itemNegocioParado(n));
    }
  }

  // (b) Tarefas atrasadas (a flag `atrasada` já é vence_em<hoje && !concluída).
  for (const t of tarefas) {
    if (t.atrasada) {
      itens.push(itemTarefaAtrasada(t));
    }
  }

  // (c) Leads quentes SEM negócio aberto vinculado (por lead_id).
  const leadsComNegocioAberto = new Set<string>();
  for (const n of negocios) {
    if (negocioAberto(n) && n.leadId) {
      leadsComNegocioAberto.add(n.leadId);
    }
  }
  for (const lead of leads) {
    if (lead.temperatura === "pronto_para_compra" && !leadsComNegocioAberto.has(lead.id)) {
      itens.push(itemLeadQuente(lead));
    }
  }

  itens.sort(
    (a, b) =>
      PESO_NIVEL[a.nivel] - PESO_NIVEL[b.nivel] ||
      PESO_CATEGORIA[a.categoria] - PESO_CATEGORIA[b.categoria],
  );

  return itens.slice(0, LIMITE_ITENS);
}
