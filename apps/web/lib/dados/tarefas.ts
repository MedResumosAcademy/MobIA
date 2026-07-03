// Camada de dados das TAREFAS (to-dos) do CRM — vinculadas a um negócio do
// funil. Módulo server-side (NÃO é "use server": exporta tipos além de funções
// async). Usado por Server Components e ações da área /corretor.
//
// ESCOPO/RLS: a RLS de 0012 cuida de tudo — corretor vê/edita/apaga só as SUAS
// tarefas (corretor_id = auth.uid()); gestor/admin, qualquer da própria org.
// Aqui NÃO reforçamos escopo por conta própria nas leituras: o que a query
// enxerga já está autorizado. As ESCRITAS derivam org_id/corretor_id da SESSÃO
// (nunca do input) e exigem papel corretor/gestor (exigirCorretor).
//
// ATRASADA: uma tarefa está atrasada quando vence_em < HOJE e não está
// concluída. "Hoje" é a data ISO (YYYY-MM-DD) no relógio de America/Sao_Paulo
// (lib/fuso.ts), comparada como texto (datas ISO ordenam lexicograficamente).
// Datas ISO; pt-BR.

import type { Database } from "@imobia/domain";
import { z } from "zod";
import { obterPerfil, obterSessao } from "@/lib/auth/sessao";
import { diaSaoPaulo } from "@/lib/fuso";
import { criarClienteServidor } from "@/lib/supabase/server";

type LinhaTarefa = Database["public"]["Tables"]["negocio_tarefas"]["Row"];

// --- Tipos de saída (camelCase, prontos para a UI) ---

/**
 * Uma tarefa + flag `atrasada` derivada e o contexto do negócio (nome do
 * contato) e do responsável (corretor). `negocioNomeContato`/`corretorNome`
 * podem ser null quando o join não trouxe (RLS/sem vínculo).
 */
export type TarefaResumo = {
  id: string;
  negocioId: string;
  corretorId: string;
  titulo: string;
  descricao: string | null;
  venceEm: string | null;
  concluida: boolean;
  concluidaEm: string | null;
  criadoEm: string;
  /** vence_em < hoje e não concluída. */
  atrasada: boolean;
  /** Nome do contato do negócio vinculado (para exibir "sobre quem"). */
  negocioNomeContato: string | null;
  /** Nome do corretor responsável (útil no escopo do gestor). */
  corretorNome: string | null;
};

// --- Schema de entrada (anti-forja: org_id/corretor NUNCA vêm do form) ---

export const tarefaEntradaSchema = z
  .object({
    negocioId: z.string().uuid(),
    titulo: z.string().min(1),
    descricao: z.string().min(1).nullable().optional(),
    venceEm: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "data ISO (YYYY-MM-DD)")
      .nullable()
      .optional(),
    /** Responsável opcional; default = corretor da sessão. Deve ser da org. */
    corretorId: z.string().uuid().nullable().optional(),
  })
  .strict();

export type TarefaEntrada = z.input<typeof tarefaEntradaSchema>;

// --- Helpers ---

/** Data ISO (YYYY-MM-DD) de "hoje" no relógio do produto (America/Sao_Paulo). */
function hojeIso(): string {
  return diaSaoPaulo(new Date());
}

/** Uma tarefa está atrasada se tem prazo passado e não foi concluída. */
function ehAtrasada(venceEm: string | null, concluida: boolean, hoje: string): boolean {
  return !concluida && venceEm !== null && venceEm < hoje;
}

type LinhaTarefaEnriquecida = LinhaTarefa & {
  negocio: { nome_contato: string | null } | null;
  corretor: { nome: string | null } | null;
};

function mapTarefaResumo(linha: LinhaTarefaEnriquecida, hoje: string): TarefaResumo {
  return {
    id: linha.id,
    negocioId: linha.negocio_id,
    corretorId: linha.corretor_id,
    titulo: linha.titulo,
    descricao: linha.descricao,
    venceEm: linha.vence_em,
    concluida: linha.concluida,
    concluidaEm: linha.concluida_em,
    criadoEm: linha.criado_em,
    atrasada: ehAtrasada(linha.vence_em, linha.concluida, hoje),
    negocioNomeContato: linha.negocio?.nome_contato ?? null,
    corretorNome: linha.corretor?.nome ?? null,
  };
}

// Colunas do join usadas para dar contexto às tarefas (negócio + responsável).
const SELECT_ENRIQUECIDO =
  "*, negocio:negocios(nome_contato), corretor:perfis!negocio_tarefas_corretor_id_fkey(nome)";

/** Sessão + perfil de escrita (corretor/gestor). Lança se não autorizado. */
async function exigirCorretor(): Promise<{ usuarioId: string; orgId: string }> {
  const sessao = await obterSessao();
  if (!sessao) {
    throw new Error("não autenticado");
  }
  const perfil = await obterPerfil(sessao.usuarioId);
  if (!perfil || (perfil.papel !== "corretor" && perfil.papel !== "gestor") || !perfil.orgId) {
    throw new Error("sem permissão de escrita na org");
  }
  return { usuarioId: sessao.usuarioId, orgId: perfil.orgId };
}

