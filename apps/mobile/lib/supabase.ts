// Cliente Supabase do app mobile (H-04: autenticação mínima).
// A sessão é persistida em AsyncStorage; detectSessionInUrl fica desligado
// porque não há URL de redirect em app nativo.

import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const chavePublicavel = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !chavePublicavel) {
  throw new Error(
    "Configuração do Supabase ausente: defina EXPO_PUBLIC_SUPABASE_URL e " +
      "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY em apps/mobile/.env (veja .env.example)."
  );
}

export const supabase = createClient(url, chavePublicavel, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
