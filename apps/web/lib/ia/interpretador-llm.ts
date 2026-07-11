// INTERPRETADOR LLM — fallback do assistente quando o motor determinístico
// (@imobia/core) não reconhece o comando. Server-side APENAS (a chave vive em
// process.env.GROQ_API_KEY, carregada de .env.local pelo Next).
//
// PRINCÍPIOS (invariantes):
//   - O motor puro é o caminho RÁPIDO; este módulo é fallback/ampliação.
//   - Sem chave ⇒ iaDisponivel() === false e nada muda no produto.
//   - Erro/timeout/saída inconsistente ⇒ null (NUNCA lança) — o chamador
//     degrada para a resposta "ajuda" de sempre.
//   - A saída é REVALIDADA (datas, instantes, valor em centavos) antes de
//     virar um ComandoInterpretado — o LLM não é confiável por construção.
//     O schema e a revalidação vivem em interpretador-normalizacao.ts (módulo
//     PURO, testado sem rede); aqui fica só a chamada ao provedor.

import { groq } from "@ai-sdk/groq";
import { generateObject } from "ai";
import type { ComandoInterpretado } from "@imobia/core";
import {
  iaDisponivel,
  modelosDaCascata,
  sinalDoModelo,
  TIMEOUT_TOTAL_MS,
} from "@/lib/ia/cascata-groq";
import {
  calendarioProximosDias,
  diaDaSemanaLocal,
  normalizar,
  SCHEMA_COMANDO,
} from "@/lib/ia/interpretador-normalizacao";

// A cascata de modelos, os orçamentos de tempo e a checagem de chave vivem em
// lib/ia/cascata-groq.ts (compartilhados com o redator de WhatsApp).
export { iaDisponivel } from "@/lib/ia/cascata-groq";

// --- Chamada ao LLM -----------------------------------------------------------

function montarSystem(agoraISO: string): string {
  // O modelo roda em modo json_object (o llama-3.3-70b da Groq não aceita
  // json_schema), então o formato é descrito AQUI e revalidado com zod depois.
  return [
    "Você mapeia pedidos de corretores de imóveis brasileiros (pt-BR, voz ou texto) para UM único comando estruturado do CRM.",
    `Agora é ${agoraISO} (${diaDaSemanaLocal(agoraISO)}), fuso America/Sao_Paulo.`,
    `Calendário: ${calendarioProximosDias(agoraISO)}.`,
    "Responda SOMENTE com um objeto JSON num destes formatos (campos com ? são opcionais — OMITA quando o pedido não trouxer):",
    '{"intencao":"consultar_agenda","dia":"YYYY-MM-DD"}',
    '{"intencao":"criar_evento","titulo":string,"tipo":"visita"|"reuniao"|"compromisso","inicioISO":"YYYY-MM-DDTHH:mm:ss-03:00","local"?:string,"contato"?:string}',
    '{"intencao":"criar_lembrete","titulo":string,"inicioISO":"YYYY-MM-DDTHH:mm:ss-03:00"}',
    '{"intencao":"criar_tarefa","titulo":string,"contato"?:string,"venceEm"?:"YYYY-MM-DD"}',
    '{"intencao":"criar_negocio","contato":string,"valor"?:number,"origem"?:string}',
    '{"intencao":"registrar_nota","contato":string,"nota":string}',
    '{"intencao":"mudar_etapa","contato":string,"etapa":"novo"|"contato"|"visita"|"proposta"|"fechamento"|"proxima"}',
    '{"intencao":"marcar_resultado","contato":string,"resultado":"ganho"|"perdido","valor"?:number}',
    '{"intencao":"atualizar_valor","contato":string,"valor":number}',
    '{"intencao":"atualizar_contato_info","contato":string,"telefone"?:string,"email"?:string}',
    '{"intencao":"concluir_tarefa","contato"?:string,"titulo"?:string}',
    '{"intencao":"gerar_mensagem","contato":string,"objetivo":"followup"|"visita"|"proposta"|"reativacao"|"pos_venda"} (mandar/preparar mensagem de WhatsApp para um contato)',
    '{"intencao":"consultar_avisos"}',
    '{"intencao":"ajuda","motivo"?:string}',
    "Regras rígidas:",
    "- Datas relativas (amanhã, sexta, dia 10) SEMPRE resolvem para o FUTURO, no formato YYYY-MM-DD; instantes em ISO com o mesmo offset do agora.",
    '- Funil: mover/avançar negócio de etapa = mudar_etapa ("avança" sem etapa dita = "proxima"); fechar/vender = marcar_resultado ganho; perder/cliente desistiu = marcar_resultado perdido.',
    "- Evento/lembrete sem hora explícita: use 09:00.",
    "- Valores monetários SEMPRE em CENTAVOS de real, inteiro (ex.: 850 mil reais = 85000000).",
    '- "origem" é o CANAL do lead (ex.: indicação, Instagram, portal); NUNCA o imóvel — omita se o pedido não citar o canal.',
    '- Se não tiver certeza da intenção, retorne intencao "ajuda".',
  ].join("\n");
}

/**
 * Interpreta `texto` com o LLM (Groq) e devolve um ComandoInterpretado
 * validado, ou null em QUALQUER falha (chave ausente, timeout — ~10s no total,
 * ~3s só para o 70b —, erro de rede/modelo, saída inconsistente). Nunca lança.
 */
export async function interpretarComLlm(
  texto: string,
  agoraISO: string,
): Promise<ComandoInterpretado | null> {
  if (!iaDisponivel()) return null;
  const system = montarSystem(agoraISO);
  const sinalTotal = AbortSignal.timeout(TIMEOUT_TOTAL_MS); // teto da cascata
  for (const modelo of modelosDaCascata()) {
    // O 70b tem teto próprio (curto) além do total; o scout usa só o total.
    const sinal = sinalDoModelo(modelo, sinalTotal);
    try {
      const { object } = await generateObject({
        model: groq(modelo),
        schema: SCHEMA_COMANDO,
        system,
        prompt: texto,
        maxRetries: 1,
        abortSignal: sinal,
        // Os llama da Groq não suportam response_format json_schema — usa
        // json_object (schema vai no system e a validação zod segue local).
        providerOptions: { groq: { structuredOutputs: false } },
      });
      const cmd = normalizar(object);
      // Guarda determinística (mesma heurística do core): "origem" só vale se
      // o corretor FALOU "origem" — modelos tendem a inventar esse campo.
      if (cmd?.intencao === "criar_negocio" && cmd.origem !== undefined && !/origem/i.test(texto)) {
        return {
          intencao: "criar_negocio",
          contato: cmd.contato,
          ...(cmd.valor !== undefined ? { valor: cmd.valor } : {}),
        };
      }
      return cmd;
    } catch {
      if (sinalTotal.aborted) return null; // estourou o orçamento total — não insiste
    }
  }
  return null;
}
