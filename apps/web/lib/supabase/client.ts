import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@imobia/domain";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

export function criarClienteNavegador() {
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
}
