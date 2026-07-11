"use server";

// FUNIS DE RELACIONAMENTO (migração 0027) — módulo "use server" (padrão
// contatos.ts): leitura dos funis da org, dados agregados para o relatório
// (core relatorioDeFunil) e as ações de gestão/movimentação.
//
// DECISÃO DE ARQUITETURA (respeitar): funis customizados são de
// RELACIONAMENTO e se aplicam a CONTATOS. O funil de NEGÓCIOS continua
// canônico e intocado — "Ganhos" aqui = negócios GANHOS vinculados aos
// contatos do funil; "Receita no funil" = soma dos negócios ABERTOS deles.
// Obs.: a RLS de negocios escopa a visão (corretor vê os próprios negócios;
// gestor/admin, os da org) — os números refletem o que o usuário logado vê.
//
// PERMISSÕES: gestão de funis (criar/editar/arquivar) é gestor/admin (RLS
// 0027 reforça). MOVER contato de etapa é de QUALQUER membro da equipe — via
// RPC public.mover_contato_de_etapa (0028, SECURITY DEFINER estreito), já que
// a policy contatos_update (só responsável/gestor) NUNCA afrouxa.
//
// FUSO: o motor puro conta "hoje/7/30 dias" por frame de calendário — todos
// os instantes são expressos em America/Sao_Paulo (lib/fuso isoSaoPaulo)
// antes de entrar no motor.

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import {
  contatoEstaAContatar,
  formatarTelefoneBR,
  relatorioDeFunil,
  type EtapaFunil,
  type RelatorioFunil,
} from "@imobia/core";
import { funilSchema, type Database, type FunilInput, type Papel } from "@imobia/domain";
import { obterPerfil, obterSessao } from "@/lib/auth/sessao";
import { agoraSaoPauloISO, isoSaoPaulo } from "@/lib/fuso";
import { criarClienteServidor } from "@/lib/supabase/server";
import { emitirEvento } from "@/lib/webhooks/saida";

type LinhaFunil = Database["public"]["Tables"]["funis"]["Row"];

// --- Tipos de saída (camelCase, prontos para a UI) ---

/** Um funil de relacionamento com as etapas já parseadas/validadas. */
export type FunilResumo = {
  id: string;
  nome: string;
  emoji: string | null;
  descricao: string | null;
  /** Array ORDENADO — a última etapa é a FINAL (não conta 🔥). */
  etapas: EtapaFunil[];
  diasParaEsfriar: number;
  padrao: boolean;
  arquivado: boolean;
  criadoEm: string;
};

/** Um contato do funil, pronto para lista/kanban (🔥 já resolvido). */
export type ContatoDoFunil = {
  id: string;
  nome: string;
  telefone: string | null;
  telefoneFormatado: string | null;
  tags: string[];
  etapaChave: string | null;
  ultimaInteracaoEm: string | null;
  criadoEm: string;
  /** 🔥 precisa de contato (regra do core contatoEstaAContatar). */
  aContatar: boolean;
  /** Tem negócio GANHO vinculado (visível ao usuário). */
  ganho: boolean;
};

/** Funil + contatos + relatório agregado (core relatorioDeFunil). */
export type DadosDoFunil = {
  funil: FunilResumo;
  contatos: ContatoDoFunil[];
  relatorio: RelatorioFunil;
};

export type ResultadoFunil = { ok: true; id: string } | { ok: false; erro: string };
export type ResultadoAcaoFunil = { ok: true } | { ok: false; erro: string };

// --- Helpers internos ---

/** Sessão + papel profissional (corretor/gestor/admin) com org. Lança se não. */
async function exigirEquipe(): Promise<{ usuarioId: string; orgId: string; papel: Papel }> {
  const sessao = await obterSessao();
  if (!sessao) {
    throw new Error("não autenticado");
  }
  const perfil = await obterPerfil(sessao.usuarioId);
  if (!perfil || perfil.papel === "cliente" || !perfil.orgId) {
    throw new Error("sem permissão na org");
  }
  return { usuarioId: sessao.usuarioId, orgId: perfil.orgId, papel: perfil.papel };
}

/** Gate de papel: só gestor/admin gerencia funis (RLS 0027 reforça). */
async function exigirGestor(): Promise<{ usuarioId: string; orgId: string }> {
  const ctx = await exigirEquipe();
  if (ctx.papel !== "gestor" && ctx.papel !== "admin") {
    throw new Error("sem permissão de gestor");
  }
  return { usuarioId: ctx.usuarioId, orgId: ctx.orgId };
}

