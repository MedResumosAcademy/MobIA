"use server";

import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";

export async function entrar(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");
  if (!email || !senha) {
    redirect("/entrar?erro=campos-obrigatorios");
  }

  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) {
    const codigo =
      error.code === "invalid_credentials"
        ? "credenciais-invalidas"
        : error.code === "email_not_confirmed"
          ? "email-nao-confirmado"
          : "erro-inesperado";
    redirect(`/entrar?erro=${codigo}`);
  }

  redirect("/");
}

export async function cadastrar(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");
  if (!email || !senha) {
    redirect("/cadastro?erro=campos-obrigatorios");
  }
  // Mínimo 8 (segurança): alinhado à config do Supabase Auth (senha mínima 8
  // + leaked password protection) — corretores acessam PII de leads.
  if (senha.length < 8) {
    redirect("/cadastro?erro=senha-curta");
  }

  const supabase = await criarClienteServidor();
  // Cadastro público SEMPRE nasce como 'cliente' — papéis de gestão são
  // atribuídos por um admin (H-04: cliente nunca acessa telas de gestão).
  const { data, error } = await supabase.auth.signUp({
    email,
    password: senha,
    options: { data: { papel: "cliente" } },
  });
  if (error) {
    const codigo =
      error.code === "user_already_exists" || error.code === "email_exists"
        ? "email-ja-cadastrado"
        : error.code === "weak_password"
          ? "senha-fraca"
          : "erro-inesperado";
    redirect(`/cadastro?erro=${codigo}`);
  }

  if (!data.session) {
    redirect("/entrar?aviso=confirme-email");
  }
  redirect("/");
}

export async function sair() {
  const supabase = await criarClienteServidor();
  await supabase.auth.signOut();
  redirect("/entrar");
}
