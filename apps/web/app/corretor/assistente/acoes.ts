"use server";

// Ação do ASSISTENTE para o chat client. Fina camada sobre
// lib/dados/assistente.ts (interpretação pura + despacho) — este arquivo
// existe porque um módulo com "use server" no topo é o único importável por
// componentes client (o módulo de dados exporta tipos além de funções). pt-BR.

import {
  executarComandoAction,
  type RespostaAssistente,
} from "@/lib/dados/assistente";

/** Interpreta e executa um comando falado/digitado. Nunca lança. */
export async function executarComando(texto: string): Promise<RespostaAssistente> {
  return executarComandoAction(texto);
}