/** etapas jsonb do banco → EtapaFunil[] validado ([] se corrompido). */
function lerEtapas(json: unknown): EtapaFunil[] {
  const r = funilSchema.shape.etapas.safeParse(json);
  return r.success ? r.data : [];
}

function mapFunil(l: LinhaFunil): FunilResumo {
  return {
    id: l.id,
    nome: l.nome,
    emoji: l.emoji,
    descricao: l.descricao,
    etapas: lerEtapas(l.etapas),
    diasParaEsfriar: l.dias_para_esfriar,
    padrao: l.padrao,
    arquivado: l.arquivado,
    criadoEm: l.criado_em,
  };
}

// --- Leitura ---

/**
 * Funis da org (RLS escopa), padrão primeiro e depois por criação. Por padrão
 * só os ATIVOS (chips/vistas); a gestão pede também os arquivados. Anônimo
 * recebe [].
 */
export async function listarFunis(
  opcoes: { incluirArquivados?: boolean } = {},
): Promise<FunilResumo[]> {
  const sessao = await obterSessao();
  if (!sessao) {
    return [];
  }
  const supabase = await criarClienteServidor();
  let query = supabase
    .from("funis")
    .select("*")
    .order("padrao", { ascending: false })
    .order("criado_em", { ascending: true });
  if (!opcoes.incluirArquivados) {
    query = query.eq("arquivado", false);
  }
  const { data, error } = await query;
  if (error) {
    throw new Error(`listarFunis: ${error.message}`);
  }
  return (data ?? []).map(mapFunil);
}

/** Quantos contatos há em cada funil (para os cards da gestão). */
export async function contarContatosPorFunil(): Promise<Record<string, number>> {
  const sessao = await obterSessao();
  if (!sessao) {
    return {};
  }
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("contatos")
    .select("funil_id")
    .not("funil_id", "is", null);
  if (error) {
    throw new Error(`contarContatosPorFunil: ${error.message}`);
  }
  const contagem: Record<string, number> = {};
  for (const c of data ?? []) {
    if (c.funil_id !== null) {
      contagem[c.funil_id] = (contagem[c.funil_id] ?? 0) + 1;
    }
  }
  return contagem;
}

/**
 * Dados completos de UM funil: contatos (com 🔥 por contato) + relatório
 * agregado. SEM N+1: 3 queries paralelas (funil, contatos do funil, negócios
 * com contato) + agregação em memória; os valores de negócios (CENTAVOS) são
 * somados por contato e entregues ao motor puro relatorioDeFunil. null se o
 * funil não existe/está fora do escopo (RLS).
 */
