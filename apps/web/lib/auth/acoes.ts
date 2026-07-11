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

// Formato do código de convite (emitir_convite 0033): 64 hex minúsculos.
// Qualquer outra coisa é descartada — nada arbitrário entra no metadata.
const CONVITE_RE = /^[a-f0-9]{64}$/;

export async function cadastrar(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");
  // Convite de equipe (opcional): chega pelo link /cadastro?convite=… e vai
  // no metadata `convite_token` — handle_new_user (0004) valida e-mail+token
  // e promove a corretor/gestor da org; sem convite, nasce 'cliente'.
  const conviteBruto = String(formData.get("convite") ?? "").trim().toLowerCase();
  const convite = CONVITE_RE.test(conviteBruto) ? conviteBruto : "";
  const sufixoConvite = convite === "" ? "" : `&convite=${convite}`;
  if (!email || !senha) {
    redirect(`/cadastro?erro=campos-obrigatorios${sufixoConvite}`);
  }
  // Mínimo 8 (segurança): alinhado à config do Supabase Auth (senha mínima 8
  // + leaked password protection) — corretores acessam PII de leads.
  if (senha.length < 8) {
    redirect(`/cadastro?erro=senha-curta${sufixoConvite}`);
  }

  const supabase = await criarClienteServidor();
  // Cadastro público SEMPRE nasce como 'cliente' — papéis de gestão são
  // atribuídos por convite assinado (handle_new_user ignora `papel` do
  // metadata; H-04: cliente nunca acessa telas de gestão).
  const { data, error } = await supabase.auth.signUp({
    email,
    password: senha,
    options: {
      data: {
        papel: "cliente",
        ...(convite !== "" ? { convite_token: convite } : {}),
      },
    },
  });
  if (error) {
    const codigo =
      error.code === "user_already_exists" || error.code === "email_exists"
        ? "email-ja-cadastrado"
        : error.code === "weak_password"
          ? "senha-fraca"
          : "erro-inesperado";
    redirect(`/cadastro?erro=${codigo}${sufixoConvite}`);
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
