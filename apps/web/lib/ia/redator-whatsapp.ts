// REDATOR WHATSAPP — redige com LLM (Groq) a mensagem de WhatsApp de um
// corretor para um cliente, a partir do MESMO ContextoMensagem do motor puro.
// Server-side APENAS (a chave vive em process.env.GROQ_API_KEY).
//
// PRINCÍPIOS (invariantes — espelham o interpretador-llm):
//   - O motor puro (gerarMensagemWhatsApp de @imobia/core) é o fallback
//     determinístico; este módulo é a versão "com voz" quando há chave.
//   - Sem chave / erro / timeout / saída vazia ⇒ null (NUNCA lança) — o
//     chamador degrada para o template do motor.
//   - PRIVACIDADE: o prompt e a saída carregam dados do cliente — NUNCA são
//     logados aqui (nem em erro).

import { groq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { formatarReais, type ContextoMensagem, type ObjetivoMensagem } from "@imobia/core";
import {
  iaDisponivel,
  modelosDaCascata,
  sinalDoModelo,
  TIMEOUT_TOTAL_MS,
} from "@/lib/ia/cascata-groq";

// O que cada objetivo significa, dito ao modelo em pt-BR claro.
const DESCRICAO_OBJETIVO: Record<ObjetivoMensagem, string> = {
  followup: "retomar a conversa (follow-up) e se colocar à disposição",
  visita: "convidar o cliente para uma visita ao imóvel (ou confirmar a que está combinada)",
  proposta: "avançar com a proposta e alinhar os próximos passos",
  reativacao: "reaproximar um cliente que está há um tempo sem contato",
  pos_venda: "parabenizar pelo negócio fechado e manter o relacionamento (pós-venda)",
};

const SYSTEM = [
  "Você redige UMA mensagem de WhatsApp curta (2 a 4 frases) que um corretor de imóveis brasileiro enviará a um cliente. pt-BR.",
  "Tom caloroso e profissional — nem robótico, nem íntimo demais.",
  "Use APENAS os dados do contexto fornecido (nome, imóvel, etapa, dias sem contato, valor). É PROIBIDO inventar endereços, preços, datas, horários, características do imóvel ou qualquer dado que não esteja no contexto; se um dado não veio, simplesmente não o mencione.",
  "No máximo 1 emoji na mensagem inteira.",
  "Termine com UMA única pergunta ou chamada para ação.",
  "Sem assinatura/despedida no final, sem markdown, sem aspas em volta.",
  "Responda SOMENTE com o texto da mensagem — nada antes, nada depois.",
].join("\n");

/** "Sofia Almeida" ⇒ "Sofia" (ou o primeiroNome explícito do contexto). */
function primeiroNomeDe(ctx: ContextoMensagem): string {
  const explicito = ctx.primeiroNome?.trim();
  if (explicito) return explicito;
  return ctx.nomeContato.trim().split(/\s+/)[0] ?? ctx.nomeContato.trim();
}

/** Prompt com o objetivo + SÓ os dados presentes (o system proíbe inventar). */
function montarPrompt(objetivo: ObjetivoMensagem, ctx: ContextoMensagem): string {
  const linhas = [
    `Objetivo da mensagem: ${DESCRICAO_OBJETIVO[objetivo]}.`,
    "Contexto:",
    `- Cliente: ${ctx.nomeContato.trim()} (trate por ${primeiroNomeDe(ctx)})`,
    `- Corretor (quem envia): ${ctx.nomeCorretor.trim()}`,
  ];
  const etapa = ctx.etapa?.trim();
  if (etapa) linhas.push(`- Etapa do funil: ${etapa}`);
  const imovel = ctx.imovelTitulo?.trim();
  if (imovel) linhas.push(`- Imóvel do negócio: ${imovel}`);
  const dias = ctx.diasSemMovimento;
  if (typeof dias === "number" && Number.isFinite(dias) && dias >= 1) {
    linhas.push(`- Dias sem contato: ${Math.floor(dias)}`);
  }
  if (typeof ctx.valor === "number" && ctx.valor > 0) {
    linhas.push(`- Valor do negócio: ${formatarReais(ctx.valor)}`);
  }
  if (ctx.dataVisitaISO) linhas.push(`- Visita combinada (ISO): ${ctx.dataVisitaISO}`);
  return linhas.join("\n");
}

/** Limpa a saída do modelo (aspas/cercas acidentais); vazia ⇒ null. */
function normalizarSaida(bruta: string): string | null {
  let t = bruta.trim();
  t = t.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "").trim();
  if (t.length >= 2 && /^["'“”]/.test(t) && /["'“”]$/.test(t)) {
    t = t.slice(1, -1).trim();
  }
  return t ? t : null;
}

/**
 * Redige a mensagem com o LLM (mesma cascata/orçamentos do interpretador) ou
 * devolve null em QUALQUER falha — o chamador usa gerarMensagemWhatsApp.
 * Nunca lança; nunca loga o conteúdo.
 */
export async function redigirMensagemComIa(
  objetivo: ObjetivoMensagem,
  ctx: ContextoMensagem,
): Promise<string | null> {
  if (!iaDisponivel()) return null;
  const prompt = montarPrompt(objetivo, ctx);
  const sinalTotal = AbortSignal.timeout(TIMEOUT_TOTAL_MS); // teto da cascata
  for (const modelo of modelosDaCascata()) {
    try {
      const { text } = await generateText({
        model: groq(modelo),
        system: SYSTEM,
        prompt,
        maxRetries: 1,
        abortSignal: sinalDoModelo(modelo, sinalTotal),
      });
      const mensagem = normalizarSaida(text);
      if (mensagem !== null) return mensagem;
    } catch {
      if (sinalTotal.aborted) return null; // estourou o orçamento total — não insiste
    }
  }
  return null;
}
