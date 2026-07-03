// FUSO DO PRODUTO — America/Sao_Paulo. Helpers PUROS (sem IO; o instante é
// sempre recebido por parâmetro, exceto o atalho agoraSaoPauloISO) usados por
// Server Components, Server Actions e componentes client.
//
// CONVENÇÃO DE HORÁRIO (única do app): timestamps são INSTANTES REAIS
// (timestamptz no banco); a parede brasileira entra/sai pela borda:
//   - ESCRITA: ISOs montados com o offset de America/Sao_Paulo (ex.:
//     "2026-07-03T15:00:00-03:00") — assistente (agora injetado) e form manual.
//   - LEITURA: hora/dia exibidos e agrupados com timeZone America/Sao_Paulo.
// O offset é calculado por Intl (não hardcoded) para sobreviver a uma eventual
// volta do horário de verão. pt-BR; datas ISO.

const FUSO_PRODUTO = "America/Sao_Paulo";

const FMT_OFFSET = new Intl.DateTimeFormat("en-US", {
  timeZone: FUSO_PRODUTO,
  timeZoneName: "longOffset",
});

const FMT_PARTES = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO_PRODUTO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** Offset de São Paulo no instante dado: "GMT-03:00" ⇒ "-03:00". */
export function offsetSaoPaulo(instante: Date): string {
  const nome =
    FMT_OFFSET.formatToParts(instante).find((p) => p.type === "timeZoneName")?.value ?? "";
  const offset = nome.startsWith("GMT") ? nome.slice(3) : "";
  return /^[+-]\d{2}:\d{2}$/.test(offset) ? offset : "-03:00";
}

/** O instante como ISO no relógio de São Paulo: "2026-07-03T15:00:00-03:00". */
export function isoSaoPaulo(instante: Date): string {
  const p: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};
  for (const parte of FMT_PARTES.formatToParts(instante)) {
    p[parte.type] = parte.value;
  }
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${offsetSaoPaulo(instante)}`;
}

/** "Agora" no frame do produto — é ISTO que se injeta no motor do assistente. */
export function agoraSaoPauloISO(): string {
  return isoSaoPaulo(new Date());
}

/** Dia (YYYY-MM-DD) de um instante no relógio de São Paulo. Inválido ⇒ "". */
export function diaSaoPaulo(instante: Date | string): string {
  const d = typeof instante === "string" ? new Date(instante) : instante;
  return Number.isNaN(d.getTime()) ? "" : isoSaoPaulo(d).slice(0, 10);
}

/** Limites INSTANTES de um dia-calendário de São Paulo (para filtros gte/lte). */
export function intervaloDoDiaSaoPaulo(diaISO: string): { deISO: string; ateISO: string } {
  // Offset avaliado ao meio-dia UTC do próprio dia (imune a virada de offset).
  const offset = offsetSaoPaulo(new Date(`${diaISO}T12:00:00Z`));
  return {
    deISO: `${diaISO}T00:00:00.000${offset}`,
    ateISO: `${diaISO}T23:59:59.999${offset}`,
  };
}

/** Monta o instante de uma data+hora de PAREDE de São Paulo ("2026-07-03", "15:00"). */
export function instanteDeParedeSaoPaulo(diaISO: string, horaHM: string): string {
  const offset = offsetSaoPaulo(new Date(`${diaISO}T12:00:00Z`));
  return `${diaISO}T${horaHM}:00.000${offset}`;
}
