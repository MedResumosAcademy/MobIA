"use client";

// REDE DE SEGURANÇA global de erros de runtime (error boundary do App Router).
// Substitui a tela padrão do Next ("Application error", em inglês) por uma
// mensagem em pt-BR na identidade visual do app. `unstable_retry` re-busca e
// re-renderiza o segmento que falhou (recomendado pela doc do Next 16.2).

import { useEffect } from "react";
import Link from "next/link";

export default function ErroGlobal({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // Log local para diagnóstico — sem expor detalhes ao usuário.
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-20 font-sans">
      <main className="flex max-w-md flex-col items-center gap-4 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-subtle">
          Erro inesperado
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Algo deu errado
        </h1>
        <p className="text-muted">
          Não foi possível carregar esta página agora. Tente novamente em
          instantes.
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-brand-contrast transition-colors hover:bg-brand-hover"
          >
            Tentar novamente
          </button>
          <Link
            href="/"
            className="rounded-xl border border-border-strong bg-surface-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface"
          >
            Ir para a página inicial
          </Link>
        </div>
      </main>
    </div>
  );
}
