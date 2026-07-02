// Divisor — hairline fina editorial (MobIA "Claro & Editorial").
// Componente PURO de apresentação. Orientação horizontal (padrão) ou vertical.
// `dourado` aplica o tick/hairline em dourado (uso parcimonioso — detalhes).
// Decorativo: marcado com role="separator" + aria-orientation para leitores de tela.

type Props = {
  orientacao?: "horizontal" | "vertical";
  /** Hairline dourada em vez da neutra (detalhe premium). */
  dourado?: boolean;
  className?: string;
};

export function Divisor({
  orientacao = "horizontal",
  dourado = false,
  className = "",
}: Props) {
  const cor = dourado ? "bg-gold/60" : "bg-border";
  const dimensao =
    orientacao === "vertical" ? "h-full w-px self-stretch" : "h-px w-full";

  return (
    <div
      role="separator"
      aria-orientation={orientacao}
      className={`${dimensao} ${cor} ${className}`}
    />
  );
}
