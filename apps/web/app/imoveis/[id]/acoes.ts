// Server Actions da ficha do imóvel (E3/E7). Chamadas pelo SimuladorCompra
// (client) quando o cliente estabiliza a barra de entrada ou troca a
// modalidade — sinal de interesse "simulacao". Fire-and-forget: a UI não
// espera nem bloqueia. No-op para anônimo/corretor (registrarEvento decide).
"use server";

import type { Modalidade } from "@mobia/domain";
import { registrarEvento } from "@/lib/dados/eventos";

/**
 * Registra uma simulação interativa como EVENTO (E7). V1: só o evento —
 * NÃO grava snapshot na tabela `simulacoes`. A `entrada` (centavos) vai na
 * metadata do evento para a timeline do corretor exibir "Simulou entrada de
 * R$ X"; `modalidade` é capturada para uso futuro.
 */
export async function registrarSimulacaoAction(
  imovelId: string,
  entrada: number,
  _modalidade: Modalidade,
): Promise<void> {
  try {
    await registrarEvento("simulacao", { imovelId, metadata: { entrada } });
  } catch {
    // Fire-and-forget: falha de captura de evento não pode quebrar a ficha.
  }
}

/**
 * Registra um clique em "financiamento" como EVENTO (E7) — a ação de MAIOR
 * intenção (o termômetro força 'pronto_para_compra'). Pronta para a ficha ligar
 * a um botão de financiamento quando existir; hoje disponível para uso.
 * Fire-and-forget, no-op para anônimo/corretor (registrarEvento decide).
 */
export async function registrarCliqueFinanciamentoAction(
  imovelId: string,
): Promise<void> {
  try {
    await registrarEvento("clique_financiamento", { imovelId });
  } catch {
    // Fire-and-forget: falha de captura de evento não pode quebrar a ficha.
  }
}
