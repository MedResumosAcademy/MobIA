"use server";

// CONVERSAS (inbox WhatsApp do CRM 2.0) — lista as conversas da org em FILAS
// de atendimento (precisam/ia/minhas/todas — estado no CONTATO, migração
// 0029), envia mensagens 1:1 pela Meta Cloud API e gerencia a fila via RPC
// estreita (0030 atualizar_estado_conversa — a policy de contatos NÃO
// afrouxa). Módulo "use server" (padrão newsletter.ts); a especificação pura
// das filas vive em atendimento-nucleo.ts (o SQL daqui a espelha).
//
// LGPD — DISTINÇÃO IMPORTANTE: mensagem 1:1 na conversa é ATENDIMENTO
// (execução do contato/negócio a pedido do cliente — base legal distinta),
// então NÃO exige consentimento de marketing. O que exige opt-in explícito é
// o envio EM MASSA (campanhas.ts) — lá o segmentador força a exclusão.
//
// JANELA DE 24H (regra da Meta): texto livre só até 24h após a última mensagem
// RECEBIDA do contato; fora dela, só template APROVADO (enviarTemplateAction —
// que agora exige o espelho local whatsapp_templates com status 'aprovado'
// para envio REAL). Sem Meta conectada, o envio degrada honesto para link
// wa.me. CONTATO DE SIMULAÇÃO (origem 'simulacao'): tudo é registrado como
// 'enviada' SEM tocar a Meta — nunca (demo segura).

import { revalidatePath } from "next/cache";
import { formatarTelefoneBR, janelaAtendimento, montarLinkWhatsApp } from "@imobia/core";
import type { Papel } from "@imobia/domain";
import { obterPerfil, obterSessao } from "@/lib/auth/sessao";
import { ERRO_MODO_TESTE, podeEnviarPara } from "@/lib/dados/envio-whatsapp";
import {
  enviarTemplateWhatsApp,
  enviarTextoWhatsApp,
  metaDisponivel,
} from "@/lib/meta/whatsapp";
import { permitido } from "@/lib/seguranca/limitador";
import { criarClienteServidor } from "@/lib/supabase/server";
import {
  FILAS_CONVERSA,
  pertenceAFila,
  type FilaConversa,
} from "./atendimento-nucleo";

export type { FilaConversa } from "./atendimento-nucleo";

// --- Tipos de saída (camelCase, prontos para a UI) ---

/** Uma conversa do inbox: contato + última mensagem + janela + fila. */
export type ConversaResumo = {
  contatoId: string;
  contatoNome: string;
  telefoneFormatado: string | null;
  ultimaMensagem: { corpo: string; direcao: string; status: string; criadoEm: string };
  /** Janela de atendimento de 24h (aberta ⇒ texto livre permitido). */
  janela: { aberta: boolean; expiraEmISO: string | null };
  /** Quem atende AGORA ('ia' | 'humano' | 'resolvido') — estado do 0029. */
  atendimento: string;
  /** Humano dono da conversa (fila "Minhas") — null = ninguém assumiu. */
  atribuidoA: string | null;
  /** Contador mantido por trigger (entradas desde a última resposta). */
  naoLidas: number;
  /** true quando é o contato de teste do simulador (origem 'simulacao'). */
  simulacao: boolean;
};

/** Inbox completo: conversas da fila pedida + contadores de TODAS as filas. */
export type InboxConversas = {
  conversas: ConversaResumo[];
  contadores: Record<FilaConversa, number>;
};

/** Uma mensagem da conversa aberta. */
export type MensagemConversa = {
  id: string;
  direcao: string;
  corpo: string;
  status: string;
  templateNome: string | null;
  /** true quando a saída foi escrita pela IA de atendimento (selo na UI). */
  autorIa: boolean;
  criadoEm: string;
};

export type ResultadoMensagem =
  | { ok: true; mensagemId: string }
  | { ok: false; erro: string; waUrl?: string | null };

export type ResultadoFila = { ok: true } | { ok: false; erro: string };

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

// Teto de CONVERSAS exibidas por fila (as mais recentes primeiro). Os
// contadores são COUNTs exatos no banco — nunca têm teto.
const LIMITE_CONVERSAS_INBOX = 200;

