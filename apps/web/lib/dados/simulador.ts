"use server";

// SIMULADOR DE ATENDIMENTO — o gestor conversa com a PRÓPRIA IA como se
// fosse um cliente, HOJE, sem Meta conectada. Módulo "use server".
//
// COMO FUNCIONA: um contato de TESTE da org (origem 'simulacao', tag
// "simulacao", sem telefone) recebe a mensagem digitada pelo gestor via o
// MESMO pipeline do webhook (processarMensagemEntrada, origem "simulador") —
// zero divergência entre demo e produção. A ÚNICA diferença: a saída da IA é
// gravada como 'enviada' SEM tocar a Meta (NUNCA — invariante do pipeline).
//
// SEGURANÇA: gestor/admin apenas; a ação SÓ aceita contatos com origem
// 'simulacao' (jamais roda sobre um cliente real); o contato nasce em
// atendimento='ia' para a demonstração começar com a IA respondendo.

import { revalidatePath } from "next/cache";
import { obterPerfil, obterSessao } from "@/lib/auth/sessao";
import { processarMensagemEntrada } from "@/lib/dados/atendimento";
import { permitido } from "@/lib/seguranca/limitador";
import { criarClienteServidor } from "@/lib/supabase/server";

const NOME_CONTATO_SIMULACAO = "Cliente simulado (teste da IA)";

/** Uma mensagem da thread simulada (mesmo shape do inbox). */
export type MensagemSimulada = {
  id: string;
  direcao: string;
  corpo: string;
  status: string;
  criadoEm: string;
};

export type ResultadoSimulacao =
  | {
      ok: true;
      contatoId: string;
      /** O que o pipeline fez com a mensagem (fila, resposta ou escalada). */
      acao: "ia_respondeu" | "escalada" | "fila_humana";
      /** Estado do contato DEPOIS do processamento ('ia' | 'humano' | ...). */
      atendimento: string;
      /** Thread completa atualizada (cronológica). */
      mensagens: MensagemSimulada[];
    }
  | { ok: false; erro: string };

async function exigirGestor(): Promise<{ usuarioId: string; orgId: string }> {
  const sessao = await obterSessao();
  if (!sessao) {
    throw new Error("não autenticado");
  }
  const perfil = await obterPerfil(sessao.usuarioId);
  if (!perfil || (perfil.papel !== "gestor" && perfil.papel !== "admin") || !perfil.orgId) {
    throw new Error("só gestor/admin simulam o atendimento");
  }
  return { usuarioId: sessao.usuarioId, orgId: perfil.orgId };
}

/** Reusa o contato de simulação da org (o mais antigo) ou cria um novo. */
async function reusarOuCriarContatoSimulacao(
  supabase: Awaited<ReturnType<typeof criarClienteServidor>>,
  ctx: { usuarioId: string; orgId: string },
): Promise<string | null> {
  const { data: existente } = await supabase
    .from("contatos")
    .select("id")
    .eq("origem", "simulacao")
    .order("criado_em", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existente) {
    return existente.id;
  }
  const { data: criado, error } = await supabase
    .from("contatos")
    .insert({
      org_id: ctx.orgId,
      responsavel_id: ctx.usuarioId,
      nome: NOME_CONTATO_SIMULACAO,
      origem: "simulacao",
      tags: ["simulacao"],
      atendimento: "ia",
    })
    .select("id")
    .single();
  if (error || !criado) {
    return null;
  }
  return criado.id;
}

/**
 * "+ Simular" do inbox: garante que o contato de teste da org existe (cria na
 * primeira vez) e devolve o id — a UI navega para a thread dele. Nenhuma
 * mensagem é criada aqui; quem conversa é simularMensagemAction.
 */
export async function iniciarSimulacaoAction(): Promise<
  { ok: true; contatoId: string } | { ok: false; erro: string }
> {
  let ctx: { usuarioId: string; orgId: string };
  try {
    ctx = await exigirGestor();
  } catch {
    return { ok: false, erro: "Só gestor ou admin usam o simulador." };
  }
  const supabase = await criarClienteServidor();
  const id = await reusarOuCriarContatoSimulacao(supabase, ctx);
  if (id === null) {
    return { ok: false, erro: "Não foi possível criar o contato de simulação." };
  }
  revalidatePath("/corretor/crm/conversas");
  return { ok: true, contatoId: id };
}

