// Helpers de DINHEIRO para Server Actions: FormData → CENTAVOS. Fina camada
// sobre o parser puro reaisTextoParaCentavos (@imobia/core, testado lá), que
// detecta o separador decimal pelo ÚLTIMO símbolo — "1.280.000,00",
// "1280000,00", "1280000.00", "1500.5" e "1.280.000" parseiam corretamente.
// Duas variantes de vazio: null (negócio sem valor) e 0 (imóvel sem preço).

import { reaisTextoParaCentavos } from "@imobia/core";

/** "1.280.000,00" | "1280000.00" | "1280000" → centavos; vazio → null. */
export function reaisParaCentavosOuNull(raw: FormDataEntryValue | null): number | null {
  const texto = String(raw ?? "").trim();
  if (texto === "") {
    return null;
  }
  return reaisTextoParaCentavos(texto);
}

/** Idem, mas vazio → 0 (imóveis: valor NOT NULL com default 0). */
export function reaisParaCentavosOuZero(raw: FormDataEntryValue | null): number {
  const texto = String(raw ?? "").trim();
  if (texto === "") {
    return 0;
  }
  return reaisTextoParaCentavos(texto);
}
