import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@imobia/domain";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

export async function criarClienteServidor() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesParaGravar) {
          try {
            cookiesParaGravar.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Chamado a partir de um Server Component (não pode gravar cookies).
            // O proxy.ts renova a sessão, então é seguro ignorar.
          }
        },
      },
    },
  );
}
