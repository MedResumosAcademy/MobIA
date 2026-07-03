import { createServerClient } from "@supabase/ssr";
import type { Database } from "@imobia/domain";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

/**
 * Client de LEITURA PÚBLICA, sem cookies/sessão — para o catálogo anônimo
 * renderizar via SSR. Usa a chave publishable (role anon), então a RLS
 * continua valendo: só enxerga imóveis com status='disponivel'.
 * Não persiste nem lê sessão (getAll/setAll no-op).
 */
export function criarClientePublico() {
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {},
    },
  });
}