/**
 * Envia uma mensagem "de cliente" ao contato de simulação e devolve a thread
 * atualizada. `contatoId` null ⇒ reusa (ou cria) o contato de teste da org.
 * Contato real (origem ≠ 'simulacao') ⇒ recusa — o simulador nunca encosta
 * em cliente de verdade.
 */
export async function simularMensagemAction(
  contatoId: string | null,
  corpo: string,
): Promise<ResultadoSimulacao> {
  let ctx: { usuarioId: string; orgId: string };
  try {
    ctx = await exigirGestor();
  } catch {
    return { ok: false, erro: "Só gestor ou admin usam o simulador." };
  }
  const texto = corpo.trim();
  if (texto === "" || texto.length > 4096) {
    return { ok: false, erro: "Escreva uma mensagem de 1 a 4096 caracteres." };
  }
  if (!permitido(`simulador:${ctx.usuarioId}`, 20, 60_000)) {
    return { ok: false, erro: "Muitas mensagens em sequência — aguarde um instante." };
  }

  const supabase = await criarClienteServidor();

  // Resolve o contato de simulação (reusa por id OU pela org; cria se faltar).
  let id = contatoId;
  if (id !== null) {
    const { data } = await supabase
      .from("contatos")
      .select("id, origem")
      .eq("id", id)
      .maybeSingle();
    if (!data) {
      return { ok: false, erro: "Contato não encontrado ou fora do seu acesso." };
    }
    if (data.origem !== "simulacao") {
      return { ok: false, erro: "O simulador só conversa com o contato de teste — nunca com clientes reais." };
    }
  } else {
    id = await reusarOuCriarContatoSimulacao(supabase, ctx);
    if (id === null) {
      return { ok: false, erro: "Não foi possível criar o contato de simulação." };
    }
  }

  // O MESMO pipeline do webhook — origem "simulador" garante que a Meta
  // nunca é chamada (saídas gravadas como 'enviada' direto).
  const resultado = await processarMensagemEntrada(supabase, id, texto, {
    origem: "simulador",
  });
  if (!resultado.ok) {
    return { ok: false, erro: "Não foi possível processar a mensagem — tente de novo." };
  }

  // Thread atualizada + estado do contato (a UI mostra IA/humano na hora).
  const [{ data: mensagens }, { data: contato }] = await Promise.all([
    supabase
      .from("mensagens")
      .select("id, direcao, corpo, status, criado_em")
      .eq("contato_id", id)
      .order("criado_em", { ascending: true })
      .limit(200),
    supabase.from("contatos").select("atendimento").eq("id", id).maybeSingle(),
  ]);

  revalidatePath("/corretor/crm/conversas");
  return {
    ok: true,
    contatoId: id,
    acao: resultado.acao,
    atendimento: contato?.atendimento ?? "humano",
    mensagens: (mensagens ?? []).map((m) => ({
      id: m.id,
      direcao: m.direcao,
      corpo: m.corpo,
      status: m.status,
      criadoEm: m.criado_em,
    })),
  };
}

/**
 * RESET REAL da simulação: apaga as mensagens do contato de teste e o devolve
 * ao atendimento da IA — dá para demonstrar boas-vindas, resposta e escalada
 * quantas vezes quiser, sem o histórico acumulado travar a demo. RPC estreita
 * (0032, security definer): SÓ contatos origem='simulacao' da própria org,
 * gestor/admin — a policy de mensagens (sem DELETE para cliente real) não
 * afrouxa.
 */
export async function reiniciarSimulacaoAction(
  contatoId: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  try {
    await exigirGestor();
  } catch {
    return { ok: false, erro: "Só gestor ou admin usam o simulador." };
  }
  const supabase = await criarClienteServidor();
  const { data: contato } = await supabase
    .from("contatos")
    .select("id, origem")
    .eq("id", contatoId)
    .maybeSingle();
  if (!contato || contato.origem !== "simulacao") {
    return { ok: false, erro: "Só a conversa de simulação pode ser reiniciada." };
  }
  const { error } = await supabase.rpc("reiniciar_simulacao", {
    p_contato_id: contatoId,
  });
  if (error) {
    return { ok: false, erro: "Não foi possível reiniciar a simulação." };
  }
  revalidatePath("/corretor/crm/conversas");
  return { ok: true };
}
