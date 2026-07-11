// IA ATENDENTE — responde clientes no WhatsApp em nome da imobiliária, com
// LLM (Groq, mesma cascata/orçamentos do interpretador e do redator).
// Server-side APENAS (a chave vive em process.env.GROQ_API_KEY).
//
// PRINCÍPIOS (invariantes — regras de produto, não de estilo):
//   - decidirEscalonamento (@imobia/core) roda ANTES da IA: cliente pedindo
//     humano/assunto sensível/frustração ⇒ escala SEM gastar chamada de LLM.
//   - As REGRAS FIXAS do prompt vêm de montarContextoAtendimento (core):
//     transparência (assistente virtual, nunca finge ser humano), NUNCA
//     inventar imóvel/preço/endereço, respostas curtas, escalar em dúvida.
//   - PÓS-VALIDAÇÃO fail-safe (atendente-nucleo, puro/testado): resposta
//     vazia, longa demais (>500) ou com "R$" não confirmado no contexto ⇒
//     ESCALAR por segurança (preferimos um humano a um preço inventado).
//   - Sem chave ⇒ null (o pipeline manda tudo para a fila humana — degrade
//     honesto). Falha total da cascata (timeout/rede) ⇒ null também.
//   - PRIVACIDADE (LGPD): prompt e saída carregam dados do cliente — NUNCA
//     são logados aqui (nem em erro).

import { groq } from "@ai-sdk/groq";
import { generateText } from "ai";
import {
  decidirEscalonamento,
  montarContextoAtendimento,
  type ConfigContexto,
  type ContatoContexto,
  type MensagemContexto,
} from "@imobia/core";
import {
  iaDisponivel,
  modelosDaCascata,
  sinalDoModelo,
  TIMEOUT_TOTAL_MS,
} from "@/lib/ia/cascata-groq";
import { validarRespostaAtendente } from "@/lib/ia/atendente-nucleo";

/** Quantas mensagens do histórico entram no prompt (as mais recentes). */
const HISTORICO_NO_PROMPT = 12;

export type RespostaAtendente =
  | { tipo: "resposta"; texto: string }
  | { tipo: "escalar"; motivo: string };

/**
 * Responde à mensagem do cliente como a assistente virtual da org.
 *
 *   1. Gatilho determinístico (core decidirEscalonamento sobre a mensagem +
 *      tamanho da CONVERSA ATUAL) ⇒ { tipo: "escalar" } sem chamar o LLM.
 *   2. Sem GROQ_API_KEY ⇒ null (quem chama degrada para a fila humana).
 *   3. LLM com montarContextoAtendimento (regras fixas + persona/FAQ da org +
 *      últimas 12 mensagens) e a mensagem nova como prompt.
 *   4. Pós-validação fail-safe ⇒ resposta aprovada OU escalar por segurança.
 *
 * `conversaAtualLen`: mensagens da conversa ATUAL (core contarConversaAtual)
 * para o gatilho de "conversa longa" — NUNCA a vida inteira do contato, senão
 * cliente recorrente (e o contato do simulador) escalaria para sempre após 20
 * mensagens acumuladas. Default: historico.length (comportamento antigo).
 *
 * Falha total da cascata (timeout/rede/modelo) ⇒ null. NUNCA lança.
 */
export async function responderComoAtendente(
  orgConfig: ConfigContexto,
  contato: ContatoContexto,
  historico: MensagemContexto[],
  msgCliente: string,
  conversaAtualLen: number = historico.length,
): Promise<RespostaAtendente | null> {
  // 1. Gatilhos determinísticos ANTES de qualquer LLM.
  const decisao = decidirEscalonamento(msgCliente, conversaAtualLen);
  if (decisao.escalar) {
    return { tipo: "escalar", motivo: decisao.motivo ?? "gatilho" };
  }

  // 2. Sem chave ⇒ IA desligada; o pipeline manda para a fila humana.
  if (!iaDisponivel()) {
    return null;
  }

  const recentes = historico.slice(-HISTORICO_NO_PROMPT);
  const system = montarContextoAtendimento(orgConfig, contato, recentes);
  const prompt = [
    `Mensagem NOVA do cliente: ${msgCliente}`,
    "Responda SOMENTE com o texto da resposta ao cliente — nada antes, nada depois, sem aspas, sem markdown.",
  ].join("\n");

  const sinalTotal = AbortSignal.timeout(TIMEOUT_TOTAL_MS); // teto da cascata
  for (const modelo of modelosDaCascata()) {
    try {
      const { text } = await generateText({
        model: groq(modelo),
        system,
        prompt,
        maxRetries: 1,
        abortSignal: sinalDoModelo(modelo, sinalTotal),
      });
      // 4. Pós-validação fail-safe: contexto = TUDO que a IA recebeu.
      const validacao = validarRespostaAtendente(text, `${system}\n${msgCliente}`);
      if (validacao.ok) {
        return { tipo: "resposta", texto: validacao.texto };
      }
      return { tipo: "escalar", motivo: validacao.motivo };
    } catch {
      if (sinalTotal.aborted) {
        return null; // estourou o orçamento total — não insiste
      }
    }
  }
  return null;
}
