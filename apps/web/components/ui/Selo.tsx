// Selo — pílula sobreposta em imagens (overlay de card/ficha), MobIA editorial.
// Diferente do Badge (inline no corpo), o Selo é pensado para POUSAR sobre fotos:
// fundo levemente translúcido + backdrop-blur para legibilidade sobre qualquer
// imagem, com sombra suave. Ideal para o selo "Destaque" no topo do card.
//   destaque = âmbar (premium) · marca = laranja · neutro = off-white
// Uso parcimonioso do âmbar — reservado a chamadas especiais.

import type { ReactNode } from "react";

export type VarianteSelo = "destaque" | "marca" | "neutro";

const ESTILOS: Record<VarianteSelo, string> = {
  destaque: "bg-gold text-foreground",
  marca: "bg-brand/95 text-brand-contrast",
  neutro: "bg-background/90 text-foreground ring-1 ring-inset ring-border-strong/50",
};

type Props = {
  children: ReactNode;
  variante?: VarianteSelo;
  className?: string;
};

export function Selo({ children, variante = "destaque", className = "" }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold uppercase leading-none tracking-[0.1em] shadow-[var(--shadow-soft)] backdrop-blur-sm ${ESTILOS[variante]} ${className}`}
    >
      {children}
    </span>
  );
}
