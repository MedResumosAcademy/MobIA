// Matemática de financiamento imobiliário — funções PURAS (sem I/O, sem plataforma).
//
// Convenções (docs/ESCOPO.md §6):
// - Dinheiro: inteiros em CENTAVOS (`Centavos`). Math.round ao produzir resultado monetário.
// - Taxas: frações decimais (`Taxa`). Ex.: 10,5% a.a. → 0.105.
// - NENHUM valor de negócio hard-coded: tetos, taxas e limites chegam por parâmetro
//   (alimentados por `ParametrosFinanceiros` nas camadas superiores).
// - Todo resultado é ESTIMATIVA, não proposta formal (ver `AVISO_ESTIMATIVA`).

import type { Centavos, Taxa } from "@mobia/domain";

/**
 * Aviso legal padrão: toda simulação produzida por este módulo é uma
 * estimativa, não uma proposta formal de crédito.
 */
export const AVISO_ESTIMATIVA =
  "Simulação estimativa, sujeita a análise de crédito. Não constitui proposta formal. Indexadores pós-fixados (ex.: TR) não estão incluídos nas taxas simuladas." as const;

/** Cronograma resumido do sistema SAC (amortização constante). */
export interface CronogramaSAC {
  /** Primeira parcela — a maior do SAC (juros sobre o saldo integral). */
  primeiraParcela: Centavos;
  /** Última parcela — a menor do SAC. */
  ultimaParcela: Centavos;
  /** Todas as parcelas, em ordem (índice 0 = mês 1). */
  parcelas: Centavos[];
  /** Toda simulação é estimativa, não proposta formal (ESCOPO.md §6.4). */
  estimativa: true;
}

function exigirFinito(valor: number, nome: string): void {
  if (!Number.isFinite(valor)) {
    throw new RangeError(`${nome} deve ser um número finito (recebido: ${valor})`);
  }
}

function exigirNaoNegativo(valor: number, nome: string): void {
  exigirFinito(valor, nome);
  if (valor < 0) {
    throw new RangeError(`${nome} não pode ser negativo (recebido: ${valor})`);
  }
}

function exigirPrazoValido(prazoMeses: number): void {
  if (!Number.isInteger(prazoMeses) || prazoMeses < 1) {
    throw new RangeError(`prazoMeses deve ser inteiro >= 1 (recebido: ${prazoMeses})`);
  }
}

/**
 * Converte taxa anual em taxa mensal EFETIVA (juros compostos):
 * (1 + taxaAnual)^(1/12) - 1.
 *
 * Ex.: 12,682503...% a.a. → 1% a.m.
 */
export function taxaMensalDeAnual(taxaAnual: Taxa): Taxa {
  exigirNaoNegativo(taxaAnual, "taxaAnual");
  return Math.pow(1 + taxaAnual, 1 / 12) - 1;
}

/**
 * Converte taxa NOMINAL anual com capitalização mensal (formato divulgado por
 * Caixa/portarias MCMV, ex.: "TR + 11,19% a.a.", mensal = nominal/12) em taxa
 * EFETIVA anual — a semântica dos campos `taxaAnualEfetiva` do domínio:
 * efetiva = (1 + nominal/12)^12 − 1.
 *
 * Propriedade: taxaMensalDeAnual(taxaAnualEfetivaDeNominal(n)) === n/12,
 * reproduzindo exatamente a mensal dos simuladores de referência (ESCOPO §6.4).
 */
export function taxaAnualEfetivaDeNominal(taxaNominalAnual: Taxa): Taxa {
  exigirNaoNegativo(taxaNominalAnual, "taxaNominalAnual");
  return Math.pow(1 + taxaNominalAnual / 12, 12) - 1;
}

/**
 * Parcela fixa pelo sistema Price (PMT clássico):
 * PMT = VF · i / (1 - (1+i)^-n).
 * Taxa 0 → divisão simples (VF / n).
 */
export function parcelaPrice(
  valorFinanciado: Centavos,
  taxaMensal: Taxa,
  prazoMeses: number,
): Centavos {
  exigirNaoNegativo(valorFinanciado, "valorFinanciado");
  exigirNaoNegativo(taxaMensal, "taxaMensal");
  exigirPrazoValido(prazoMeses);

  if (taxaMensal === 0) {
    return Math.round(valorFinanciado / prazoMeses);
  }
  const fator = 1 - Math.pow(1 + taxaMensal, -prazoMeses);
  return Math.round((valorFinanciado * taxaMensal) / fator);
}

