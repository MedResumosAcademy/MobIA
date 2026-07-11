// PIPELINE DE ATENDIMENTO — o caminho ÚNICO de toda mensagem que CHEGA de um
// cliente (webhook da Meta E simulador usam exatamente este fluxo; zero
// divergência entre demo e produção).
//
// NÃO é módulo "use server" DE PROPÓSITO: processarMensagemEntrada recebe o
// client Supabase do chamador (service role no webhook, sessão no simulador)
// e jamais pode virar endpoint público. Server-side apenas.
//
// FLUXO (por mensagem de entrada):
//   1. grava a mensagem ('recebida'; trigger 0029 incrementa nao_lidas);
//   2. contato em 'ia' + config.ia_ativa ⇒ responderComoAtendente:
//      - "resposta" ⇒ grava a saída (webhook: envia via Meta quando
//        disponível; simulador: 'enviada' SEM tocar a Meta — NUNCA); contato
//        SEM histórico ganha antes as BOAS-VINDAS da org (Treinar IA);
//      - "escalar"  ⇒ atendimento='humano' + mensagem de transição gentil ao
//        cliente + nao_lidas restaurado (o trigger zera na saída; restaurar
//        é o FLAG que põe a conversa na fila "Precisam");
//      - null (sem GROQ_API_KEY / cascata falhou) ⇒ atendimento='humano'
//        SILENCIOSO (degrade honesto: tudo cai na fila humana, sem prometer
//        nada ao cliente);
//   3. contato em 'humano' ⇒ só grava (a conversa já está na fila humana);
//      'resolvido' ⇒ REABRE (volta para 'ia' se a IA está ativa, senão
//      'humano') e segue o fluxo do estado novo.
//
// PRIVACIDADE (LGPD): nunca loga telefone, nome ou corpo de mensagem.

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { contarConversaAtual, type ConfigContexto, type MensagemContexto } from "@imobia/core";
import { faqItemSchema, type Database } from "@imobia/domain";
import { responderComoAtendente } from "@/lib/ia/atendente";
import {
  podeEnviarPara,
  type GateEnvio,
} from "@/lib/dados/envio-whatsapp";
import { enviarTextoWhatsApp, metaDisponivel } from "@/lib/meta/whatsapp";

type Cliente = SupabaseClient<Database>;

export type OrigemEntrada = "webhook" | "simulador";

export type ResultadoPipeline =
  | {
      ok: true;
      /** O que aconteceu: IA respondeu, escalou, ou foi direto à fila humana. */
      acao: "ia_respondeu" | "escalada" | "fila_humana";
      /** Texto que a IA mandou ao cliente (resposta ou transição) — null se nada. */
      respostaIa: string | null;
    }
  | { ok: false; erro: string };

// Mensagem de transição gentil ao cliente quando a conversa ESCALA (a IA
// nunca some sem avisar — transparência).
function mensagemDeTransicao(nomeAssistente: string): string {
  return (
    `Perfeito! Vou te passar para um corretor da nossa equipe continuar o ` +
    `atendimento por aqui — já avisei o time. Obrigada por falar com a ${nomeAssistente}!`
  );
}

const faqArraySchema = z.array(faqItemSchema).max(30);

/** Config ativa da org: contexto do motor puro + boas-vindas (primeira
 * mensagem de contato novo); null quando não existe/IA inativa. */
async function carregarConfigAtiva(
  supabase: Cliente,
  orgId: string,
): Promise<{ contexto: ConfigContexto; boasVindas: string | null } | null> {
  const { data } = await supabase
    .from("atendimento_config")
    .select("ia_ativa, nome_assistente, persona, faq, escalar_quando, boas_vindas")
    .eq("org_id", orgId)
    .maybeSingle();
  if (!data || !data.ia_ativa) {
    return null;
  }
  const faq = faqArraySchema.safeParse(data.faq);
  const boasVindas = data.boas_vindas?.trim() ?? "";
  return {
    contexto: {
      nomeAssistente: data.nome_assistente,
      persona: data.persona ?? undefined,
      faq: faq.success ? faq.data : [],
      escalarQuando: data.escalar_quando ?? undefined,
    },
    boasVindas: boasVindas === "" ? null : boasVindas,
  };
}

