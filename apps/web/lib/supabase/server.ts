import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@mobia/domain";

export async function criarClienteServidor() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
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
