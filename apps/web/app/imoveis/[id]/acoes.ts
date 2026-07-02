// Server Actions da ficha do imóvel (E3/E7). Chamadas pelo SimuladorCompra
// (client) quando o cliente estabiliza a barra de entrada ou troca a
// modalidade — sinal de interesse "simulacao". Fire-and-forget: a UI não
// espera nem bloqueia. No-op para anônimo/corretor (registrarEvento decide).
"use server";

import type { Modalidade } from "@mobia/domain";
import { registrarEvento } from "@/lib/dados/eventos";

/**
 * Registra uma simulação interativa como EVENTO (E7). V1: só o evento —
 * NÃO grava snapshot na tabela `simulacoes`. `entrada`/`modalidade` são
 * capturados na assinatura para uso futuro (materialização de lead), mas hoje
 * só disparam o sinal de interesse no imóvel.
 */
export async function registrarSimulacaoAction(
  imovelId: string,
  _entrada: number,
  _modalidade: Modalidade,
): Promise<void> {
  try {
    await registrarEvento("simulacao", { imovelId });
  } catch {
    // Fire-and-forget: falha de captura de evento não pode quebrar a ficha.
  }
}
