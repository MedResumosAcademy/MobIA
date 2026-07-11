// Parsing de DINHEIRO digitado (pt-BR) → CENTAVOS. PURO e determinístico.
//
// Regra do separador decimal (detectado pelo ÚLTIMO símbolo):
//   - Se o texto contém VÍRGULA, ela é o decimal; pontos são milhar.
//     "1.280.000,00" → 128000000 · "1280000,5" → 128000050
//   - Se contém APENAS ponto(s): o ponto é decimal somente quando é o ÚNICO
//     ponto e tem 1–2 dígitos após ele ("1280000.00", "1500.5"); caso
//     contrário, pontos são milhar ("1.280.000").
//   - Sem separador: reais inteiros ("1280000").
// Inválido/negativo lança Error("valor inválido") — os chamadores (Server
// Actions) mapeiam para o fluxo de erro deles.

/**
 * Converte texto de reais (pt-BR ou com ponto decimal) em CENTAVOS.
 * Lança Error("valor inválido") para texto vazio, não numérico ou negativo.
 */
export function reaisTextoParaCentavos(texto: string): number {
  const t = texto.trim();
  if (t === "") {
    throw new Error("valor inválido");
  }

  let normalizado: string;
  if (t.includes(",")) {
    // Vírgula é o decimal; todo ponto é milhar.
    normalizado = t.replace(/\./g, "").replace(",", ".");
  } else if (/^\d+\.\d{1,2}$/.test(t)) {
    // Único ponto com 1–2 casas após ele ⇒ decimal ("1280000.00", "1500.5").
    normalizado = t;
  } else {
    // Pontos (se houver) são milhar ("1.280.000", "1280000").
    normalizado = t.replace(/\./g, "");
  }

  const numero = Number(normalizado);
  if (!Number.isFinite(numero) || numero < 0) {
    throw new Error("valor inválido");
  }
  return Math.round(numero * 100);
}

/**
 * Inverso para PREFILL de inputs: CENTAVOS → texto de reais com vírgula decimal
 * e sem milhar (ex.: 128000000 → "1280000,00"), formato que
 * reaisTextoParaCentavos aceita de volta (ida-e-volta sem perda).
 * null → "" (input vazio).
 */
export function centavosParaReaisInput(centavos: number | null): string {
  if (centavos === null) {
    return "";
  }
  return (centavos / 100).toFixed(2).replace(".", ",");
}
