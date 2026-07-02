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
    // Âmbar suave — o mais frio da escala quente.
    chip: "border-gold/40 bg-gold-soft text-gold-strong",
  },
  muito_quente: {
    rotulo: "Muito quente",
    chamas: "🔥🔥",
    // Laranja da marca suave — intensidade intermediária.
    chip: "border-brand/30 bg-brand-soft text-brand-strong",
  },
  pronto_para_compra: {
    rotulo: "Pronto para compra",
    chamas: "🔥🔥🔥",
    // Laranja da marca sólido — o pico da escala.
    chip: "border-transparent bg-brand text-brand-contrast",
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
