// Configuração do Supabase (projeto "MobIA - Dev").
// Estes valores são PÚBLICOS por design: a URL e a chave *publishable* (role
// anon) já vão para o bundle do navegador. A proteção real dos dados é a RLS.
// Preferimos as variáveis de ambiente (NEXT_PUBLIC_*), mas mantemos um fallback
// embutido para que o deploy funcione mesmo sem env configurada na Vercel.

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://yxddovprxdquitqtdwbh.supabase.co";

export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_MbUFyxbuE6SU_sMW6gSlJA_hwYFjrUS";
