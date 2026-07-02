import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@mobia/domain";

export function criarClienteNavegador() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