/**
 * Cronograma pelo sistema SAC: amortização constante (VF / n) + juros sobre
 * o saldo devedor. Parcelas decrescem linearmente; a primeira é a maior.
 */
export function cronogramaSAC(
  valorFinanciado: Centavos,
  taxaMensal: Taxa,
  prazoMeses: number,
): CronogramaSAC {
  exigirNaoNegativo(valorFinanciado, "valorFinanciado");
  exigirNaoNegativo(taxaMensal, "taxaMensal");
  exigirPrazoValido(prazoMeses);

  const amortizacao = valorFinanciado / prazoMeses;
  const parcelas: Centavos[] = [];
  for (let mes = 1; mes <= prazoMeses; mes++) {
    const saldoDevedor = valorFinanciado - (mes - 1) * amortizacao;
    parcelas.push(Math.round(amortizacao + saldoDevedor * taxaMensal));
  }

  return {
    primeiraParcela: parcelas[0]!,
    ultimaParcela: parcelas[parcelas.length - 1]!,
    parcelas,
    estimativa: true,
  };
}

/**
 * Prazo máximo (em meses) pela regra de idade (regra Caixa: idade + prazo
 * ≤ idade máxima — ex.: 80 anos e 6 meses = 966 meses). Nunca negativo.
 * Se `prazoMaxMeses` (limite da modalidade) for informado, aplica min().
 *
 * Nenhum limite é hard-coded: `idadeMaxMeses` e `prazoMaxMeses` vêm dos
 * parâmetros financeiros vigentes.
 */
export function prazoMaximoPorIdadeMeses(
  idadeMeses: number,
  idadeMaxMeses: number,
  prazoMaxMeses?: number,
): number {
  exigirNaoNegativo(idadeMeses, "idadeMeses");
  exigirNaoNegativo(idadeMaxMeses, "idadeMaxMeses");
  if (prazoMaxMeses !== undefined) {
    exigirNaoNegativo(prazoMaxMeses, "prazoMaxMeses");
  }

  let prazo = Math.floor(idadeMaxMeses - idadeMeses);
  if (prazoMaxMeses !== undefined) {
    prazo = Math.min(prazo, Math.floor(prazoMaxMeses));
  }
  return Math.max(0, prazo);
}

/**
 * Teto de parcela mensal dado o comprometimento máximo de renda.
 * Ex.: renda R$ 6.500,00 com 30% → parcela máx. R$ 1.950,00.
 */
export function parcelaMaximaPorRenda(
  rendaMensal: Centavos,
  comprometimentoMax: Taxa,
): Centavos {
  exigirNaoNegativo(rendaMensal, "rendaMensal");
  exigirNaoNegativo(comprometimentoMax, "comprometimentoMax");
  return Math.round(rendaMensal * comprometimentoMax);
}

/**
 * Valor máximo financiável pelo Price dado um teto de parcela — inversa do
 * PMT (valor presente da anuidade): VF = PMT · (1 - (1+i)^-n) / i.
 * Taxa 0 → PMT · n.
 */
export function valorFinanciavelMaxPrice(
  parcelaMax: Centavos,
  taxaMensal: Taxa,
  prazoMeses: number,
): Centavos {
  exigirNaoNegativo(parcelaMax, "parcelaMax");
  exigirNaoNegativo(taxaMensal, "taxaMensal");
  exigirPrazoValido(prazoMeses);

  if (taxaMensal === 0) {
    return Math.round(parcelaMax * prazoMeses);
  }
  const fator = 1 - Math.pow(1 + taxaMensal, -prazoMeses);
  return Math.round((parcelaMax * fator) / taxaMensal);
}

/**
 * Valor máximo financiável pelo SAC dado um teto de parcela — inversa pela
 * PRIMEIRA parcela (a maior): primeira = VF/n + VF·i ⇒ VF = parcelaMax / (1/n + i).
 */
export function valorFinanciavelMaxSAC(
  parcelaMax: Centavos,
  taxaMensal: Taxa,
  prazoMeses: number,
): Centavos {
  exigirNaoNegativo(parcelaMax, "parcelaMax");
  exigirNaoNegativo(taxaMensal, "taxaMensal");
  exigirPrazoValido(prazoMeses);

  return Math.round(parcelaMax / (1 / prazoMeses + taxaMensal));
}
