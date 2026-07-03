// CASCATA GROQ — infraestrutura COMPARTILHADA dos módulos de IA (interpretador
// de comandos e redator de WhatsApp): mesma ordem de modelos, mesmos orçamentos
// de tempo e a mesma checagem de chave. Server-side APENAS (a chave vive em
// process.env.GROQ_API_KEY, carregada de .env.local pelo Next).
//
// Cascata de modelos: o 70b é o preferido; o scout é o plano B porque, na
// prática, a org da chave atual limita o 70b (TPM 1 ⇒ 413 imediato). A
// cascata para no primeiro sucesso e tem DOIS níveis de orçamento:
//   - total (~10s): teto da cascata inteira, com folga para cold start
//     (primeira chamada do processo carrega o AI SDK + leva o 413 do 70b
//     antes de o scout gerar — já medimos ~6s nesse caminho);
//   - por modelo: o 70b, sabidamente limitado nesta org, ganha no máximo
//     TIMEOUT_70B_MS para não comer o orçamento do scout.
// GROQ_PULAR_70B=1 no ambiente pula o 70b de vez (útil até a chave mudar
// de plano); sem a env, o comportamento é a cascata completa.

export const MODELO_70B = "llama-3.3-70b-versatile";
export const MODELO_SCOUT = "meta-llama/llama-4-scout-17b-16e-instruct";
export const TIMEOUT_TOTAL_MS = 10_000;
export const TIMEOUT_70B_MS = 3_000;

/** Modelos na ordem de tentativa (GROQ_PULAR_70B=1 ⇒ só o scout). */
export function modelosDaCascata(): readonly string[] {
  return process.env.GROQ_PULAR_70B === "1" ? [MODELO_SCOUT] : [MODELO_70B, MODELO_SCOUT];
}

/** Há chave da Groq no ambiente? (Nunca logamos/expomos o valor.) */
export function iaDisponivel(): boolean {
  return !!process.env.GROQ_API_KEY;
}

/**
 * Sinal de abort do modelo: o 70b tem teto próprio (curto) ALÉM do orçamento
 * total da cascata; os demais usam só o total.
 */
export function sinalDoModelo(modelo: string, sinalTotal: AbortSignal): AbortSignal {
  return modelo === MODELO_70B
    ? AbortSignal.any([sinalTotal, AbortSignal.timeout(TIMEOUT_70B_MS)])
    : sinalTotal;
}
