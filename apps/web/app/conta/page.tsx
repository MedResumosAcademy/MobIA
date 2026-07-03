// Rota /conta (Decisão 6 / ESCOPO §5). Área da conta do cliente: privacidade e
// consentimento de leads (LGPD). Server Component: exige cliente logado (senão
// CTA para /entrar). Corretor/gestor não usam esta tela — o consentimento é do
// cliente sobre o próprio comportamento.

import type { Metadata } from "next";
import Link from "next/link";
import { ControleConsentimento } from "@/components/ControleConsentimento";
import { ControleTelefone } from "@/components/ControleTelefone";
import { classesBotao } from "@/components/ui/Botao";
import { obterSessao } from "@/lib/auth/sessao";
import { obterConsentimento, obterMeuTelefone } from "@/lib/dados/consentimento";

export const metadata: Metadata = { title: "Minha conta — ImobIA" };

// Depende da sessão/RLS a cada request.
export const dynamic = "force-dynamic";

export default async function PaginaConta() {
  const sessao = await obterSessao();

  return (
    <div className="flex flex-1 flex-col bg-background px-6 py-12 font-sans">
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground">
            Minha conta
          </h1>
          <p className="text-base leading-relaxed text-muted">
            Suas preferências de privacidade e atendimento.
          </p>
        </header>

        {!sessao ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-strong bg-surface-card px-6 py-20 text-center shadow-soft">
            <p className="text-lg font-semibold text-foreground">
              Entre para gerenciar sua conta
            </p>
            <p className="max-w-md text-sm text-muted">
              Faça login para ajustar suas preferências de privacidade.
            </p>
            <Link href="/entrar" className={classesBotao("primario", "md", "mt-2")}>
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
  const [consentimento, telefone] = await Promise.all([
    obterConsentimento(),
    obterMeuTelefone(),
  ]);

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-subtle">
        Privacidade
      </h2>
      <ControleConsentimento inicial={consentimento} />
      <ControleTelefone inicial={telefone} />
    </section>
  );
}