export async function dadosDoFunil(funilId: string): Promise<DadosDoFunil | null> {
  const sessao = await obterSessao();
  if (!sessao) {
    return null;
  }
  const supabase = await criarClienteServidor();

  const [funilRes, contatosRes, negociosRes] = await Promise.all([
    supabase.from("funis").select("*").eq("id", funilId).maybeSingle(),
    supabase
      .from("contatos")
      .select(
        "id, nome, telefone, tags, etapa_chave, etapa_movida_em, ultima_interacao_em, criado_em",
      )
      .eq("funil_id", funilId)
      .order("etapa_movida_em", { ascending: false, nullsFirst: false }),
    supabase
      .from("negocios")
      .select("contato_id, valor, resultado")
      .not("contato_id", "is", null),
  ]);
  if (funilRes.error) {
    throw new Error(`dadosDoFunil: ${funilRes.error.message}`);
  }
  if (!funilRes.data) {
    return null;
  }
  if (contatosRes.error) {
    throw new Error(`dadosDoFunil(contatos): ${contatosRes.error.message}`);
  }
  if (negociosRes.error) {
    throw new Error(`dadosDoFunil(negocios): ${negociosRes.error.message}`);
  }

  const funil = mapFunil(funilRes.data);

  // Agregado de negócios por contato: ganho + somas em CENTAVOS.
  const porContato = new Map<
    string,
    { ganho: boolean; valorAbertoCentavos: number; valorGanhoCentavos: number }
  >();
  for (const n of negociosRes.data ?? []) {
    if (n.contato_id === null) {
      continue;
    }
    const acc = porContato.get(n.contato_id) ?? {
      ganho: false,
      valorAbertoCentavos: 0,
      valorGanhoCentavos: 0,
    };
    if (n.resultado === "ganho") {
      acc.ganho = true;
      acc.valorGanhoCentavos += n.valor ?? 0;
    } else if (n.resultado === null) {
      acc.valorAbertoCentavos += n.valor ?? 0;
    }
    porContato.set(n.contato_id, acc);
  }

  const agoraISO = agoraSaoPauloISO();
  const chaveFinal = funil.etapas[funil.etapas.length - 1]?.chave ?? null;

  const linhas = contatosRes.data ?? [];
  const paraRelatorio = linhas.map((c) => {
    const agregado = porContato.get(c.id);
    return {
      etapaChave: c.etapa_chave,
      criadoEm: isoSaoPaulo(new Date(c.criado_em)),
      ultimaInteracaoEm:
        c.ultima_interacao_em === null ? null : isoSaoPaulo(new Date(c.ultima_interacao_em)),
      ganho: agregado?.ganho ?? false,
      valorAbertoCentavos: agregado?.valorAbertoCentavos ?? 0,
      valorGanhoCentavos: agregado?.valorGanhoCentavos ?? 0,
    };
  });

  const relatorio = relatorioDeFunil(
    paraRelatorio,
    funil.etapas,
    funil.diasParaEsfriar,
    agoraISO,
  );

  const contatos: ContatoDoFunil[] = linhas.map((c, i) => ({
    id: c.id,
    nome: c.nome,
    telefone: c.telefone,
    telefoneFormatado: c.telefone !== null ? formatarTelefoneBR(c.telefone) : null,
    tags: c.tags,
    etapaChave: c.etapa_chave,
    ultimaInteracaoEm: c.ultima_interacao_em,
    criadoEm: c.criado_em,
    aContatar: contatoEstaAContatar(
      paraRelatorio[i],
      chaveFinal,
      funil.diasParaEsfriar,
      agoraISO,
    ),
    ganho: paraRelatorio[i].ganho,
  }));

  return { funil, contatos, relatorio };
}

// --- Escrita (contrato { ok } — nunca lança) ---

/**
 * Cria (sem id) ou atualiza (com id) um funil — gestor/admin. O funilSchema
 * valida nome/emoji/etapas (2 a 15, chaves ÚNICAS) e diasParaEsfriar. Na
 * edição, uma etapa REMOVIDA que ainda tem contatos BLOQUEIA com erro gentil
 * (mova os contatos antes) — ninguém fica órfão de etapa por acidente.
 */
export async function salvarFunilAction(input: FunilInput): Promise<ResultadoFunil> {
  let ctx: { usuarioId: string; orgId: string };
  try {
    ctx = await exigirGestor();
  } catch {
    return { ok: false, erro: "Sem permissão para gerenciar funis (gestor/admin)." };
  }
  const parsed = funilSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      erro:
        "Confira os dados: nome (até 80), de 2 a 15 etapas com nomes próprios e " +
        "dias para esfriar entre 1 e 365.",
    };
  }
  const d = parsed.data;
  const supabase = await criarClienteServidor();

  if (d.id) {
    // Guarda de remoção: etapa que sai do funil não pode ter contatos nela.
    const { data: atual, error: erroAtual } = await supabase
      .from("funis")
      .select("etapas")
      .eq("id", d.id)
      .maybeSingle();
    if (erroAtual || !atual) {
      return { ok: false, erro: "Funil não encontrado ou fora do seu acesso." };
    }
    const chavesNovas = new Set(d.etapas.map((e) => e.chave));
    const removidas = lerEtapas(atual.etapas).filter((e) => !chavesNovas.has(e.chave));
    if (removidas.length > 0) {
      const { data: presos, error: erroPresos } = await supabase
        .from("contatos")
        .select("etapa_chave")
        .eq("funil_id", d.id)
        .in(
          "etapa_chave",
          removidas.map((e) => e.chave),
        );
      if (erroPresos) {
        return { ok: false, erro: "Falha temporária ao validar as etapas — tente novamente." };
      }
      if ((presos ?? []).length > 0) {
        const porChave = new Map<string, number>();
        for (const p of presos ?? []) {
          if (p.etapa_chave !== null) {
            porChave.set(p.etapa_chave, (porChave.get(p.etapa_chave) ?? 0) + 1);
          }
        }
        const detalhe = removidas
          .filter((e) => (porChave.get(e.chave) ?? 0) > 0)
          .map((e) => `"${e.nome}" (${porChave.get(e.chave)})`)
          .join(", ");
        return {
          ok: false,
          erro:
            `Ainda há contatos nas etapas ${detalhe}. Mova cada um para outra etapa ` +
            "(na lista ou no kanban) antes de remover a etapa.",
        };
      }
    }

    const { data, error } = await supabase
      .from("funis")
      .update({
        nome: d.nome,
        emoji: d.emoji ?? null,
        descricao: d.descricao ?? null,
        etapas: d.etapas,
        dias_para_esfriar: d.diasParaEsfriar,
      })
      .eq("id", d.id)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      return { ok: false, erro: "Não foi possível salvar o funil. Tente novamente." };
    }
    revalidatePath("/corretor/crm");
    revalidatePath("/corretor/crm/funis");
    return { ok: true, id: data.id };
  }

  const { data, error } = await supabase
    .from("funis")
    .insert({
      org_id: ctx.orgId,
      nome: d.nome,
      emoji: d.emoji ?? null,
      descricao: d.descricao ?? null,
      etapas: d.etapas,
      dias_para_esfriar: d.diasParaEsfriar,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, erro: "Não foi possível criar o funil. Tente novamente." };
  }
  revalidatePath("/corretor/crm");
  revalidatePath("/corretor/crm/funis");
  return { ok: true, id: data.id };
}

