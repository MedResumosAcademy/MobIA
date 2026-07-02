// Botão consistente do kit MobIA — estilos de ação editoriais.
// Componente PURO de apresentação: aceita todos os atributos nativos de <button>.
// Para links com aparência de botão, use `classesBotao(...)` em um <Link>.
//   primario   = ação/marca (verde profundo sólido, sombra suave)
//   secundario = contorno neutro (areia)
//   premium    = CTA especial (dourado/champanhe) — uso parcimonioso
//   fantasma   = sem borda, hover suave
// Cantos generosos (rounded-full) e transições suaves; foco herda o ring verde.

import type { ButtonHTMLAttributes } from "react";

export type VarianteBotao = "primario" | "secundario" | "premium" | "fantasma";
export type TamanhoBotao = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-[background-color,box-shadow,color] duration-200 ease-out focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

const VARIANTES: Record<VarianteBotao, string> = {
  primario:
    "bg-brand text-brand-contrast shadow-[var(--shadow-soft)] hover:bg-brand-hover",
  secundario:
    "border border-border-strong bg-surface-card text-foreground hover:bg-surface",
  premium:
    "bg-gold text-gold-contrast shadow-[var(--shadow-soft)] hover:bg-gold-strong",
  fantasma: "text-muted hover:bg-surface hover:text-foreground",
};

const TAMANHOS: Record<TamanhoBotao, string> = {
  sm: "px-3.5 py-1.5 text-sm",
  md: "px-5 py-2 text-sm",
  lg: "px-6 py-2.5 text-base",
};

/** Monta a string de classes — útil para aplicar em <Link> ou <a>. */
export function classesBotao(
  variante: VarianteBotao = "primario",
  tamanho: TamanhoBotao = "md",
  extra = "",
): string {
  return `${BASE} ${VARIANTES[variante]} ${TAMANHOS[tamanho]} ${extra}`.trim();
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: VarianteBotao;
  tamanho?: TamanhoBotao;
};

export function Botao({
  variante = "primario",
  tamanho = "md",
  className = "",
  type = "button",
  ...props
}: Props) {
  return (
    // eslint-disable-next-line react/button-has-type
    <button type={type} className={classesBotao(variante, tamanho, className)} {...props} />
  );
}
