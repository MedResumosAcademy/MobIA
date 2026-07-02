// Badge de vitrine — pílula por categoria/tipo (paleta QUENTE laranja/âmbar).
// Componente PURO: sem regra de negócio, só apresentação.
// Variantes mapeiam os tokens de badge (globals.css):
//   destaque    = âmbar suave (selo premium — uso parcimonioso)
//   lancamento  = laranja suave · alto_padrao = âmbar suave · mcmv = laranja suave
//   neutro      = areia (tipo: casa/apartamento/terreno ou rótulos livres)
//   marca       = laranja sólido (contraste)
// Pílulas refinadas: tracking leve, hairline sutil, tipografia contida.

import type { ReactNode } from "react";

export type VarianteBadge =
  | "destaque"
  | "lancamento"
  | "alto_padrao"
  | "mcmv"
  | "neutro"
  | "marca";

const ESTILOS: Record<VarianteBadge, string> = {
  destaque: "bg-gold-soft text-gold-strong ring-1 ring-inset ring-gold/40",
  lancamento:
    "bg-badge-lancamento-bg text-badge-lancamento-fg ring-1 ring-inset ring-brand/15",
  alto_padrao:
    "bg-badge-alto-padrao-bg text-badge-alto-padrao-fg ring-1 ring-inset ring-gold/30",
  mcmv: "bg-badge-mcmv-bg text-badge-mcmv-fg ring-1 ring-inset ring-brand/15",
  neutro:
    "bg-badge-neutro-bg text-badge-neutro-fg ring-1 ring-inset ring-border-strong/60",
  marca: "bg-brand text-brand-contrast",
};

type Props = {
  children: ReactNode;
  variante?: VarianteBadge;
  className?: string;
};

export function Badge({ children, variante = "neutro", className = "" }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase leading-none tracking-[0.08em] ${ESTILOS[variante]} ${className}`}
    >
      {children}
    </span>
  );
}
