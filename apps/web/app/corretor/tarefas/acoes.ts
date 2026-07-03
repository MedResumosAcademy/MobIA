"use server";

// Ações das TAREFAS (to-dos) do CRM. Fina camada entre os formulários da UI e
// lib/dados/tarefas.ts: parseia FormData, delega lógica/RLS à camada de dados e
// revalida os caminhos afetados. org_id/corretor_id NUNCA vêm do form — a camada
// de dados os deriva da SESSÃO (anti-forja). Datas ISO (YYYY-MM-DD); pt-BR.
//
// As duas actions são chamadas imperativamente (await em useTransition), então
// retornam um resultado tipado { ok } em vez de lançar — uma exceção (ZodError
// de entrada inválida, RLS, banco) viraria error boundary genérico no client.

import { revalidatePath } from "next/cache";
import { concluirTarefa, criarTarefa } from "@/lib/dados/tarefas";

/** Retorno tipado das actions de tarefa (mesmo padrão de negócios). */
export type ResultadoTarefa = { ok: true } | { ok: false; erro: string };

function opcional(raw: FormDataEntryValue | null): string | null {
  const texto = String(raw ?? "").trim();
  return texto === "" ? null : texto;
}

function erroParaResultado(e: unknown, fallback: string): ResultadoTarefa {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("permissão") || msg.includes("autenticado")) {
    return { ok: false, erro: "Sem permissão para alterar tarefas." };
  }
  return { ok: false, erro: fallback };
}

/**
 * Cria uma tarefa vinculada a um negócio e revalida o detalhe + a lista + a
 * agenda + o painel (que exibem tarefas com prazo/pendentes).
 */
export async function criarTarefaAction(formData: FormData): Promise<ResultadoTarefa> {
  try {
    const negocioId = String(formData.get("negocioId") ?? "").trim();
    const titulo = String(formData.get("titulo") ?? "").trim();
    const venceEm = opcional(formData.get("venceEm"));
    if (titulo === "") {
      return { ok: true };
    }
    await criarTarefa({ negocioId, titulo, venceEm });
    revalidatePath(`/corretor/negocios/${negocioId}`);
    revalidatePath("/corretor/tarefas");
    revalidatePath("/corretor/agenda");
    revalidatePath("/corretor");
    return { ok: true };
  } catch (e) {
    return erroParaResultado(e, "Não foi possível criar a tarefa. Verifique os dados e tente novamente.");
  }
}

/** Marca/desmarca uma tarefa como concluída e revalida detalhe + lista + agenda + painel. */
export async function concluirTarefaAction(formData: FormData): Promise<ResultadoTarefa> {
  try {
    const id = String(formData.get("id") ?? "").trim();
    const negocioId = String(formData.get("negocioId") ?? "").trim();
    const concluida = String(formData.get("concluida") ?? "") === "true";
    await concluirTarefa(id, concluida);
    if (negocioId !== "") {
      revalidatePath(`/corretor/negocios/${negocioId}`);
    }
    revalidatePath("/corretor/tarefas");
    revalidatePath("/corretor/agenda");
    revalidatePath("/corretor");
    return { ok: true };
  } catch (e) {
    return erroParaResultado(e, "Não foi possível atualizar a tarefa. Tente novamente.");
  }
}