const CONTADORES_VAZIOS: Record<FilaConversa, number> = {
  precisam: 0,
  ia: 0,
  minhas: 0,
  todas: 0,
};

/**
 * Espelho SQL de pertenceAFila (atendimento-nucleo): as MESMAS condições,
 * aplicadas no banco — a fila e os contadores enxergam TODOS os contatos da
 * org, sem teto de mensagens varridas. Tripla (coluna, operador, valor) para
 * o .filter() do PostgREST.
 */
function condicoesDaFila(
  fila: FilaConversa,
  usuarioId: string,
): [string, string, string | number][] {
  switch (fila) {
    case "precisam":
      return [
        ["atendimento", "eq", "humano"],
        ["nao_lidas", "gt", 0],
      ];
    case "ia":
      return [["atendimento", "eq", "ia"]];
    case "minhas":
      return [
        ["atribuido_a", "eq", usuarioId],
        ["atendimento", "neq", "resolvido"],
      ];
    case "todas":
      return [];
  }
}

// --- Leitura ---

/**
 * Conversas da org em FILAS (contatos COM mensagens, ordenadas pela última):
 *   - precisam: humano + não lidas (inclui as escaladas pela IA);
 *   - ia: a IA atende agora; minhas: atribuídas a mim; todas: tudo.
 * Devolve a fila pedida (default "todas") + contadores de todas as filas
 * (badges das abas).
 *
 * As filas derivam dos CONTATOS (ultima_mensagem_em/nao_lidas mantidos por
 * trigger, 0029) — NÃO de uma varredura de mensagens: uma conversa escalada
 * nunca some da fila "Precisam" por ser antiga demais. A última mensagem e a
 * última ENTRADA (janela de 24h) vêm por embed com limit(1) por contato;
 * contadores são COUNTs exatos por fila. Anônimo recebe inbox vazio.
 */
export async function listarConversas(
  filtros: { fila?: FilaConversa } = {},
): Promise<InboxConversas> {
  const sessao = await obterSessao();
  if (!sessao) {
    return { conversas: [], contadores: CONTADORES_VAZIOS };
  }
  const supabase = await criarClienteServidor();
  const fila = filtros.fila ?? "todas";

  let consulta = supabase
    .from("contatos")
    .select(
      "id, nome, telefone, origem, atendimento, atribuido_a, nao_lidas, ultima_mensagem_em, ultima:mensagens(corpo,direcao,status,criado_em), entradas:mensagens(criado_em)",
    )
    .not("ultima_mensagem_em", "is", null)
    .eq("entradas.direcao", "entrada")
    .order("ultima_mensagem_em", { ascending: false })
    .order("criado_em", { referencedTable: "ultima", ascending: false })
    .limit(1, { referencedTable: "ultima" })
    .order("criado_em", { referencedTable: "entradas", ascending: false })
    .limit(1, { referencedTable: "entradas" })
    .limit(LIMITE_CONVERSAS_INBOX);
  for (const [coluna, operador, valor] of condicoesDaFila(fila, sessao.usuarioId)) {
    consulta = consulta.filter(coluna, operador, valor);
  }

  const contarFila = async (f: FilaConversa): Promise<number> => {
    let contagem = supabase
      .from("contatos")
      .select("id", { count: "exact", head: true })
      .not("ultima_mensagem_em", "is", null);
    for (const [coluna, operador, valor] of condicoesDaFila(f, sessao.usuarioId)) {
      contagem = contagem.filter(coluna, operador, valor);
    }
    const { count, error: erroContagem } = await contagem;
    if (erroContagem) {
      throw new Error(`listarConversas(contador ${f}): ${erroContagem.message}`);
    }
    return count ?? 0;
  };

  const [{ data: contatos, error }, ...contagens] = await Promise.all([
    consulta,
    ...FILAS_CONVERSA.map(contarFila),
  ]);
  if (error) {
    throw new Error(`listarConversas: ${error.message}`);
  }
  const contadores = Object.fromEntries(
    FILAS_CONVERSA.map((f, i) => [f, contagens[i] ?? 0]),
  ) as Record<FilaConversa, number>;

  const agora = new Date().toISOString();
  const conversas: ConversaResumo[] = (contatos ?? [])
    // Sem mensagem (ex.: carimbo órfão) não é conversa — fora do inbox.
    .filter((c) => c.ultima.length > 0)
    .map((c) => ({
      contatoId: c.id,
      contatoNome: c.nome,
      telefoneFormatado: c.telefone ? formatarTelefoneBR(c.telefone) : null,
      ultimaMensagem: {
        corpo: c.ultima[0].corpo,
        direcao: c.ultima[0].direcao,
        status: c.ultima[0].status,
        criadoEm: c.ultima[0].criado_em,
      },
      janela: janelaAtendimento(c.entradas[0]?.criado_em ?? null, agora),
      atendimento: c.atendimento,
      atribuidoA: c.atribuido_a,
      naoLidas: c.nao_lidas,
      simulacao: c.origem === "simulacao",
    }))
    // Defesa em profundidade: o filtro SQL espelha pertenceAFila — reconferir
    // aqui garante que a lista nunca diverge da especificação pura.
    .filter((c) =>
      pertenceAFila(
        { atendimento: c.atendimento, atribuidoA: c.atribuidoA, naoLidas: c.naoLidas },
        fila,
        sessao.usuarioId,
      ),
    );

  return { conversas, contadores };
}