// --- Escrita (org_id/corretor_id da SESSÃO; exige corretor/gestor) ---

/**
 * Cria uma tarefa vinculada a um negócio. org_id é derivada pelo trigger do
 * 0012 a partir do negócio (anti-forja); enviamos a da sessão para satisfazer o
 * NOT NULL e a policy de INSERT (org_id = org_atual()). corretor_id default = o
 * da sessão. Exige corretor/gestor. Lança se o negócio não é visível (RLS).
 */
export async function criarTarefa(input: TarefaEntrada): Promise<TarefaResumo> {
  const { usuarioId, orgId } = await exigirCorretor();
  const dados = tarefaEntradaSchema.parse(input);
  const supabase = await criarClienteServidor();

  const { data, error } = await supabase
    .from("negocio_tarefas")
    .insert({
      org_id: orgId,
      negocio_id: dados.negocioId,
      corretor_id: dados.corretorId ?? usuarioId,
      titulo: dados.titulo,
      descricao: dados.descricao ?? null,
      vence_em: dados.venceEm ?? null,
    })
    .select(SELECT_ENRIQUECIDO)
    .single();
  if (error || !data) {
    throw new Error(`criarTarefa: ${error?.message ?? "sem retorno"}`);
  }
  return mapTarefaResumo(data as LinhaTarefaEnriquecida, hojeIso());
}

/**
 * Marca/desmarca uma tarefa como concluída. O trigger do 0012 carimba/limpa
 * concluida_em. Exige corretor/gestor. Lança se a tarefa não é visível (RLS).
 */
export async function concluirTarefa(id: string, concluida: boolean): Promise<TarefaResumo> {
  await exigirCorretor();
  const supabase = await criarClienteServidor();

  const { data, error } = await supabase
    .from("negocio_tarefas")
    .update({ concluida })
    .eq("id", id)
    .select(SELECT_ENRIQUECIDO)
    .single();
  if (error || !data) {
    throw new Error(`concluirTarefa: ${error?.message ?? "sem retorno"}`);
  }
  return mapTarefaResumo(data as LinhaTarefaEnriquecida, hojeIso());
}

// --- Leitura (corretor/gestor logado; RLS impõe escopo) ---

/**
 * Todas as tarefas de um negócio (concluídas ou não), ordenadas por vence_em
 * (nulls por último) e depois criado_em. RLS limita à visão do usuário.
 * Anônimo/cliente recebe [] (guard).
 */
export async function listarTarefasDoNegocio(negocioId: string): Promise<TarefaResumo[]> {
  const sessao = await obterSessao();
  if (!sessao) {
    return [];
  }
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("negocio_tarefas")
    .select(SELECT_ENRIQUECIDO)
    .eq("negocio_id", negocioId)
    .order("vence_em", { ascending: true, nullsFirst: false })
    .order("criado_em", { ascending: true });
  if (error) {
    throw new Error(`listarTarefasDoNegocio: ${error.message}`);
  }
  const hoje = hojeIso();
  return (data ?? []).map((linha) => mapTarefaResumo(linha as LinhaTarefaEnriquecida, hoje));
}

/**
 * Tarefas PENDENTES (não concluídas) do corretor logado — inclui atrasadas e
 * futuras/sem prazo — ordenadas por vence_em asc (atrasadas primeiro; sem prazo
 * por último). Para o "meu dia" do corretor. Anônimo/cliente recebe [].
 */
export async function minhasTarefas(): Promise<TarefaResumo[]> {
  const sessao = await obterSessao();
  if (!sessao) {
    return [];
  }
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("negocio_tarefas")
    .select(SELECT_ENRIQUECIDO)
    .eq("corretor_id", sessao.usuarioId)
    .eq("concluida", false)
    .order("vence_em", { ascending: true, nullsFirst: false })
    .order("criado_em", { ascending: true });
  if (error) {
    throw new Error(`minhasTarefas: ${error.message}`);
  }
  const hoje = hojeIso();
  return (data ?? []).map((linha) => mapTarefaResumo(linha as LinhaTarefaEnriquecida, hoje));
}

/**
 * Tarefas PENDENTES da ORG (não concluídas) com o corretor responsável — para o
 * painel do gestor acompanhar a carga do time. Ordenadas por vence_em asc. A RLS
 * (papel gestor/admin) limita à própria org. Lança se sem permissão de gestor.
 */
export async function tarefasDaOrg(): Promise<TarefaResumo[]> {
  const sessao = await obterSessao();
  if (!sessao) {
    return [];
  }
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("negocio_tarefas")
    .select(SELECT_ENRIQUECIDO)
    .eq("concluida", false)
    .order("vence_em", { ascending: true, nullsFirst: false })
    .order("criado_em", { ascending: true });
  if (error) {
    throw new Error(`tarefasDaOrg: ${error.message}`);
  }
  const hoje = hojeIso();
  return (data ?? []).map((linha) => mapTarefaResumo(linha as LinhaTarefaEnriquecida, hoje));
}
