// CONFIRMAÇÃO de inscrição na newsletter (double opt-in — migração 0023).
// Página PÚBLICA: quem chega aqui clicou no link do e-mail de confirmação
// (/newsletter/confirmar?token=<uuid>). Chama a RPC newsletter_confirmar via
// action e mostra sucesso ou um erro GENÉRICO — token inválido, já usado ou
// inscrição cancelada têm a MESMA mensagem (não enumerar inscritos).

import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { confirmarInscricaoAction } from "@/lib/dados/newsletter";

export const metadata: Metadata = { title: "Confirmar inscrição" };

export default async function PaginaConfirmarNewsletter({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const confirmado = token ? await confirmarInscricaoAction(token) : false;

  return (
    <div className="flex flex-1 items-center justify-center bg-background px-6 py-16 font-sans">
      <main className="w-full max-w-sm rounded-2xl border border-border bg-surface-card p-8 text-center shadow-[var(--shadow-soft)]">
        {confirmado ? (
          <>
            <CheckCircle2
              size={40}
              strokeWidth={2}
              aria-hidden="true"
              className="mx-auto text-brand-strong"
            />
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
              Inscrição confirmada!
            </h1>
            <p className="mt-2 text-sm text-muted">
              Obrigado por confirmar. As melhores oportunidades vão chegar no
              seu e-mail — e você pode cancelar quando quiser.
            </p>
          </>
        ) : (
          <>
            <XCircle
              size={40}
              strokeWidth={2}
              aria-hidden="true"
              className="mx-auto text-muted"
            />
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
              Link inválido ou já utilizado
            </h1>
            <p className="mt-2 text-sm text-muted">
              Este link de confirmação não é mais válido. Se você ainda quiser
              receber as novidades, faça uma nova inscrição no site.
            </p>
          </>
        )}
        <p className="mt-6 text-sm">
          <Link
            href="/"
            className="font-medium text-brand-strong underline underline-offset-4 hover:text-brand"
          >
            Voltar para o início
          </Link>
        </p>
      </main>
    </div>
  );
}