/** Cabeçalho da conversa aberta no inbox (thread do ?contato=). */
export type ContatoDaConversa = {
  contatoId: string;
  contatoNome: string;
  /** Dígitos com DDI 55 (para o composer/wa.me) — null sem telefone. */
  telefone: string | null;
  telefoneFormatado: string | null;
  atendimento: string;
  atribuidoA: string | null;
  naoLidas: number;
  simulacao: boolean;
  janela: { aberta: boolean; expiraEmISO: string | null };
};

/**
 * Contato da thread aberta, direto da tabela (independe de já ter mensagens —
 * o contato de simulação recém-criado abre vazio). RLS escopa; anônimo/fora
 * do acesso ⇒ null.
 */
export async function obterContatoDaConversa(
  contatoId: string,
): Promise<ContatoDaConversa | null> {
  const sessao = await obterSessao();
  if (!sessao) {
    return null;
  }
  const supabase = await criarClienteServidor();
  const { data: contato } = await supabase
    .from("contatos")
    .select("id, nome, telefone, origem, atendimento, atribuido_a, nao_lidas")
    .eq("id", contatoId)
    .maybeSingle();
  if (!contato) {
    return null;
  }
  const { data: ultimaEntrada } = await supabase
    .from("mensagens")
    .select("criado_em")
    .eq("contato_id", contatoId)
    .eq("direcao", "entrada")
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  return {
    contatoId: contato.id,
    contatoNome: contato.nome,
    telefone: contato.telefone,
    telefoneFormatado: contato.telefone ? formatarTelefoneBR(contato.telefone) : null,
    atendimento: contato.atendimento,
    atribuidoA: contato.atribuido_a,
    naoLidas: contato.nao_lidas,
    simulacao: contato.origem === "simulacao",
    janela: janelaAtendimento(ultimaEntrada?.criado_em ?? null, new Date().toISOString()),
  };
}

/**
 * Mensagens de uma conversa (cronológico, as `limite` mais recentes). RLS
 * escopa por org. Anônimo recebe [].
 */
export async function listarMensagensDoContato(
  contatoId: string,
  limite = 100,
): Promise<MensagemConversa[]> {
  const sessao = await obterSessao();
  if (!sessao) {
    return [];
  }
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("mensagens")
    .select("id, direcao, corpo, status, template_nome, autor_ia, criado_em")
    .eq("contato_id", contatoId)
    .order("criado_em", { ascending: false })
    .limit(limite);
  if (error) {
    throw new Error(`listarMensagensDoContato: ${error.message}`);
  }
  // Query desc (pega as mais recentes) → exibição em ordem cronológica.
  return (data ?? [])
    .map((m) => ({
      id: m.id,
      direcao: m.direcao,
      corpo: m.corpo,
      status: m.status,
      templateNome: m.template_nome,
      autorIa: m.autor_ia,
      criadoEm: m.criado_em,
    }))
    .reverse();
}

