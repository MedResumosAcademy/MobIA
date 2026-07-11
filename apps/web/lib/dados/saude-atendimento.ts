"use server";

// SAÚDE DO ATENDIMENTO — contadores honestos para a seção "Saúde" da tela de
// Conexão: mensagens de HOJE (dia-calendário de São Paulo — fuso na borda),
// conversas aguardando humano AGORA (fila Precisam) e a última mensagem
// recebida (webhook vivo?). Módulo "use server" (padrão gestor.ts); RLS
// escopa tudo pela org da sessão. 4 queries head/count — nada pesado.

import { obterSessao } from "@/lib/auth/sessao";
import { diaSaoPaulo, intervaloDoDiaSaoPaulo } from "@/lib/fuso";
import { criarClienteServidor } from "@/lib/supabase/server";

export type SaudeAtendimento = {
  /** Mensagens recebidas hoje (dia de São Paulo). */
  entradasHoje: number;
  /** Mensagens enviadas hoje (equipe + IA + campanhas). */
  saidasHoje: number;
  /** Conversas aguardando humano AGORA (fila Precisam — inclui escaladas). */
  aguardandoHumano: number;
  /** Instante da última mensagem recebida — null se nunca chegou nada. */
  ultimaEntradaEm: string | null;
};

/** Fotografia do dia para a org da sessão. Anônimo ⇒ null. */
export async function saudeDoAtendimento(): Promise<SaudeAtendimento | null> {
  const sessao = await obterSessao();
  if (!sessao) {
    return null;
  }
  const supabase = await criarClienteServidor();
  const { deISO, ateISO } = intervaloDoDiaSaoPaulo(diaSaoPaulo(new Date()));

  const [entradas, saidas, precisam, ultima] = await Promise.all([
    supabase
      .from("mensagens")
      .select("id", { count: "exact", head: true })
      .eq("direcao", "entrada")
      .gte("criado_em", deISO)
      .lte("criado_em", ateISO),
    supabase
      .from("mensagens")
      .select("id", { count: "exact", head: true })
      .eq("direcao", "saida")
      .gte("criado_em", deISO)
      .lte("criado_em", ateISO),
    supabase
      .from("contatos")
      .select("id", { count: "exact", head: true })
      .eq("atendimento", "humano")
      .gt("nao_lidas", 0),
    supabase
      .from("mensagens")
      .select("criado_em")
      .eq("direcao", "entrada")
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    entradasHoje: entradas.count ?? 0,
    saidasHoje: saidas.count ?? 0,
    aguardandoHumano: precisam.count ?? 0,
    ultimaEntradaEm: ultima.data?.criado_em ?? null,
  };
}
