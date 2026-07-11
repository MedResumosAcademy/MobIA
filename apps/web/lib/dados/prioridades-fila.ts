// MONTAGEM PURA da fila de prioridades da central de comando — extraída de
// prioridades.ts para ser testável sem sessão/banco. Recebe listas já lidas
// (e escopadas pela RLS) e devolve os itens ranqueados SEM ícone (o ícone é
// UI — prioridades.ts anexa o componente lucide por categoria).
//
// Regras (as mesmas de sempre):
//   (a) negócios ABERTOS parados (críticos) ou em atenção (altos);
//   (b) tarefas atrasadas (críticas);
//   (c) leads prontos para compra SEM negócio aberto vinculado (médios);
// ordena por nível (crítico → alto → médio), desempata por categoria
// (parados/atrasadas antes de leads) e trunca em 10 itens. pt-BR.

/** Categoria do item — governa ícone/cor e ordenação secundária. */
export type CategoriaPrioridade = "negocio_parado" | "tarefa_atrasada" | "lead_quente";

/** Nível de urgência (governa a cor do selo e o ranqueamento primário). */
export type NivelPrioridade = "critico" | "alto" | "medio";

/** Um item acionável da fila — SEM o ícone (anexado pela camada com UI). */
export type ItemPrioridadeBase = {
  /** Chave estável (categoria + id da entidade). */
  id: string;
  categoria: CategoriaPrioridade;
  nivel: NivelPrioridade;
  titulo: string;
  subtitulo: string;
  /** Rota de ação (ficha do negócio, tarefas do negócio ou conversão do lead). */
  href: string;
};

// Campos mínimos que a montagem precisa (NegocioResumo/TarefaResumo/LeadResumo
// os satisfazem estruturalmente — sem importar as camadas com IO).

export type NegocioParaFila = {
  id: string;
  nomeContato: string;
  resultado: string | null;
  atencao: string;
  diasSemMovimento: number;
  imovelTitulo: string | null;
  leadId: string | null;
};

export type TarefaParaFila = {
  id: string;
  titulo: string;
  venceEm: string | null;
  negocioId: string;
  negocioNomeContato: string | null;
  atrasada: boolean;
};

export type LeadParaFila = {
  id: string;
  clienteNome: string | null;
  imovelTitulo: string;
  temperatura: string;
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
function negocioAberto(n: NegocioParaFila): boolean {
  return n.resultado === null;
}

/** Monta o item de um NEGÓCIO PARADO/EM ATENÇÃO (aberto, sem movimento). */
function itemNegocioParado(n: NegocioParaFila): ItemPrioridadeBase {
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
  };
}

/** Monta o item de uma TAREFA ATRASADA (vence_em passado, não concluída). */
function itemTarefaAtrasada(t: TarefaParaFila): ItemPrioridadeBase {
  const sobre = t.negocioNomeContato ? ` · ${t.negocioNomeContato}` : "";
  return {
    id: `tarefa_atrasada:${t.id}`,
    categoria: "tarefa_atrasada",
    nivel: "critico",
    titulo: t.titulo,
    subtitulo: `Vencida em ${t.venceEm ?? "—"}${sobre}`,
    // As tarefas de um negócio vivem na ficha do negócio (não há sub-rota /tarefas).
    href: `/corretor/negocios/${t.negocioId}`,
  };
}

/** Monta o item de um LEAD QUENTE sem negócio aberto (pronto para converter). */
function itemLeadQuente(lead: LeadParaFila): ItemPrioridadeBase {
  return {
    id: `lead_quente:${lead.id}`,
    categoria: "lead_quente",
    nivel: "medio",
    titulo: lead.clienteNome ?? "Lead pronto para compra",
    subtitulo: `Pronto para compra · ${lead.imovelTitulo}`,
    // A conversão em negócio acontece na ficha do lead (não há sub-rota /converter).
    href: `/corretor/leads/${lead.id}`,
  };
}

/**
 * Combina negócios parados/em atenção, tarefas atrasadas e leads quentes sem
 * negócio aberto, ranqueia (crítico → alto → médio; parados/atrasadas antes de
 * leads) e trunca em 10 itens.
 */
export function montarFila(
  negocios: readonly NegocioParaFila[],
  tarefas: readonly TarefaParaFila[],
  leads: readonly LeadParaFila[],
): ItemPrioridadeBase[] {
  const itens: ItemPrioridadeBase[] = [];

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