/**
 * Grava a SAÍDA da IA (sempre com autor_ia=true — selo "IA" na UI, 0031)
 * respeitando a origem:
 *   - simulador: status 'enviada' direto — o simulador NUNCA chama a Meta;
 *   - webhook: 'pendente' → envia via Meta → 'enviada'/'falhou' (sem Meta
 *     configurada, registra 'falhou' honesto — o texto fica no histórico).
 *
 * GATE do modo de envio (0033): com a org em modo TESTE e o número fora da
 * lista, a resposta NÃO sai pela Meta — fica registrada com status
 * 'bloqueada_teste' (0034) e anotação, para o histórico contar a verdade.
 * `gate` chega calculado do processarMensagemEntrada (1 leitura por evento).
 */
async function registrarSaidaIa(
  supabase: Cliente,
  contato: { id: string; org_id: string; telefone: string | null },
  corpo: string,
  origem: OrigemEntrada,
  gate: GateEnvio,
): Promise<void> {
  if (origem === "simulador") {
    await supabase.from("mensagens").insert({
      org_id: contato.org_id,
      contato_id: contato.id,
      canal: "whatsapp",
      direcao: "saida",
      corpo,
      status: "enviada",
      autor_ia: true,
    });
    return;
  }

  if (!gate.pode) {
    await supabase.from("mensagens").insert({
      org_id: contato.org_id,
      contato_id: contato.id,
      canal: "whatsapp",
      direcao: "saida",
      corpo,
      status: "bloqueada_teste",
      erro:
        "Modo teste: número fora da lista de números de teste — a resposta da IA não foi enviada.",
      autor_ia: true,
    });
    return;
  }

  if (!metaDisponivel() || contato.telefone === null) {
    await supabase.from("mensagens").insert({
      org_id: contato.org_id,
      contato_id: contato.id,
      canal: "whatsapp",
      direcao: "saida",
      corpo,
      status: "falhou",
      erro: "WhatsApp não conectado — resposta da IA não pôde ser enviada.",
      autor_ia: true,
    });
    return;
  }

  const { data: pendente } = await supabase
    .from("mensagens")
    .insert({
      org_id: contato.org_id,
      contato_id: contato.id,
      canal: "whatsapp",
      direcao: "saida",
      corpo,
      status: "pendente",
      autor_ia: true,
    })
    .select("id")
    .single();
  if (!pendente) {
    return;
  }
  const envio = await enviarTextoWhatsApp(contato.telefone, corpo);
  if (envio.ok) {
    await supabase
      .from("mensagens")
      .update({ status: "enviada", meta_message_id: envio.metaMessageId })
      .eq("id", pendente.id);
  } else {
    await supabase
      .from("mensagens")
      .update({ status: "falhou", erro: envio.erro })
      .eq("id", pendente.id);
  }
}

/**
 * Processa UMA mensagem recebida do cliente (ver FLUXO no topo do arquivo).
 * `supabase` é o client do CHAMADOR: service role no webhook (sem sessão),
 * sessão autenticada no simulador (RLS escopa). Nunca lança.
 */
