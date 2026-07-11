"use server";

// TEMPLATES DE WHATSAPP (migração 0029) — espelho LOCAL dos templates da
// Meta. Módulo "use server" (padrão contatos.ts): equipe LÊ (o corretor
// escolhe o template no composer), gestor/admin ESCREVEM (RLS 0029 reforça).
//
// CICLO HONESTO: a APROVAÇÃO acontece NA META — aqui o status_meta apenas
// REGISTRA o ciclo (rascunho → submetido → aprovado/rejeitado). Editar o
// corpo/nome/idioma/categoria de um template VOLTA o status para 'rascunho'
// (o texto local deixou de ser o texto aprovado lá). O envio REAL exige
// 'aprovado' (conversas.ts/enviarTemplateAction); o SIMULADOR aceita
// qualquer um (nunca toca a Meta).

import { revalidatePath } from "next/cache";
import {
  statusMetaTemplateSchema,
  templateSchema,
  type StatusMetaTemplate,
  type TemplateInput,
} from "@imobia/domain";
import { obterPerfil, obterSessao } from "@/lib/auth/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";

// --- Tipos de saída (camelCase, prontos para a UI) ---

export type TemplateResumo = {
  id: string;
  nome: string;
  idioma: string;
  corpo: string;
  categoria: string;
  statusMeta: string;
  criadoEm: string;
};

export type ResultadoTemplate = { ok: true; id: string } | { ok: false; erro: string };
export type ResultadoAcaoTemplate = { ok: true } | { ok: false; erro: string };

// --- Helpers internos ---

async function exigirGestor(): Promise<{ usuarioId: string; orgId: string }> {
  const sessao = await obterSessao();
  if (!sessao) {
    throw new Error("não autenticado");
  }
  const perfil = await obterPerfil(sessao.usuarioId);
  if (!perfil || (perfil.papel !== "gestor" && perfil.papel !== "admin") || !perfil.orgId) {
    throw new Error("só gestor/admin gerenciam templates");
  }
  return { usuarioId: sessao.usuarioId, orgId: perfil.orgId };
}

const ROTA_TEMPLATES = "/corretor/crm";

// --- Leitura ---

/** Templates da org (RLS escopa; toda a equipe lê). Anônimo ⇒ []. */
export async function listarTemplates(): Promise<TemplateResumo[]> {
  const sessao = await obterSessao();
  if (!sessao) {
    return [];
  }
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("whatsapp_templates")
    .select("id, nome, idioma, corpo, categoria, status_meta, criado_em")
    .order("criado_em", { ascending: false });
  if (error) {
    throw new Error(`listarTemplates: ${error.message}`);
  }
  return (data ?? []).map((t) => ({
    id: t.id,
    nome: t.nome,
    idioma: t.idioma,
    corpo: t.corpo,
    categoria: t.categoria,
    statusMeta: t.status_meta,
    criadoEm: t.criado_em,
  }));
}

// --- Escrita (gestor/admin; contrato { ok } — nunca lança) ---

/** Cria um template em 'rascunho' (o slug precisa ser o EXATO da Meta). */
export async function criarTemplateAction(input: TemplateInput): Promise<ResultadoTemplate> {
  let ctx: { orgId: string };
  try {
    ctx = await exigirGestor();
  } catch {
    return { ok: false, erro: "Só gestor ou admin gerenciam templates." };
  }
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      erro: "Confira os campos: nome em minúsculas (a-z, 0-9, _) e corpo de até 1024 caracteres.",
    };
  }
  const d = parsed.data;
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("whatsapp_templates")
    .insert({
      org_id: ctx.orgId,
      nome: d.nome,
      idioma: d.idioma,
      corpo: d.corpo,
      categoria: d.categoria,
    })
    .select("id")
    .single();
  if (error || !data) {
    if (error?.code === "23505") {
      return { ok: false, erro: "Já existe um template com este nome e idioma na organização." };
    }
    return { ok: false, erro: "Não foi possível criar o template. Tente novamente." };
  }
  revalidatePath(ROTA_TEMPLATES);
  return { ok: true, id: data.id };
}

/**
 * Atualiza o CONTEÚDO do template — e volta o status para 'rascunho' (o
 * texto local deixou de ser o que a Meta aprovou; honestidade do espelho).
 */
export async function atualizarTemplateAction(
  id: string,
  input: TemplateInput,
): Promise<ResultadoTemplate> {
  try {
    await exigirGestor();
  } catch {
    return { ok: false, erro: "Só gestor ou admin gerenciam templates." };
  }
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      erro: "Confira os campos: nome em minúsculas (a-z, 0-9, _) e corpo de até 1024 caracteres.",
    };
  }
  const d = parsed.data;
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("whatsapp_templates")
    .update({
      nome: d.nome,
      idioma: d.idioma,
      corpo: d.corpo,
      categoria: d.categoria,
      status_meta: "rascunho",
    })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    if (error?.code === "23505") {
      return { ok: false, erro: "Já existe um template com este nome e idioma na organização." };
    }
    return { ok: false, erro: "Template não encontrado ou fora do seu acesso." };
  }
  revalidatePath(ROTA_TEMPLATES);
  return { ok: true, id: data.id };
}

/**
 * Registra o CICLO na Meta ('submetido' quando enviado para análise;
 * 'aprovado'/'rejeitado' espelham o veredito DE LÁ — nunca aprovamos aqui).
 */
export async function atualizarStatusTemplateAction(
  id: string,
  status: StatusMetaTemplate,
): Promise<ResultadoAcaoTemplate> {
  try {
    await exigirGestor();
  } catch {
    return { ok: false, erro: "Só gestor ou admin gerenciam templates." };
  }
  const parsed = statusMetaTemplateSchema.safeParse(status);
  if (!parsed.success) {
    return { ok: false, erro: "Status desconhecido." };
  }
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("whatsapp_templates")
    .update({ status_meta: parsed.data })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { ok: false, erro: "Template não encontrado ou fora do seu acesso." };
  }
  revalidatePath(ROTA_TEMPLATES);
  return { ok: true };
}

/** Exclui o template LOCAL (não remove nada na Meta — só o espelho). */
export async function excluirTemplateAction(id: string): Promise<ResultadoAcaoTemplate> {
  try {
    await exigirGestor();
  } catch {
    return { ok: false, erro: "Só gestor ou admin gerenciam templates." };
  }
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("whatsapp_templates")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { ok: false, erro: "Template não encontrado ou fora do seu acesso." };
  }
  revalidatePath(ROTA_TEMPLATES);
  return { ok: true };
}
