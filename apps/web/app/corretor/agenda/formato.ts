// Helpers PUROS de apresentação da AGENDA (formatação de hora/dia e rótulos de
// tipo). Sem regra de negócio nem I/O — usados pelo Server Component da agenda
// e pelo chat client do assistente. pt-BR.
//
// CONVENÇÃO DE HORÁRIO (ver lib/fuso.ts): os timestamps são INSTANTES REAIS;
// o motor do assistente recebe o "agora" no frame de São Paulo e emite ISOs
// com esse offset, e o form manual monta o início com o mesmo offset. A hora
// é exibida com timeZone America/Sao_Paulo (mesmo frame do agrupamento por
// dia em lib/dados/agenda.ts). Já formatarDiaLongo recebe um DIA-CALENDÁRIO
// (YYYY-MM-DD, sem instante) — ancora em T00:00Z e formata em UTC só para
// rotular o dia sem deslocá-lo.

import type { TipoEventoAgenda } from "@imobia/domain";

const FMT_HORA = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

const FMT_DIA_LONGO = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

/** "2026-07-03T18:00:00.000Z" → "15:00" (parede de São Paulo). Inválido → "--:--". */
export function formatarHora(iso: string): string {
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? "--:--" : FMT_HORA.format(data);
}

/** "2026-07-04" → "sexta-feira, 4 de julho". Inválido → a própria string. */
export function formatarDiaLongo(dataISO: string): string {
  const data = new Date(`${dataISO}T00:00:00Z`);
  return Number.isNaN(data.getTime()) ? dataISO : FMT_DIA_LONGO.format(data);
}

/** Rótulos pt-BR dos tipos de evento da agenda. */
export const ROTULOS_TIPO_EVENTO: Record<TipoEventoAgenda, string> = {
  compromisso: "Compromisso",
  visita: "Visita",
  reuniao: "Reunião",
  lembrete: "Lembrete",
};
