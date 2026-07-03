// Apresentação do NÍVEL DE ATENÇÃO ("parado há X dias") do funil. PURA UI: o
// nível (ok/atencao/parado) e os dias vêm do motor puro (@imobia/core) via
// lib/dados/negocios.ts. Aqui só traduzimos em um selo colorido, reutilizado
// pelo Kanban e pela Lista.
//   atencao = âmbar/gold-soft (7..13 dias sem movimento)
//   parado  = vermelho/laranja forte da marca (>=14 dias)

import type { NivelAtencao } from "@imobia/domain";

const ESTILOS: Record<Exclude<NivelAtencao, "ok">, string> = {
  atencao: "border-gold/40 bg-gold-soft text-gold-strong",
  parado: "border-brand/40 bg-brand-soft text-brand-strong",
};

/** Texto pt-BR do selo conforme os dias sem movimento. */
function rotulo(dias: number): string {
  if (dias <= 0) {
    return "Parado hoje";
  }
  if (dias === 1) {
    return "Parado há 1 dia";
  }
  return `Parado há ${dias} dias`;
}

/**
 * Selo "parado há X dias" — só aparece quando atencao != "ok". Cor por nível.
 * Retorna null para "ok" (negócio com movimento recente).
 */
export function SeloAtencao({
  atencao,
  dias,
}: {
  atencao: NivelAtencao;
  dias: number;
}) {
  if (atencao === "ok") {
    return null;
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${ESTILOS[atencao]}`}
    >
      {rotulo(dias)}
    </span>
  );
}