// --- Fila de atendimento (RPC 0030 — contrato { ok }, nunca lança) ---

/** Executa a RPC de estado da conversa e traduz o erro para pt-BR curto. */
async function mudarEstadoConversa(
  contatoId: string,
  args: { atendimento?: "ia" | "humano" | "resolvido"; atribuir?: "eu" | "ninguem"; zerarNaoLidas?: boolean },
): Promise<ResultadoFila> {
  try {
    await exigirEquipe();
  } catch {
    return { ok: false, erro: "Sem permissão para gerenciar conversas. Entre novamente." };
  }
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("atualizar_estado_conversa", {
    p_contato_id: contatoId,
    p_atendimento: args.atendimento,
    p_atribuir: args.atribuir,
    p_zerar_nao_lidas: args.zerarNaoLidas ?? false,
  });
  if (error) {
    return { ok: false, erro: "Não foi possível atualizar a conversa — tente de novo." };
  }
  revalidatePath("/corretor/crm/conversas");
  return { ok: true };
}

/** Assumo a conversa: ela vira minha (fila "Minhas") e sai da IA. */
export async function atribuirConversaAction(contatoId: string): Promise<ResultadoFila> {
  return mudarEstadoConversa(contatoId, { atendimento: "humano", atribuir: "eu" });
}

/**
 * Devolve a conversa para a IA atender. Exige a IA ATIVA na org — devolver
 * para uma IA desligada deixaria o cliente falando sozinho (degrade honesto).
 */
export async function devolverParaIaAction(contatoId: string): Promise<ResultadoFila> {
  try {
    await exigirEquipe();
  } catch {
    return { ok: false, erro: "Sem permissão para gerenciar conversas. Entre novamente." };
  }
  const supabase = await criarClienteServidor();
  const { data: config } = await supabase
    .from("atendimento_config")
    .select("ia_ativa")
    .maybeSingle();
  if (!config?.ia_ativa) {
    return { ok: false, erro: "A IA está desligada na organização — ative em Treinar IA antes de devolver." };
  }
  return mudarEstadoConversa(contatoId, { atendimento: "ia", atribuir: "ninguem" });
}

/** Encerra o atendimento (some das filas ativas; nova mensagem REABRE). */
export async function marcarResolvidoAction(contatoId: string): Promise<ResultadoFila> {
  return mudarEstadoConversa(contatoId, { atendimento: "resolvido", zerarNaoLidas: true });
}

/** Zera o contador de não lidas (abri a conversa e li). */
export async function marcarLidaAction(contatoId: string): Promise<ResultadoFila> {
  return mudarEstadoConversa(contatoId, { zerarNaoLidas: true });
}

// --- Envio 1:1 (contrato { ok } — nunca lança) ---

/**
 * Envia TEXTO LIVRE ao contato pela Meta Cloud API.
 *   - Contato de SIMULAÇÃO ⇒ registra como 'enviada' SEM tocar a Meta.
 *   - Sem Meta conectada ⇒ { ok: false, erro, waUrl } — fallback honesto para
 *     wa.me (link pronto com a mensagem; o corretor envia do aparelho).
 *   - Janela de 24h FECHADA ⇒ { ok: false, erro } instruindo a usar template.
 *   - Com janela aberta: registra a saída como 'pendente', envia e promove a
 *     'enviada' (com meta_message_id — o webhook atualiza entregue/lida).
 */
