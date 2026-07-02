// Rota /conta (Decisão 6 / ESCOPO §5). Área da conta do cliente: privacidade e
// consentimento de leads (LGPD). Server Component: exige cliente logado (senão
// CTA para /entrar). Corretor/gestor não usam esta tela — o consentimento é do
// cliente sobre o próprio comportamento.

import type { Metadata } from "next";
import Link from "next/link";
import { ControleConsentimento } from "@/components/ControleConsentimento";
import { obterSessao } from "@/lib/auth/sessao";
import { obterConsentimento } from "@/lib/dados/consentimento";

export const metadata: Metadata = { title: "Minha conta — MobIA" };

// Depende da sessão/RLS a cada request.
export const dynamic = "force-dynamic";

export default async function PaginaConta() {
  const sessao = await obterSessao();

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 px-6 py-10 font-sans dark:bg-black">
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Minha conta
          </h1>
          <p className="text-base text-zinc-600 dark:text-zinc-400">
            Suas preferências de privacidade e atendimento.
          </p>
        </header>

        {!sessao ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-20 text-center dark:border-zinc-700 dark:bg-zinc-950">
            <p className="text-lg font-medium text-zinc-700 dark:text-zinc-300">
              Entre para gerenciar sua conta
            </p>
            <p className="max-w-md text-sm text-zinc-500 dark:text-zinc-400">
              Faça login para ajustar suas preferências de privacidade.
            </p>
            <Link
              href="/entrar"
              className="mt-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Entrar
            </Link>
          </div>
        ) : (
          <ContaConteudo />
        )}
      </main>
    </div>
  );
}

async function ContaConteudo() {
  const consentimento = await obterConsentimento();

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Privacidade
      </h2>
      <ControleConsentimento inicial={consentimento} />
    </section>
  );
}
