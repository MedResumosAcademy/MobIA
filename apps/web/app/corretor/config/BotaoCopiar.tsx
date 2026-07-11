"use client";

// Botão "copiar" reutilizável da central — copia `valor` para a área de
// transferência com feedback efêmero ("Copiado!"). Client FOLHA, sem estado
// no server. Usado para endpoint, tokens, segredos e links de convite.

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function BotaoCopiar({
  valor,
  rotulo = "Copiar",
  className = "",
}: {
  valor: string;
  /** Rótulo acessível/visível do botão (ex.: "Copiar token"). */
  rotulo?: string;
  className?: string;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // silencioso: sem clipboard disponível (http antigo/permissão negada)
    }
  }

  return (
    <button
      type="button"
      onClick={copiar}
      aria-label={rotulo}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border-strong bg-surface-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-brand/40 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25 ${className}`}
    >
      {copiado ? (
        <>
          <Check className="h-3.5 w-3.5 text-brand-strong" aria-hidden />
          Copiado!
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" aria-hidden />
          {rotulo}
        </>
      )}
    </button>
  );
}