/**
 * Arquiva (ou restaura) um funil — gestor/admin. O funil PADRÃO da org nunca
 * é arquivado (é o destino dos contatos novos). Arquivar não mexe nos
 * contatos: eles mantêm a posição e voltam a aparecer se o funil for
 * restaurado; funil arquivado sai dos chips e não recebe movimentações.
 */
export async function arquivarFunilAction(
  id: string,
  arquivar: boolean,
): Promise<ResultadoAcaoFunil> {
  try {
    await exigirGestor();
  } catch {
    return { ok: false, erro: "Sem permissão para gerenciar funis (gestor/admin)." };
  }
  const supabase = await criarClienteServidor();
  if (arquivar) {
    const { data: funil } = await supabase
      .from("funis")
      .select("padrao")
      .eq("id", id)
      .maybeSingle();
    if (funil?.padrao) {
      return {
        ok: false,
        erro: "O funil padrão da organização não pode ser arquivado — os contatos novos entram nele.",
      };
    }
  }
  const { data, error } = await supabase
    .from("funis")
    .update({ arquivado: arquivar })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { ok: false, erro: "Não foi possível atualizar o funil. Tente novamente." };
  }
  revalidatePath("/corretor/crm");
  revalidatePath("/corretor/crm/funis");
  return { ok: true };
}

/**
 * Move um contato para uma etapa de um funil — QUALQUER membro da equipe da
 * org (colaboração no kanban), via RPC 0028 (SECURITY DEFINER estreito: só
 * funil_id/etapa_chave/etapa_movida_em, só na própria org, só etapa que
 * existe no funil ativo). Não registra atividade: a estrutura de atividades é
 * por NEGÓCIO (negocio_atividades) e o movimento é de CONTATO.
 */
export async function moverContatoDeEtapaAction(
  contatoId: string,
  funilId: string,
  etapaChave: string,
): Promise<ResultadoAcaoFunil> {
  let ctx: { orgId: string };
  try {
    ctx = await exigirEquipe();
  } catch {
    return { ok: false, erro: "Sem permissão. Entre novamente." };
  }
  if (!contatoId || !funilId || etapaChave.trim() === "") {
    return { ok: false, erro: "Movimentação inválida — recarregue a página e tente de novo." };
  }
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("mover_contato_de_etapa", {
    p_contato_id: contatoId,
    p_funil_id: funilId,
    p_etapa_chave: etapaChave,
  });
  if (error) {
    if (error.message.includes("etapa desconhecida")) {
      return { ok: false, erro: "Esta etapa não existe mais no funil — recarregue a página." };
    }
    if (error.message.includes("arquivado")) {
      return { ok: false, erro: "Este funil foi arquivado e não recebe contatos." };
    }
    return { ok: false, erro: "Não foi possível mover o contato. Tente novamente." };
  }
  // Webhook de saída (0033) DEPOIS da resposta — nunca atrasa o kanban.
  after(() =>
    emitirEvento(ctx.orgId, "contato.mudou_etapa", {
      contatoId,
      funilId,
      etapaChave,
    }),
  );
  revalidatePath("/corretor/crm");
  revalidatePath(`/corretor/crm/contatos/${contatoId}`);
  return { ok: true };
}
