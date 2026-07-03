"use server";

// Ações do FUNIL (CRM) do corretor/gestor. Fina camada entre os formulários da
// UI e lib/dados/negocios.ts: parseia FormData, delega a lógica/RLS à camada de
// dados, revalida os caminhos e redireciona. org_id/corretor_id NUNCA vêm do
// form — a camada de dados os deriva da SESSÃO (anti-forja). pt-BR; centavos.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { etapaNegocioSchema, resultadoNegocioSchema, tipoAtividadeSchema } from "@imobia/domain";
import { reaisParaCentavosOuNull } from "@/lib/moeda";
import {
  adicionarAtividade,
  atualizarNegocio,
  criarNegocio,
  criarNegocioDeLead,
  definirResultado,
  moverEtapa,
  type NegocioEdicao,
  type NegocioEntrada,
} from "@/lib/dados/negocios";

function opcional(raw: FormDataEntryValue | null): string | null {
  const texto = String(raw ?? "").trim();
  return texto === "" ? null : texto;
}

// "1.280.000,00" | "1280000.00" | "1280000" → centavos; vazio → null.
// Parser compartilhado (lib/moeda.ts → @imobia/core): o separador decimal é
// detectado pelo ÚLTIMO símbolo — ponto único com 1-2 casas é decimal.
const reaisParaCentavos = reaisParaCentavosOuNull;

function codigoErro(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("permissão") || msg.includes("autenticado")) return "permissao";
  return "invalido";
}

// --- Criação ---

export async function criarNegocioAction(formData: FormData) {
  let idCriado: string;
  try {
    const entrada: NegocioEntrada = {
      etapa: etapaNegocioSchema.parse(String(formData.get("etapa") ?? "novo")),
      nomeContato: String(formData.get("nomeContato") ?? "").trim(),
      telefoneContato: opcional(formData.get("telefoneContato")),
      emailContato: opcional(formData.get("emailContato")),
      imovelId: opcional(formData.get("imovelId")),
      valor: reaisParaCentavos(formData.get("valor")),
    };
    const negocio = await criarNegocio(entrada);
    idCriado = negocio.id;
  } catch (e) {
    redirect(`/corretor/negocios/novo?erro=${codigoErro(e)}`);
  }
  revalidatePath("/corretor/negocios");
  redirect(`/corretor/negocios/${idCriado}`);
}

export async function converterLeadEmNegocioAction(formData: FormData) {
  const leadId = String(formData.get("leadId") ?? "").trim();
  let idNegocio: string;
  try {
    const negocio = await criarNegocioDeLead(leadId);
    idNegocio = negocio.id;
  } catch (e) {
    redirect(`/corretor/leads/${leadId}?erro=${codigoErro(e)}`);
  }
  revalidatePath("/corretor/negocios");
  redirect(`/corretor/negocios/${idNegocio}`);
}

// --- Ações do detalhe (revalidam a própria página) ---
// Chamadas imperativamente (await em useTransition) pelo Controles.tsx, então
// retornam o resultado tipado ResultadoMover em vez de lançar/redirecionar —
// uma exceção aqui viraria error boundary genérico no client.

function erroParaResultado(e: unknown, fallback: string): ResultadoMover {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("permissão") || msg.includes("autenticado")) {
    return { ok: false, erro: "Sem permissão para alterar este negócio." };
  }
  return { ok: false, erro: fallback };
}

export async function moverEtapaAction(formData: FormData): Promise<ResultadoMover> {
  try {
    const id = String(formData.get("id") ?? "").trim();
    const parsed = etapaNegocioSchema.safeParse(String(formData.get("etapa") ?? ""));
    if (!parsed.success) {
      return { ok: false, erro: "Etapa inválida." };
    }
    await moverEtapa(id, parsed.data);
    revalidatePath("/corretor/negocios");
    revalidatePath(`/corretor/negocios/${id}`);
    return { ok: true };
  } catch (e) {
    return erroParaResultado(e, "Não foi possível mover o negócio. Tente novamente.");
  }
}

// Variante chamável do CLIENTE (board por arrastar-e-soltar / select de etapa):
// retorna um resultado tipado em vez de redirecionar. A UI revalida via
// router.refresh() após o ok. org_id/corretor_id/RLS continuam do lado servidor.
export type ResultadoMover = { ok: true } | { ok: false; erro: string };

export async function moverEtapaCliente(
  id: string,
  etapa: string,
): Promise<ResultadoMover> {
  try {
    const destino = etapaNegocioSchema.parse(etapa);
    await moverEtapa(id, destino);
    revalidatePath("/corretor/negocios");
    revalidatePath(`/corretor/negocios/${id}`);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("permissão") || msg.includes("autenticado")) {
      return { ok: false, erro: "Sem permissão para mover este negócio." };
    }
    return { ok: false, erro: "Não foi possível mover o negócio." };
  }
}

export async function definirResultadoAction(formData: FormData): Promise<ResultadoMover> {
  try {
    const id = String(formData.get("id") ?? "").trim();
    const parsed = resultadoNegocioSchema.safeParse(String(formData.get("resultado") ?? ""));
    if (!parsed.success) {
      return { ok: false, erro: "Resultado inválido." };
    }
    const motivo = opcional(formData.get("motivo")) ?? undefined;
    await definirResultado(id, parsed.data, motivo);
    revalidatePath("/corretor/negocios");
    revalidatePath(`/corretor/negocios/${id}`);
    return { ok: true };
  } catch (e) {
    return erroParaResultado(e, "Não foi possível registrar o resultado. Tente novamente.");
  }
}

export async function atualizarNegocioAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  try {
    // Só campos de contato/valor/origem; etapa/resultado têm ações dedicadas.
    // Campos vazios viram null (limpar); os controlados sempre são enviados.
    const campos: NegocioEdicao = {
      nomeContato: String(formData.get("nomeContato") ?? "").trim(),
      telefoneContato: opcional(formData.get("telefoneContato")),
      emailContato: opcional(formData.get("emailContato")),
      origem: opcional(formData.get("origem")),
      valor: reaisParaCentavos(formData.get("valor")),
    };
    await atualizarNegocio(id, campos);
  } catch (e) {
    redirect(`/corretor/negocios/${id}?erro=${codigoErro(e)}`);
  }
  revalidatePath("/corretor/negocios");
  revalidatePath(`/corretor/negocios/${id}`);
}

export async function adicionarAtividadeAction(formData: FormData): Promise<ResultadoMover> {
  try {
    const id = String(formData.get("id") ?? "").trim();
    const parsed = tipoAtividadeSchema.safeParse(String(formData.get("tipo") ?? "nota"));
    if (!parsed.success) {
      return { ok: false, erro: "Tipo de atividade inválido." };
    }
    const descricao = String(formData.get("descricao") ?? "").trim();
    if (descricao !== "") {
      await adicionarAtividade(id, parsed.data, descricao);
    }
    revalidatePath(`/corretor/negocios/${id}`);
    return { ok: true };
  } catch (e) {
    return erroParaResultado(e, "Não foi possível registrar a atividade. Tente novamente.");
  }
}
