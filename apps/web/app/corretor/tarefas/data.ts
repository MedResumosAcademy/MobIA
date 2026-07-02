// Helpers puros de apresentação das TAREFAS (formatação de prazo). Sem regra de
// negócio nem I/O. Datas ISO (YYYY-MM-DD); pt-BR.

const FMT_DATA = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** "2026-07-10" → "10 de jul. de 2026"; null → "sem prazo". */
export function formatarVencimento(iso: string | null): string {
  if (!iso) {
    return "sem prazo";
  }
  const data = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(data.getTime())) {
    return "sem prazo";
  }
  return FMT_DATA.format(data);
}
