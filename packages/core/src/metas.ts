// Progresso de metas — dado um ALVO e o valor ATUAL, calcula a fração atingida
// e se a meta foi batida. Lógica PURA e TESTÁVEL — vive no motor (@imobia/core),
// NUNCA em SQL nem na UI. A camada de dados só fornece `alvo` (da meta) e `atual`
// (do agregado do período) e chama esta função.
//
// MODELO (documentado):
//   - progresso = atual / alvo, LIMITADO a 1 (cap: exceder o alvo não passa de 100%);
//   - alvo == 0 ⇒ progresso 0 (meta neutra/indefinida; evita divisão por zero);
//   - atingida = atual >= alvo (verdadeiro inclusive quando alvo == 0).

/**
 * Calcula o progresso de uma meta em relação ao seu `alvo`.
 *
 * @param alvo  Alvo a atingir (contagem ou CENTAVOS). Espera-se `>= 0`.
 * @param atual Valor atual acumulado no período.
 * @returns `progresso` (fração 0..1, cap 1; `0` se `alvo` for 0) e `atingida`
 *          (`atual >= alvo`).
 */
export function calcularProgressoMeta(
  alvo: number,
  atual: number,
): { progresso: number; atingida: boolean } {
  const atingida = atual >= alvo;
  if (alvo <= 0) {
    return { progresso: 0, atingida };
  }
  const bruto = atual / alvo;
  const progresso = bruto > 1 ? 1 : bruto < 0 ? 0 : bruto;
  return { progresso, atingida };
}
