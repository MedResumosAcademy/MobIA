// ESTADO VAZIO premium reutilizável — mesmo acabamento do catálogo público:
// ícone em círculo bg-brand-soft, título, frase de próximo passo e CTA
// opcional. Server-safe (sem hooks); o ícone chega pronto via ReactNode.
import Link from "next/link";
import type { ReactNode } from "react";

export function EstadoVazio({
  icone,
  titulo,
  descricao,
  cta,
  className = "",
}: {
  icone: ReactNode;
  titulo: string;
  descricao: string;
  cta?: { href: string; rotulo: string };
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-strong bg-surface-card px-6 py-12 text-center shadow-[var(--shadow-soft)] ${className}`}
    >
      <span
        className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand-strong"
        aria-hidden
      >
        {icone}
      </span>
      <p className="text-lg font-semibold tracking-tight text-foreground">
        {titulo}
      </p>
      <p className="max-w-sm text-sm leading-relaxed text-subtle">{descricao}</p>
      {cta && (
        <Link
          href={cta.href}
          className="mt-1 inline-flex items-center rounded-full border border-border-strong bg-surface-card px-4 py-2 text-sm font-medium text-brand-strong transition-colors hover:border-brand hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25"
        >
          {cta.rotulo}
        </Link>
      )}
    </div>
  );
}
