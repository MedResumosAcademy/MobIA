"use client";

// Arquivar/reativar funil (client folha) — com confirmação simples no clique.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { arquivarFunilAction } from "@/lib/dados/funis";

export function ArquivarFunil({ funilId, arquivado }: { funilId: string; arquivado: boolean }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  function executar() {
    if (!arquivado && !confirmando) {
      setConfirmando(true);
      return;
    }
    setErro(null);
    iniciar(async () => {
      const r = await arquivarFunilAction(funilId, !arquivado);
      setConfirmando(false);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      router.refresh();
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={executar}
        disabled={pendente}
        className="rounded-full border border-border-strong bg-surface-card px-3 py-1 text-xs font-medium text-muted transition-colors hover:text-foreground disabled:opacity-50"
      >
        {pendente
          ? "…"
          : arquivado
            ? "Reativar"
            : confirmando
              ? "Confirmar arquivar?"
              : "Arquivar"}
      </button>
      {erro !== null && (
        <span role="alert" className="text-xs font-medium text-red-700">
          {erro}
        </span>
      )}
    </span>
  );
}
