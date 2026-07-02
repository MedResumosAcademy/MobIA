// Formatação de tempo relativo em pt-BR ("há 2 dias", "agora mesmo") para a
// timeline e a "última atividade" do painel de leads. PURA UI.

const DIVISORES: [limiteSegundos: number, unidade: Intl.RelativeTimeFormatUnit, emSegundos: number][] = [
  [60, "second", 1],
  [3600, "minute", 60],
  [86400, "hour", 3600],
  [604800, "day", 86400],
  [2629800, "week", 604800],
  [31557600, "month", 2629800],
  [Number.POSITIVE_INFINITY, "year", 31557600],
];

const FMT = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

/** ISO → "há 2 dias"; null/inválido → "—". `agora` injetável para testes. */
export function tempoRelativo(iso: string | null, agora: Date = new Date()): string {
  if (!iso) {
    return "—";
  }
  const data = new Date(iso);
  const delta = Math.round((data.getTime() - agora.getTime()) / 1000);
  if (!Number.isFinite(delta)) {
    return "—";
  }
  const abs = Math.abs(delta);
  if (abs < 30) {
    return "agora mesmo";
  }
  for (const [limite, unidade, emSegundos] of DIVISORES) {
    if (abs < limite) {
      return FMT.format(Math.round(delta / emSegundos), unidade);
    }
  }
  return "—";
}
