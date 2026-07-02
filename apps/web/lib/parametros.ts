import { obterParametrosAtuais } from "@mobia/core";
import { parametrosFinanceirosSchema, type ParametrosFinanceiros } from "@mobia/domain";
import { criarClienteServidor } from "@/lib/supabase/server";

// Teto de espera pela leitura do banco. Com o backend fora do ar, um fetch sem
// timeout só falha quando o DNS/conexão estoura (7–10s observados), bloqueando
// TODA renderização da home. Com o AbortSignal abaixo caímos no seed em ~2,5s.
const TIMEOUT_MS = 2500;
// Memoiza a falha por alguns segundos para não pagar o timeout a cada request
// enquanto o backend estiver indisponível.
const MEMO_FALHA_MS = 10_000;
let falhaAte = 0;

/**
 * Parâmetros financeiros vigentes lidos de public.parametros_financeiros
 * (H-05: atualizar regras sem deploy). QUALQUER falha — tabela ausente,
 * jsonb inválido, nenhum snapshot vigente, timeout — cai no seed embarcado do
 * core rapidamente (sem bloquear a renderização por vários segundos).
 */
export async function obterParametrosVigentesDoBanco(): Promise<ParametrosFinanceiros> {
  // Falha recente: pula direto para o seed, sem repagar o timeout.
  if (Date.now() < falhaAte) {
    return obterParametrosAtuais();
  }
  try {
    const hoje = new Date().toISOString().slice(0, 10);
    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("parametros_financeiros")
      .select("dados")
      .lte("vigencia_inicio", hoje)
      .order("versao", { ascending: false })
      .limit(1)
      .abortSignal(AbortSignal.timeout(TIMEOUT_MS))
      .maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      throw new Error("nenhum snapshot vigente em parametros_financeiros");
    }
    return parametrosFinanceirosSchema.parse(data.dados);
  } catch (erro) {
    falhaAte = Date.now() + MEMO_FALHA_MS;
    console.warn(
      "parametros_financeiros indisponível — usando seed embarcado do @mobia/core:",
      erro instanceof Error ? erro.message : erro,
    );
    return obterParametrosAtuais();
  }
}