export async function enviarMensagemAction(
  contatoId: string,
  corpo: string,
): Promise<ResultadoMensagem> {
  let ctx: { usuarioId: string; orgId: string };
  try {
    ctx = await exigirEquipe();
  } catch {
    return { ok: false, erro: "Sem permissão para enviar mensagens. Entre novamente." };
  }
  const texto = corpo.trim();
  if (texto === "" || texto.length > 4096) {
    return { ok: false, erro: "Escreva uma mensagem de 1 a 4096 caracteres." };
  }
  // Rate limit leve por usuário (mesmo padrão do redator de WhatsApp).
  if (!permitido(`conversa:${ctx.usuarioId}`, 30, 60_000)) {
    return { ok: false, erro: "Muitas mensagens em sequência — aguarde um instante." };
  }

  const supabase = await criarClienteServidor();
  const { data: contato, error } = await supabase
    .from("contatos")
    .select("id, telefone, origem")
    .eq("id", contatoId)
    .maybeSingle();
  if (error || !contato) {
    return { ok: false, erro: "Contato não encontrado ou fora do seu acesso." };
  }

  // Contato de SIMULAÇÃO: registra e pronto — a Meta NUNCA é chamada.
  if (contato.origem === "simulacao") {
    const { data: simulada, error: erroSim } = await supabase
      .from("mensagens")
      .insert({
        org_id: ctx.orgId,
        contato_id: contatoId,
        canal: "whatsapp",
        direcao: "saida",
        corpo: texto,
        status: "enviada",
      })
      .select("id")
      .single();
    if (erroSim || !simulada) {
      return { ok: false, erro: "Não foi possível registrar a mensagem — tente de novo." };
    }
    revalidatePath("/corretor/crm/conversas");
    return { ok: true, mensagemId: simulada.id };
  }

  if (!contato.telefone) {
    return { ok: false, erro: "Este contato não tem telefone cadastrado." };
  }

  // Sem Meta conectada: degrade honesto — link wa.me pronto (sem registrar em
  // mensagens: não sabemos se o corretor de fato enviou pelo aparelho).
  if (!metaDisponivel()) {
    return {
      ok: false,
      erro: "WhatsApp não conectado ainda",
      waUrl: montarLinkWhatsApp(contato.telefone, texto),
    };
  }

  // GATE do modo de envio (central de configuração, 0033): em modo teste, só
  // números da lista recebem pela Meta — as demais tentativas param AQUI.
  const gate = await podeEnviarPara(supabase, ctx.orgId, contato.telefone);
  if (!gate.pode) {
    return { ok: false, erro: ERRO_MODO_TESTE };
  }

  // Janela de 24h (regra da Meta): texto livre só com janela ABERTA.
  const { data: ultimaEntrada } = await supabase
    .from("mensagens")
    .select("criado_em")
    .eq("contato_id", contatoId)
    .eq("direcao", "entrada")
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  const janela = janelaAtendimento(
    ultimaEntrada?.criado_em ?? null,
    new Date().toISOString(),
  );
  if (!janela.aberta) {
    return { ok: false, erro: "fora da janela de 24h — use um template" };
  }

  // Registra a saída ANTES do envio (histórico nunca se perde); org_id da
  // sessão satisfaz a policy — o trigger 0026 rederiva do contato (anti-forja).
  const { data: pendente, error: erroInsert } = await supabase
    .from("mensagens")
    .insert({
      org_id: ctx.orgId,
      contato_id: contatoId,
      canal: "whatsapp",
      direcao: "saida",
      corpo: texto,
      status: "pendente",
    })
    .select("id")
    .single();
  if (erroInsert || !pendente) {
    return { ok: false, erro: "Não foi possível registrar a mensagem — tente de novo." };
  }

  const envio = await enviarTextoWhatsApp(contato.telefone, texto);
  if (!envio.ok) {
    await supabase
      .from("mensagens")
      .update({ status: "falhou", erro: envio.erro })
      .eq("id", pendente.id);
    return { ok: false, erro: envio.erro };
  }
  // Falha ao promover o status é tolerada de propósito: a mensagem JÁ saiu —
  // devolver erro aqui induziria reenvio duplicado.
  await supabase
    .from("mensagens")
    .update({ status: "enviada", meta_message_id: envio.metaMessageId })
    .eq("id", pendente.id);
  revalidatePath("/corretor/crm/conversas");
  return { ok: true, mensagemId: pendente.id };
}

/**
 * Envia um TEMPLATE ao contato (única forma de falar FORA da janela de 24h —
 * inclusive para iniciar conversa). Integrado ao espelho local
 * whatsapp_templates (0029): quando o template existe no espelho, o envio
 * REAL exige status 'aprovado' (a aprovação acontece NA Meta — aqui só
 * conferimos o registro); sem espelho local, a Meta continua sendo a fonte
 * da verdade (ela recusa template desconhecido/reprovado). Contato de
 * SIMULAÇÃO aceita QUALQUER template e nunca toca a Meta.
 */
