// CPF — limpeza, validação (dígitos verificadores mod 11) e formatação.
//
// Lógica PURA (sem IO). Usada pelo onboarding de corretor: o schema zod em
// @imobia/domain só garante forma (11 dígitos); a validação FORTE dos
// verificadores acontece na action via `validarCpf` daqui.
//
// Algoritmo oficial (Receita Federal):
//   DV1 = resto de (soma dos 9 primeiros dígitos × pesos 10..2) × 10 mod 11,
//         sendo 10 → 0.
//   DV2 = idem com os 10 primeiros dígitos × pesos 11..2.
// CPFs com todos os dígitos iguais (000..., 111..., …) passam na conta mas
// são inválidos por definição — rejeitados explicitamente.

/** Remove tudo que não é dígito ("123.456.789-09" → "12345678909"). */
export function limparCpf(v: string): string {
  return v.replace(/\D/g, "");
}

/** Calcula um dígito verificador: soma ponderada com peso inicial decrescente. */
function digitoVerificador(digitos: string, pesoInicial: number): number {
  let soma = 0;
  for (let i = 0; i < digitos.length; i++) {
    soma += Number(digitos[i]) * (pesoInicial - i);
  }
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

/**
 * Valida um CPF (com ou sem máscara): exige 11 dígitos, rejeita sequências
 * de dígitos repetidos e confere os DOIS dígitos verificadores (mod 11).
 */
export function validarCpf(v: string): boolean {
  const cpf = limparCpf(v);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  const dv1 = digitoVerificador(cpf.slice(0, 9), 10);
  if (dv1 !== Number(cpf[9])) return false;
  const dv2 = digitoVerificador(cpf.slice(0, 10), 11);
  return dv2 === Number(cpf[10]);
}

/**
 * Formata como "123.456.789-09" (aceita input com ou sem máscara).
 * Se o input limpo não tiver 11 dígitos, devolve o input limpo como está —
 * NÃO valida verificadores (formatação é apresentação, não validação).
 */
export function formatarCpf(v: string): string {
  const cpf = limparCpf(v);
  if (cpf.length !== 11) return cpf;
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
}
