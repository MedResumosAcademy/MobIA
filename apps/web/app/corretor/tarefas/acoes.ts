"use server";

// Ações das TAREFAS (to-dos) do CRM. Fina camada entre os formulários da UI e
// lib/dados/tarefas.ts: parseia FormData, delega lógica/RLS à camada de dados e
// revalida os caminhos afetados. org_id/corretor_id NUNCA vêm do form — a camada
// de dados os deriva da SESSÃO (anti-forja). Datas ISO (YYYY-MM-DD); pt-BR.

import { revalidatePath } from "next/cache";
import { concluirTarefa, criarTarefa } from "@/lib/dados/tarefas";

function opcional(raw: FormDataEntryValue | null): string | null {
  const texto = String(raw ?? "").trim();
  return texto === "" ? null : texto;
}

/** Cria uma tarefa vinculada a um negócio e revalida o detalhe + a lista. */
export async function criarTarefaAction(formData: FormData) {
  const negocioId = String(formData.get("negocioId") ?? "").trim();
  const titulo = String(formData.get("titulo") ?? "").trim();
  const venceEm = opcional(formData.get("venceEm"));
  if (titulo === "") {
    return;
  }
  await criarTarefa({ negocioId, titulo, venceEm });
  revalidatePath(`/corretor/negocios/${negocioId}`);
  revalidatePath("/corretor/tarefas");
}

/** Marca/desmarca uma tarefa como concluída e revalida detalhe + lista. */
export async function concluirTarefaAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const negocioId = String(formData.get("negocioId") ?? "").trim();
  const concluida = String(formData.get("concluida") ?? "") === "true";
  await concluirTarefa(id, concluida);
  if (negocioId !== "") {
    revalidatePath(`/corretor/negocios/${negocioId}`);
  }
  revalidatePath("/corretor/tarefas");
}
