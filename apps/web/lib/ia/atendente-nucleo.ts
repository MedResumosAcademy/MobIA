// NÚCLEO PURO da IA atendente — pós-validação da resposta do LLM, SEM
// IO/rede (padrão interpretador-normalizacao.ts: o que dá para testar sem
// mock fica aqui; atendente.ts só faz a chamada ao provedor).
//
// POR QUE PÓS-VALIDAR: o LLM não é confiável por construção. Mesmo com as
// REGRAS FIXAS no prompt (nunca inventar preço/imóvel), a saída é REVALIDADA
// aqui — resposta vazia, longa demais ou citando um valor em R$ que NÃO
// aparece no contexto faz a conversa ESCALAR por segurança (fail-safe:
// preferimos um humano a um preço inventado).

import { REGRAS_FIXAS_ATENDIMENTO } from "@imobia/core";

/** Teto de tamanho da resposta da IA (WhatsApp pede mensagens curtas). */
export const LIMITE_RESPOSTA_CHARS = 500;

/**
 * Prefixos mais curtos que isto NÃO valem como confirmação de valor: a
 * numeração de qualquer lista no contexto ("1.", "2.", "10x"…) casaria por
 * prefixo com QUALQUER preço começando por aqueles dígitos. Com 4+ dígitos o
 * casamento por prefixo volta a ser seguro (tolerância a centavos/pontuação).
 */
const MIN_DIGITOS_PREFIXO = 4;

export type ValidacaoResposta =
  | { ok: true; texto: string }
  | { ok: false; motivo: "resposta_vazia" | "resposta_longa" | "valor_nao_confirmado" };

/** Limpa a saída do modelo (cercas de código/aspas acidentais) — puro. */
export function limparSaidaLlm(bruta: string): string {
  let t = bruta.trim();
  t = t.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "").trim();
  if (t.length >= 2 && /^["'“”]/.test(t) && /["'“”]$/.test(t)) {
    t = t.slice(1, -1).trim();
  }
  return t;
}

/** Dígitos de cada valor "R$ ..." do texto (ex.: "R$ 350.000,00" ⇒ "35000000"). */
export function valoresMonetarios(texto: string): string[] {
  const valores: string[] = [];
  for (const m of texto.matchAll(/R\$\s*([\d][\d.,\s]*)/g)) {
    const digitos = m[1].replace(/\D/g, "");
    if (digitos !== "") {
      valores.push(digitos);
    }
  }
  return valores;
}

/** Sequências de dígitos dos tokens numéricos do contexto ("350.000,00" ⇒ "35000000"). */
function tokensNumericos(texto: string): string[] {
  const tokens: string[] = [];
  for (const m of texto.matchAll(/\d[\d.,\s]*/g)) {
    const digitos = m[0].replace(/\D/g, "");
    if (digitos !== "") {
      tokens.push(digitos);
    }
  }
  return tokens;
}

/**
 * Um valor citado pela IA está CONFIRMADO se algum número do contexto tem os
 * mesmos dígitos — com tolerância de PREFIXO para pontuação/centavos (o
 * contexto diz "R$ 350.000,00" e a IA responde "R$ 350.000", ou vice-versa).
 * A tolerância SÓ vale quando o lado mais curto tem >= 4 dígitos: um dígito
 * solto do contexto ("1.", "3 quartos") jamais confirma um preço inteiro —
 * dígitos curtos exigem igualdade EXATA (fail-safe: preço inventado escala).
 */
function valorConfirmado(valor: string, tokensContexto: readonly string[]): boolean {
  return tokensContexto.some((t) => {
    if (t === valor) {
      return true;
    }
    const curto = t.length <= valor.length ? t : valor;
    const longo = t.length <= valor.length ? valor : t;
    return curto.length >= MIN_DIGITOS_PREFIXO && longo.startsWith(curto);
  });
}

/**
 * Pós-validação da resposta do LLM (fail-safe — documentado no topo):
 *   - vazia (após limpeza) ⇒ escalar;
 *   - > LIMITE_RESPOSTA_CHARS ⇒ escalar (resposta desgovernada);
 *   - cita "R$ <número>" que NÃO aparece no contexto ⇒ escalar (a IA NUNCA
 *     pode inventar preço — regra de produto inegociável).
 * `contexto` deve conter TUDO que a IA recebeu (prompt de sistema com
 * persona/FAQ + histórico + mensagem do cliente). O bloco FIXO de regras é
 * REMOVIDO antes da varredura de números: a numeração das regras ("1.", "2."…)
 * não é dado de imóvel e não pode confirmar preço nenhum.
 */
export function validarRespostaAtendente(
  bruta: string,
  contexto: string,
): ValidacaoResposta {
  const texto = limparSaidaLlm(bruta);
  if (texto === "") {
    return { ok: false, motivo: "resposta_vazia" };
  }
  if (texto.length > LIMITE_RESPOSTA_CHARS) {
    return { ok: false, motivo: "resposta_longa" };
  }
  const valores = valoresMonetarios(texto);
  if (valores.length > 0) {
    const tokens = tokensNumericos(contexto.replace(REGRAS_FIXAS_ATENDIMENTO, ""));
    if (!valores.every((v) => valorConfirmado(v, tokens))) {
      return { ok: false, motivo: "valor_nao_confirmado" };
    }
  }
  return { ok: true, texto };
}
