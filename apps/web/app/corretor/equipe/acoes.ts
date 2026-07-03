"use server";

// Ação de METAS do dashboard gerencial. Fina camada "use server" entre o editor
// client (EditorMetas) e lib/dados/metas.ts, que é server-side mas NÃO é
// "use server" (exporta tipos além de funções). O client não pode importar
// `definirMeta` direto — importaria um módulo com next/headers. Aqui expomos a
// Server Action e revalidamos o dashboard. org_id/definido_por vêm da SESSÃO
// (nunca do input); a autorização gestor/admin + RLS ficam em definirMeta.

import { revalidatePath } from "next/cache";
import type { TipoMeta } from "@imobia/domain";
import { definirMeta, type ResultadoDefinirMeta } from "@/lib/dados/metas";

/** Define (upsert) o alvo de uma meta e revalida o dashboard gerencial. */
export async function definirMetaAction(
  tipo: TipoMeta,
  alvo: number,
): Promise<ResultadoDefinirMeta> {
  const resultado = await definirMeta(tipo, alvo);
  if (resultado.ok) {
    revalidatePath("/corretor/equipe");
  }
  return resultado;
}
