import type { Metadata } from "next";
import Link from "next/link";
import { entrar } from "@/lib/auth/acoes";

export const metadata: Metadata = { title: "Entrar — MobIA" };

const MENSAGENS_ERRO: Record<string, string> = {
  "campos-obrigatorios": "Preencha e-mail e senha.",
  "credenciais-invalidas": "E-mail ou senha incorretos.",
  "email-nao-confirmado": "Confirme seu e-mail antes de entrar.",
  "erro-inesperado": "Não foi possível entrar agora. Tente novamente em instantes.",
};

const MENSAGENS_AVISO: Record<string, string> = {
  "confirme-email": "Conta criada! Confira seu e-mail para confirmar o cadastro.",
};

export default async function PaginaEntrar({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; aviso?: string }>;
}) {
  const { erro, aviso } = await searchParams;
  const mensagemErro = erro ? (MENSAGENS_ERRO[erro] ?? MENSAGENS_ERRO["erro-inesperado"]) : null;
  const mensagemAviso = aviso ? MENSAGENS_AVISO[aviso] : null;

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16 font-sans dark:bg-black">
      <main className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Entrar
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Acesse sua conta para montar sua compra.
        </p>

        {mensagemAviso && (
          <p
            role="status"
            className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
          >
            {mensagemAviso}
          </p>
        )}
        {mensagemErro && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          >
            {mensagemErro}
          </p>
        )}

        <form action={entrar} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            E-mail
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="voce@exemplo.com"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Senha
            <input
              type="password"
              name="senha"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>
          <button
            type="submit"
            className="mt-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Entrar
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
          Ainda não tem conta?{" "}
          <Link
            href="/cadastro"
            className="font-medium text-zinc-950 underline underline-offset-4 dark:text-zinc-50"
          >
            Cadastre-se
          </Link>
        </p>
      </main>
    </div>
  );
}