export async function enviarTemplateAction(
  contatoId: string,
  templateNome: string,
  variaveis?: string[],
): Promise<ResultadoMensagem> {
  let ctx: { usuarioId: string; orgId: string };
  try {
    ctx = await exigirEquipe();
  } catch {
    return { ok: false, erro: "Sem permissão para enviar mensagens. Entre novamente." };
  }
  const nome = templateNome.trim();
  if (nome === "") {
    return { ok: false, erro: "Informe o nome do template aprovado na Meta." };
  }
  if (!permitido(`conversa:${ctx.usuarioId}`, 30, 60_000)) {
    return { ok: false, erro: "Muitas mensagens em sequência — aguarde um instante." };
  }

  const supabase = await criarClienteServidor();
  const { data: contato, error } = await supabase
    .from("contatos")
    .select("id, telefone, origem")
    .eq("id", contatoId)
    .maybeSingle();
  if (error || !contato) {
    return { ok: false, erro: "Contato não encontrado ou fora do seu acesso." };
  }

  // Corpo descritivo no histórico (o texto real vive no template da Meta).
  const corpo =
    variaveis !== undefined && variaveis.length > 0
      ? `Template "${nome}": ${variaveis.join(" · ")}`
      : `Template "${nome}"`;

  // Contato de SIMULAÇÃO: registra e pronto (qualquer status de template).
  if (contato.origem === "simulacao") {
    const { data: simulada, error: erroSim } = await supabase
      .from("mensagens")
      .insert({
        org_id: ctx.orgId,
        contato_id: contatoId,
        canal: "whatsapp",
        direcao: "saida",
        corpo,
        template_nome: nome,
        status: "enviada",
      })
      .select("id")
      .single();
    if (erroSim || !simulada) {
      return { ok: false, erro: "Não foi possível registrar a mensagem — tente de novo." };
    }
    revalidatePath("/corretor/crm/conversas");
    return { ok: true, mensagemId: simulada.id };
  }

  if (!contato.telefone) {
    return { ok: false, erro: "Este contato não tem telefone cadastrado." };
  }
  if (!metaDisponivel()) {
    return {
      ok: false,
      erro: "WhatsApp não conectado ainda — templates só saem pela API oficial da Meta.",
    };
  }

  // GATE do modo de envio (0033): mesmo template aprovado não sai para número
  // fora da lista quando a org está em modo teste.
  const gate = await podeEnviarPara(supabase, ctx.orgId, contato.telefone);
  if (!gate.pode) {
    return { ok: false, erro: ERRO_MODO_TESTE };
  }

  // Espelho local (0029): se o template está registrado aqui, o envio REAL
  // só sai com o veredito 'aprovado' DA META registrado.
  const { data: locais } = await supabase
    .from("whatsapp_templates")
    .select("idioma, status_meta")
    .eq("nome", nome);
  const aprovado = (locais ?? []).find((t) => t.status_meta === "aprovado");
  if (locais && locais.length > 0 && !aprovado) {
    return {
      ok: false,
      erro: "Este template ainda não foi aprovado pela Meta — envie após registrar a aprovação em Templates.",
    };
  }
  const idioma = aprovado?.idioma ?? "pt_BR";

  const { data: pendente, error: erroInsert } = await supabase
    .from("mensagens")
    .insert({
      org_id: ctx.orgId,
      contato_id: contatoId,
      canal: "whatsapp",
      direcao: "saida",
      corpo,
      template_nome: nome,
      status: "pendente",
    })
    .select("id")
    .single();
  if (erroInsert || !pendente) {
    return { ok: false, erro: "Não foi possível registrar a mensagem — tente de novo." };
  }

  const envio = await enviarTemplateWhatsApp(contato.telefone, nome, idioma, variaveis);
  if (!envio.ok) {
    await supabase
      .from("mensagens")
      .update({ status: "falhou", erro: envio.erro })
      .eq("id", pendente.id);
    return { ok: false, erro: envio.erro };
  }
  await supabase
    .from("mensagens")
    .update({ status: "enviada", meta_message_id: envio.metaMessageId })
    .eq("id", pendente.id);
  revalidatePath("/corretor/crm/conversas");
  return { ok: true, mensagemId: pendente.id };
}
