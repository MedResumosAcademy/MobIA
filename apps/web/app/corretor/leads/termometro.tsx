// Apresentação do TERMÔMETRO (§5.3) — rótulos, chamas e cores por temperatura.
// PURA UI: nenhuma regra de negócio aqui (a temperatura/score vêm do @mobia/core
// via lib/dados/leads.ts). Este módulo só traduz o enum em algo visível.

import type { Temperatura } from "@mobia/domain";

type EstiloTermometro = {
  rotulo: string;
  /** Chamas repetidas conforme a intensidade (§5.3). */
  chamas: string;
  /** Classes Tailwind do "chip" (fundo + texto + borda), claro e escuro. */
  chip: string;
};

const ESTILOS: Record<Temperatura, EstiloTermometro> = {
  quente: {
    rotulo: "Quente",
    chamas: "🔥",
    chip: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
  },
  muito_quente: {
    rotulo: "Muito quente",
    chamas: "🔥🔥",
    chip: "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-200",
  },
  pronto_para_compra: {
    rotulo: "Pronto para compra",
    chamas: "🔥🔥🔥",
    chip: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200",
  },
};

/** Chip visual do termômetro: chamas + rótulo, colorido por intensidade. */
export function ChipTermometro({ temperatura }: { temperatura: Temperatura }) {
  const e = ESTILOS[temperatura];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${e.chip}`}
    >
      <span aria-hidden>{e.chamas}</span>
      {e.rotulo}
    </span>
  );
}
