// Banner discreto de consentimento (LGPD / Decisão 6). Aparece em pontos de
// intenção (ex.: topo de /favoritos) apenas para clientes LOGADOS que ainda NÃO
// decidiram (obterConsentimento() === null). NÃO é intrusivo e NÃO bloqueia o
// uso: oferece Ativar (inline) ou o link "Minha conta". Some ao ativar ou ao
// dispensar (localmente, nesta sessão de navegação).
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { definirConsentimento } from "@/lib/dados/consentimento";

export function BannerConsentimento() {
  const router = useRouter();
  const [oculto, setOculto] = useState(false);
  const [pendente, iniciar] = useTransition();

  if (oculto) {
    return null;
  }

  function ativar() {
    iniciar(async () => {
      try {
        await definirConsentimento(true);
        setOculto(true);
        router.refresh();
      } catch {
        // silencioso: mantém o banner para nova tentativa
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold/30 bg-surface-strong px-4 py-3">
      <p className="max-w-2xl text-sm text-muted">
        Quer atendimento personalizado? Ative para que corretores dos imóveis que você favoritar ou
        simular possam ver seu interesse e falar com você. Opcional e reversível.
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={ativar}
          disabled={pendente}
          className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-brand-contrast transition-colors hover:bg-brand-hover disabled:opacity-60"
        >
          {pendente ? "Ativando…" : "Ativar"}
        </button>
        <Link
          href="/conta"
          className="text-sm font-medium text-brand-strong underline underline-offset-2"
        >
          Saiba mais
        </Link>
        <button
          type="button"
          onClick={() => setOculto(true)}
          aria-label="Dispensar"
          className="text-sm text-subtle"
        >
          Agora não
        </button>
      </div>
    </div>
  );
}
