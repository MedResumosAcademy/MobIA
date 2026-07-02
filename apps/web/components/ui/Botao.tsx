// Botão consistente do kit MobIA — estilos de ação padronizados.
// Componente PURO de apresentação: aceita todos os atributos nativos de <button>.
// Para links com aparência de botão, use `classesBotao(...)` em um <Link>.
//   primario  = ação/marca (emerald)
//   secundario = borda neutra (slate)
//   fantasma   = sem borda, hover suave

import type { ButtonHTMLAttributes } from "react";

export type VarianteBotao = "primario" | "secundario" | "fantasma";
export type TamanhoBotao = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

const VARIANTES: Record<VarianteBotao, string> = {
  primario: "bg-brand text-brand-contrast hover:bg-brand-hover",
  secundario:
    "border border-border-strong bg-surface text-foreground hover:bg-surface-muted",
  fantasma: "text-muted hover:bg-surface-muted hover:text-foreground",
};

const TAMANHOS: Record<TamanhoBotao, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-base",
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
