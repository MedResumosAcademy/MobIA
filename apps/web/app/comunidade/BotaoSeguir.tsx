"use client";

// BotaoSeguir — alterna seguir/deixar de seguir um perfil na Comunidade.
// Recebe o perfilId alvo + o estado inicial `seguindo`. Ao clicar, chama a
// Server Action correspondente e dá router.refresh() para reconciliar o servidor.
// Atualização otimista local (rótulo/estilo) para resposta instantânea; se a
// action falhar, reverte. Não trava a UI (usa transition).

import { useState, useTransition } from "react";
import { Check, UserPlus } from "lucide-react";
import { seguirAction, deixarDeSeguirAction } from "./acoes";
import { useRouter } from "next/navigation";

type Props = {
  perfilId: string;
  seguindo: boolean;
  /** Compacto para listas densas (ranking). */
  tamanho?: "sm" | "md";
  className?: string;
};

export function BotaoSeguir({ perfilId, seguindo, tamanho = "sm", className = "" }: Props) {
  const router = useRouter();
  const [ativo, setAtivo] = useState(seguindo);
  const [pendente, iniciar] = useTransition();

  function alternar() {
    const proximo = !ativo;
    setAtivo(proximo); // otimista
    iniciar(async () => {
      const res = proximo
        ? await seguirAction(perfilId)
        : await deixarDeSeguirAction(perfilId);
      if (!res.ok) {
        setAtivo(!proximo); // reverte
        return;
      }
      router.refresh();
    });
  }

  const dims = tamanho === "sm" ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-sm";
  const base =
    "inline-flex items-center gap-1.5 rounded-full font-semibold transition-[background-color,border-color,color] duration-200 focus-visible:outline-none disabled:opacity-60";
  const estilo = ativo
    ? "border border-border-strong bg-surface-card text-muted hover:border-brand/40 hover:text-foreground"
    : "border border-brand bg-brand-soft text-brand-strong hover:bg-brand hover:text-brand-contrast";

  return (
    <button
      type="button"
      onClick={alternar}
      disabled={pendente}
      aria-pressed={ativo}
      className={`${base} ${dims} ${estilo} ${className}`.trim()}
    >
      {ativo ? (
        <>
          <Check size={13} aria-hidden="true" />
          Seguindo
        </>
      ) : (
        <>
          <UserPlus size={13} aria-hidden="true" />
          Seguir
        </>
      )}
    </button>
  );
}
