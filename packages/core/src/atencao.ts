// Atenção de negócios — quantifica há quanto tempo um negócio está SEM MOVIMENTO
// e o classifica em níveis de atenção. Lógica PURA e TESTÁVEL — vive no motor
// (@imobia/core), NUNCA em SQL nem na UI. A camada de dados só fornece as datas
// (atualizadoEm do negócio e o "hoje") e chama estas funções.
//
// MODELO (documentado e parametrizável):
//   - dias sem movimento = dias inteiros decorridos entre `atualizadoEm` e `hoje`;
//   - < LIMIAR_ATENCAO (7)  ⇒ "ok"      (movimentado recentemente);
//   - LIMIAR_ATENCAO..LIMIAR_PARADO-1 (7..13) ⇒ "atencao" (esfriando);
//   - >= LIMIAR_PARADO (14) ⇒ "parado"  (estagnado).
//
// Os limiares são exportados para tuning futuro: ajustá-los só toca os testes
// de fronteira, não a lógica.

import type { NivelAtencao } from "@imobia/domain";

/** A partir de quantos dias sem movimento um negócio entra em "atencao". */
export const LIMIAR_ATENCAO = 7;

/** A partir de quantos dias sem movimento um negócio é considerado "parado". */
export const LIMIAR_PARADO = 14;

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Dias inteiros decorridos entre `atualizadoEmISO` e `hojeISO` (ambos ISO).
 * Sempre `>= 0`: se `atualizadoEm` for igual ou posterior a `hoje`, retorna 0.
 */
export function diasSemMovimento(atualizadoEmISO: string, hojeISO: string): number {
  const atualizado = new Date(atualizadoEmISO).getTime();
  const hoje = new Date(hojeISO).getTime();
  const dias = Math.floor((hoje - atualizado) / MS_POR_DIA);
  return dias > 0 ? dias : 0;
}

/**
 * Classifica os dias sem movimento em um nível de atenção:
 *   - `ok`      se dias < LIMIAR_ATENCAO;
 *   - `atencao` se LIMIAR_ATENCAO <= dias < LIMIAR_PARADO;
 *   - `parado`  se dias >= LIMIAR_PARADO.
 */
export function classificarAtencao(dias: number): NivelAtencao {
  if (dias >= LIMIAR_PARADO) return "parado";
  if (dias >= LIMIAR_ATENCAO) return "atencao";
  return "ok";
}