export async function processarMensagemEntrada(
  supabase: Cliente,
  contatoId: string,
  corpo: string,
  opcoes: { origem: OrigemEntrada; metaMessageId?: string },
): Promise<ResultadoPipeline> {
  const { data: contato } = await supabase
    .from("contatos")
    .select("id, org_id, nome, telefone, atendimento, nao_lidas, etapa_chave")
    .eq("id", contatoId)
    .maybeSingle();
  if (!contato) {
    return { ok: false, erro: "contato não encontrado" };
  }

  // 1. Grava a ENTRADA antes de qualquer decisão (histórico nunca se perde).
  //    Dedup do webhook: o índice único de meta_message_id derruba reentregas.
  const { data: entrada, error: erroEntrada } = await supabase
    .from("mensagens")
    .insert({
      org_id: contato.org_id,
      contato_id: contato.id,
      canal: "whatsapp",
      direcao: "entrada",
      corpo,
      status: "recebida",
      meta_message_id: opcoes.metaMessageId ?? null,
    })
    .select("id")
    .single();
  if (erroEntrada || !entrada) {
    return { ok: false, erro: "mensagem duplicada ou não registrada" };
  }

  const config = await carregarConfigAtiva(supabase, contato.org_id);

  // 'resolvido' REABRE: IA ativa retoma; senão vai para a fila humana.
  let estado = contato.atendimento;
  if (estado === "resolvido") {
    estado = config !== null ? "ia" : "humano";
    await supabase
      .from("contatos")
      .update({ atendimento: estado })
      .eq("id", contato.id);
  }

  // 3. Fila humana: só grava (nao_lidas já subiu via trigger).
  if (estado !== "ia") {
    return { ok: true, acao: "fila_humana", respostaIa: null };
  }

  // IA marcada no contato, mas desligada na org/sem config ⇒ degrade honesto.
  if (config === null) {
    await supabase
      .from("contatos")
      .update({ atendimento: "humano" })
      .eq("id", contato.id);
    return { ok: true, acao: "fila_humana", respostaIa: null };
  }

  // 2. Histórico ANTES desta mensagem — 30 é o bastante para o prompt (a IA
  //    usa as 12 mais recentes) E para o gatilho de conversa longa do core.
  const { data: anteriores } = await supabase
    .from("mensagens")
    .select("direcao, corpo, criado_em")
    .eq("contato_id", contato.id)
    .neq("id", entrada.id)
    .order("criado_em", { ascending: false })
    .limit(30);
  const cronologicas = (anteriores ?? []).slice().reverse();
  const historico: MensagemContexto[] = cronologicas.map((m) => ({
    direcao: m.direcao === "entrada" ? ("entrada" as const) : ("saida" as const),
    corpo: m.corpo,
  }));
  // Gatilho de "conversa longa" conta SÓ a conversa ATUAL (silêncio > 24h
  // separa conversas) — nunca a vida inteira do contato, senão cliente
  // recorrente (e o contato do simulador) escalaria para sempre.
  const conversaAtualLen = contarConversaAtual(
    cronologicas.map((m) => m.criado_em),
    new Date().toISOString(),
  );

  // BOAS-VINDAS (Treinar IA): contato SEM histórico ganha a saudação da org
  // como primeira saída — entra no histórico do prompt para a IA saber que já
  // cumprimentou (só é enviada de fato se a IA conseguir responder).
  const boasVindas = historico.length === 0 ? config.boasVindas : null;
  const historicoComBoasVindas: MensagemContexto[] =
    boasVindas !== null
      ? [{ direcao: "saida" as const, corpo: boasVindas }, ...historico]
      : historico;

  const resposta = await responderComoAtendente(
    config.contexto,
    { nome: contato.nome, funilEtapa: contato.etapa_chave ?? undefined },
    historicoComBoasVindas,
    corpo,
    conversaAtualLen,
  );

  // GATE do modo de envio (0033), calculado UMA vez por evento: no simulador
  // não se aplica (a Meta nunca é chamada); no webhook, decide se a saída da
  // IA pode ir para a Meta ou fica retida como 'bloqueada_teste'.
  const gate: GateEnvio =
    opcoes.origem === "simulador"
      ? { pode: true }
      : await podeEnviarPara(supabase, contato.org_id, contato.telefone);

  if (resposta === null) {
    // IA indisponível (sem chave/cascata falhou) ⇒ fila humana SILENCIOSA.
    await supabase
      .from("contatos")
      .update({ atendimento: "humano" })
      .eq("id", contato.id);
    return { ok: true, acao: "fila_humana", respostaIa: null };
  }

  if (resposta.tipo === "resposta") {
    if (boasVindas !== null) {
      await registrarSaidaIa(supabase, contato, boasVindas, opcoes.origem, gate);
    }
    await registrarSaidaIa(supabase, contato, resposta.texto, opcoes.origem, gate);
    return { ok: true, acao: "ia_respondeu", respostaIa: resposta.texto };
  }

  // ESCALAR: humano assume + transição gentil + flag para a fila "Precisam".
  // (Sem boas-vindas aqui: cumprimentar e despachar na mesma resposta soaria
  // falso — a transição já se apresenta e explica o próximo passo.)
  await supabase
    .from("contatos")
    .update({ atendimento: "humano" })
    .eq("id", contato.id);
  const transicao = mensagemDeTransicao(config.contexto.nomeAssistente);
  await registrarSaidaIa(supabase, contato, transicao, opcoes.origem, gate);
  // O trigger 0029 ZEROU nao_lidas ao gravar a saída — restaura o contador
  // (entradas do cliente que nenhum humano leu) para a conversa aparecer na
  // fila "Precisam" (critério: humano + nao_lidas > 0).
  await supabase
    .from("contatos")
    .update({ nao_lidas: contato.nao_lidas + 1 })
    .eq("id", contato.id);
  return { ok: true, acao: "escalada", respostaIa: transicao };
}
