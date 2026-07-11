"use client";

// Seletor de MODO (dois estados nomeados, ex.: Teste/Produção) — mais honesto
// que um switch on/off: cada opção tem nome e descrição do que acontece.
// role=radiogroup com botões role=radio (aria-checked) para a11y.

import type { ReactNode } from "react";

export type OpcaoModo<V extends string> = {
  valor: V;
  rotulo: string;
  descricao: string;
  icone?: ReactNode;
  desabilitada?: boolean;
};

export function SeletorModo<V extends string>({
  legenda,
  opcoes,
  valor,
  aoMudar,
  disabled = false,
}: {
  /** Rótulo acessível do grupo (ex.: "Modo de envio do WhatsApp"). */
  legenda: string;
  opcoes: OpcaoModo<V>[];
  valor: V;
  aoMudar: (v: V) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={legenda} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {opcoes.map((o) => {
        const ativo = o.valor === valor;
        const travada = disabled || o.desabilitada === true;
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={ativo}
            disabled={travada}
            onClick={() => aoMudar(o.valor)}
            className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25 disabled:cursor-not-allowed disabled:opacity-50 ${
              ativo
                ? "border-brand bg-brand-soft"
                : "border-border bg-surface hover:border-brand/40"
            }`}
          >
            <span
              aria-hidden
              className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                ativo ? "border-brand" : "border-border-strong"
              }`}
            >
              {ativo && <span className="h-2 w-2 rounded-full bg-brand" />}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                {o.icone}
                {o.rotulo}
              </span>
              <span className="text-xs leading-relaxed text-subtle">{o.descricao}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
