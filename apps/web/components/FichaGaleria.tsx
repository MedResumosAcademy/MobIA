"use client";

// Galeria de fotos da ficha (H-10) — mosaico editorial premium.
// Layout: 1 foto grande (esquerda) + grade de menores (direita) em telas largas;
// empilha no mobile. Cantos generosos, tratamento sutil (leve gradiente de base,
// zoom suave no hover). Lightbox acessível opcional (teclado: setas/Esc), sem
// dependências externas. Sem fotos → placeholder discreto.

/* eslint-disable @next/next/no-img-element */

import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export function FichaGaleria({ fotos, titulo }: { fotos: string[]; titulo: string }) {
  const [aberta, setAberta] = useState<number | null>(null);
  // Gestão de foco do lightbox (a11y): foco entra no botão Fechar ao abrir,
  // fica preso dentro do dialog (Tab/Shift+Tab) e volta à miniatura ao fechar.
  const dialogRef = useRef<HTMLDivElement>(null);
  const fecharRef = useRef<HTMLButtonElement>(null);
  const origemRef = useRef<HTMLElement | null>(null);
  const estavaAberta = useRef(false);

  const total = fotos.length;

  const fechar = useCallback(() => {
    setAberta(null);
    origemRef.current?.focus();
  }, []);
  const anterior = useCallback(
    () => setAberta((i) => (i === null ? i : (i - 1 + total) % total)),
    [total],
  );
  const proxima = useCallback(
    () => setAberta((i) => (i === null ? i : (i + 1) % total)),
    [total],
  );

  useEffect(() => {
    if (aberta === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") fechar();
      else if (e.key === "ArrowLeft") anterior();
      else if (e.key === "ArrowRight") proxima();
      else if (e.key === "Tab") {
        // Trap de foco: mantém Tab/Shift+Tab circulando dentro do dialog.
        const focaveis = dialogRef.current?.querySelectorAll<HTMLElement>("button");
        if (!focaveis || focaveis.length === 0) return;
        const primeiro = focaveis[0];
        const ultimo = focaveis[focaveis.length - 1];
        const ativo = document.activeElement;
        const dentro = ativo instanceof HTMLElement && dialogRef.current?.contains(ativo);
        if (e.shiftKey && (!dentro || ativo === primeiro)) {
          e.preventDefault();
          ultimo.focus();
        } else if (!e.shiftKey && (!dentro || ativo === ultimo)) {
          e.preventDefault();
          primeiro.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [aberta, fechar, anterior, proxima]);

  // Ao abrir (null -> índice), move o foco para dentro do dialog (botão Fechar).
  // Navegar entre fotos (índice -> índice) não rouba o foco dos botões de seta.
  useEffect(() => {
    const abertaAgora = aberta !== null;
    if (abertaAgora && !estavaAberta.current) {
      fecharRef.current?.focus();
    }
    estavaAberta.current = abertaAgora;
  }, [aberta]);

  if (total === 0) {
    return (
      <div className="flex aspect-[16/10] w-full items-center justify-center rounded-3xl border border-dashed border-border-strong bg-surface text-sm text-subtle">
        Sem fotos disponíveis
      </div>
    );
  }

  const capa = fotos[0];
  const secundarias = fotos.slice(1, 5); // até 4 miniaturas no mosaico
  const extras = total - 5; // fotos além das exibidas no mosaico

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        {/* Foto principal */}
        <button
          type="button"
          onClick={(e) => {
            origemRef.current = e.currentTarget;
            setAberta(0);
          }}
          className="group relative aspect-[4/3] w-full overflow-hidden rounded-3xl shadow-[var(--shadow-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-muted sm:aspect-auto"
          aria-label={`Ampliar foto principal — ${titulo}`}
        >
          <img
            src={capa}
            alt={`Foto principal — ${titulo}`}
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/15 to-transparent"
          />
          <span className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground shadow-[var(--shadow-soft)] backdrop-blur-sm">
            <Expand size={14} strokeWidth={1.8} aria-hidden="true" />
            {total} {total === 1 ? "foto" : "fotos"}
          </span>
        </button>

        {/* Grade de secundárias */}
        {secundarias.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {secundarias.map((url, i) => {
              const idx = i + 1;
              const ehUltima = i === secundarias.length - 1 && extras > 0;
              return (
                <button
                  key={url}
                  type="button"
                  onClick={(e) => {
                    origemRef.current = e.currentTarget;
                    setAberta(idx);
                  }}
                  className="group relative aspect-[4/3] w-full overflow-hidden rounded-2xl shadow-[var(--shadow-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-muted"
                  aria-label={`Ampliar foto ${idx + 1} — ${titulo}`}
                >
                  <img
                    src={url}
                    alt={`Foto ${idx + 1} — ${titulo}`}
                    className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                  />
                  {ehUltima && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-lg font-semibold text-white backdrop-blur-[1px]">
                      +{extras}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {aberta !== null && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={`Foto ${aberta + 1} de ${total} — ${titulo}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm sm:p-8"
          onClick={fechar}
        >
          <button
            ref={fecharRef}
            type="button"
            onClick={fechar}
            className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Fechar"
          >
            <X size={22} aria-hidden="true" />
          </button>

          {total > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  anterior();
                }}
                className="absolute left-3 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:left-6"
                aria-label="Foto anterior"
              >
                <ChevronLeft size={24} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  proxima();
                }}
                className="absolute right-3 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-6"
                aria-label="Próxima foto"
              >
                <ChevronRight size={24} aria-hidden="true" />
              </button>
            </>
          )}

          <img
            src={fotos[aberta]}
            alt={`Foto ${aberta + 1} — ${titulo}`}
            className="max-h-full max-w-full rounded-2xl object-contain shadow-[var(--shadow-premium)]"
            onClick={(e) => e.stopPropagation()}
          />

          <span className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white backdrop-blur-sm">
            {aberta + 1} / {total}
          </span>
        </div>
      )}
    </>
  );
}
