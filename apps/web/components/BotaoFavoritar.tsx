"use client";

// Coração de favoritar (E6 / H-19). Toggle com estado OTIMISTA: reflete a
// intenção na hora e reverte se a action falhar. Se o usuário está anônimo, a
// action devolve { ok:false, motivo:"precisa_login" } — mostramos um CTA para
// /entrar em vez de quebrar. `variante` só ajusta tamanho/posição (card vs ficha).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { alternarFavoritoAction } from "@/app/favoritos/acoes";

type Props = {
  imovelId: string;
  inicialFavoritado: boolean;
  variante?: "card" | "ficha";
  /** Ao remover na própria página /favoritos, recarrega para sumir o card. */
  atualizarAoAlternar?: boolean;
};

export function BotaoFavoritar({
  imovelId,
  inicialFavoritado,
  variante = "card",
  atualizarAoAlternar = false,
}: Props) {
  const router = useRouter();
  const [favoritado, setFavoritado] = useState(inicialFavoritado);
  const [precisaLogin, setPrecisaLogin] = useState(false);
  const [, iniciar] = useTransition();

  function alternar() {
    const proximo = !favoritado;
    setFavoritado(proximo); // otimista
    iniciar(async () => {
      const r = await alternarFavoritoAction(imovelId);
      if (!r.ok) {
        setFavoritado(!proximo); // reverte
        setPrecisaLogin(true);
        return;
      }
      setFavoritado(r.favoritado);
      if (atualizarAoAlternar) {
        router.refresh();
      }
    });
  }

  const naFicha = variante === "ficha";

  return (
    <div className={naFicha ? "relative inline-flex" : "absolute right-3 top-3"}>
      <button
        type="button"
        onClick={alternar}
        aria-pressed={favoritado}
        aria-label={favoritado ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        title={favoritado ? "Remover dos favoritos" : "Favoritar"}
        className={
          naFicha
            ? "inline-flex items-center gap-2 rounded-lg border border-border-strong bg-surface-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-surface"
            : "inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface-card/90 text-muted shadow-sm backdrop-blur transition-colors hover:text-brand"
        }
      >
        <svg
          width={naFicha ? "18" : "20"}
          height={naFicha ? "18" : "20"}
          viewBox="0 0 24 24"
          fill={favoritado ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={favoritado ? "text-brand" : ""}
        >
          <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
        </svg>
        {naFicha && <span>{favoritado ? "Favoritado" : "Favoritar"}</span>}
      </button>

      {precisaLogin && (
        <div
          className={
            naFicha
              ? "absolute left-0 top-full z-10 mt-2 w-56 rounded-xl border border-border bg-surface-card p-3 text-xs shadow-[var(--shadow-card)]"
              : "absolute right-0 top-full z-10 mt-2 w-56 rounded-xl border border-border bg-surface-card p-3 text-xs shadow-[var(--shadow-card)]"
          }
          role="dialog"
        >
          <p className="text-muted">
            Entre na sua conta para salvar imóveis nos favoritos.
          </p>
          <div className="mt-2 flex items-center gap-3">
            <Link
              href="/entrar"
              className="font-medium text-brand underline"
            >
              Entrar
            </Link>
            <button
              type="button"
              onClick={() => setPrecisaLogin(false)}
              className="text-subtle"
            >
              Agora não
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
