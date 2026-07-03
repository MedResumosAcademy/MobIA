"use server";

// Ações da AGENDA para os componentes client (formulário de novo evento e
// botão de excluir). Fina camada sobre lib/dados/agenda.ts — validação,
// sessão/RLS e revalidação vivem lá. Este arquivo existe porque um módulo com
// "use server" no topo é o único importável por componentes client (o módulo
// de dados exporta tipos além de funções). pt-BR.

import type { EventoAgendaEntrada } from "@imobia/domain";
import {
  criarEventoAction,
  excluirEventoAction,
  type ResultadoAgenda,
} from "@/lib/dados/agenda";

/** Cria um evento MANUAL na agenda do usuário logado. Nunca lança. */
export async function criarEvento(input: EventoAgendaEntrada): Promise<ResultadoAgenda> {
  return criarEventoAction(input);
}

/** Exclui um evento do próprio usuário (idempotente). Nunca lança. */
export async function excluirEvento(
  id: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  return excluirEventoAction(id);
}
