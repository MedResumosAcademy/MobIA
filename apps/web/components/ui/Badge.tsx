// Badge de vitrine — pílula por categoria/tipo (padrão portal imobiliário).
// Componente PURO: sem regra de negócio, só apresentação.
// Variantes de categoria mapeiam a paleta MobIA (tokens em globals.css):
//   lancamento = sky · alto_padrao = amber/dourado · mcmv = emerald.
// Use `variante="neutro"` para tipo (casa/apartamento/terreno) ou rótulos livres.

import type { ReactNode } from "react";

export type VarianteBadge =
  | "lancamento"
  | "alto_padrao"
  | "mcmv"
  | "neutro"
  | "marca";

const ESTILOS: Record<VarianteBadge, string> = {
  lancamento: "bg-badge-lancamento-bg text-badge-lancamento-fg",
  alto_padrao: "bg-badge-alto-padrao-bg text-badge-alto-padrao-fg",
  mcmv: "bg-badge-mcmv-bg text-badge-mcmv-fg",
  neutro: "bg-badge-neutro-bg text-badge-neutro-fg",
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
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold leading-none ${ESTILOS[variante]} ${className}`}
    >
      {children}
    </span>
  );
}
