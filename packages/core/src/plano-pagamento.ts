// Recálculo do plano de pagamento — coração do "Compre do seu jeito"
// (docs/ESCOPO.md §4.3, §4.4 e §6.2).
//
// O cliente arrasta a barra de entrada e este módulo redistribui o plano:
//   Ato (mês 0) → Parcelas mensais → Balões → Financiamento/Chaves (mês N).
//
// Convenções (docs/ESCOPO.md §6):
// - Dinheiro: inteiros em CENTAVOS (`Centavos`). Math.round ao produzir valores.
// - Taxas: frações decimais. Conversão anual→mensal EFETIVA em financiamento.ts.
// - NENHUM valor de negócio hard-coded: percentuais, parcelas e balões chegam
//   pelo `EsquemaPagamento` do empreendimento; taxa/prazo/sistema pelo input.
// - INVARIANTE INEGOCIÁVEL: ato + Σparcelas + Σbalões + valorFinanciado ===
//   valorImovel, centavo a centavo (sobras de arredondamento vão para a
//   ÚLTIMA ocorrência de cada série).
// - Todo resultado é ESTIMATIVA (`ehEstimativa: true`), não proposta formal.
//
// TODO(pós-MVP): correção monetária (INCC) das parcelas de obra — fora do MVP.
// Campo reservado `correcaoMonetaria` em `PlanoPagamentoRecalculado`.

import {
  TIPOS_ITEM_PLANO,
  type Balao,
  type Centavos,
  type EsquemaPagamento,
  type ItemCronograma,
  type ParcelaMensalEsquema,
  type PlanoPagamentoRecalculado,
  type SistemaAmortizacao,
  type Taxa,
  type TipoItemPlano,
} from "@imobia/domain";
import { cronogramaSAC, parcelaPrice, taxaMensalDeAnual } from "./financiamento";

// Tipos do RESULTADO vivem no domain (schemas zod — H-02): o snapshot
// `Simulacao.resultado` valida contra `planoPagamentoRecalculadoSchema`.
export type {
  CorrecaoMonetaria,
  FinanciamentoPosChaves,
  PlanoPagamentoRecalculado,
} from "@imobia/domain";

/** Condições de financiamento escolhidas para o saldo pós-chaves. */
export interface FinanciamentoEscolhido {
  /** Taxa de juros EFETIVA anual (fração decimal, 0.105 = 10,5% a.a.). */
  taxaAnual: Taxa;
  /** Prazo do financiamento bancário, em meses. */
  prazoMeses: number;
  sistema: SistemaAmortizacao;
}

/** Input do recálculo: imóvel + esquema do empreendimento + escolhas do cliente. */
export interface EntradaRecalculoPlano {
  /** Valor do imóvel, em centavos. */
  valorImovel: Centavos;
  /** Regras do empreendimento (percentual mínimo de ato, parcelas, balões). */
  esquema: EsquemaPagamento;
  /** Entrada (ato) escolhida pelo cliente na barra, em centavos. */
  entradaEscolhida: Centavos;
  financiamento: FinanciamentoEscolhido;
}

/** Entrada escolhida abaixo do mínimo exigido pelo esquema do empreendimento. */
export interface ErroEntradaAbaixoDoMinimo {
  tipo: "entrada_abaixo_do_minimo";
  entradaEscolhida: Centavos;
  /** Menor ato permitido pelo esquema, em centavos. */
  entradaMinima: Centavos;
  percentualMinimoAto: Taxa;
}

/** Ato + parcelas + balões ultrapassam o valor do imóvel (nada a financiar). */
export interface ErroPlanoExcedeValorImovel {
  tipo: "plano_excede_valor_imovel";
  totalAteChaves: Centavos;
  valorImovel: Centavos;
  /** Quanto o plano passa do valor do imóvel, em centavos. */
  excedente: Centavos;
}

export type ErroRecalculoPlano =
  | ErroEntradaAbaixoDoMinimo
  | ErroPlanoExcedeValorImovel;

/** Result tipado: violações de regra de negócio não lançam exceção. */
export type ResultadoRecalculoPlano =
  | { ok: true; plano: PlanoPagamentoRecalculado }
  | { ok: false; erro: ErroRecalculoPlano };

// --- Helpers internos -------------------------------------------------------

function exigirInteiroNaoNegativo(valor: number, nome: string): void {
  if (!Number.isInteger(valor) || valor < 0) {
    throw new RangeError(`${nome} deve ser inteiro >= 0 em centavos (recebido: ${valor})`);
  }
}

/**
 * Validação estrutural do esquema (mesmo padrão de `exigirPrazoValido` em
 * financiamento.ts): o schema zod do domínio já garante isso, mas o core não
 * o executa — chamadores que construam `EsquemaPagamento` sem passar pelo zod
 * (cast, dado corrompido) não podem travar o processo (`mesesDoBalao` entraria
 * em loop infinito com periodicidade <= 0 e geraria meses fracionários com
 * periodicidade não inteira).
 */
function exigirEsquemaValido(esquema: EsquemaPagamento): void {
  if (!Number.isInteger(esquema.numeroParcelasMensais) || esquema.numeroParcelasMensais < 0) {
    throw new RangeError(
      `numeroParcelasMensais deve ser inteiro >= 0 (recebido: ${esquema.numeroParcelasMensais})`,
    );
  }
  for (const balao of esquema.baloes) {
    if (!Number.isInteger(balao.periodicidadeMeses) || balao.periodicidadeMeses < 1) {
      throw new RangeError(
        `periodicidadeMeses do balão deve ser inteiro >= 1 (recebido: ${balao.periodicidadeMeses})`,
      );
    }
  }
}

/**
 * Série de `ocorrencias` valores em centavos a partir de valor fixo OU
 * percentual do imóvel. Sobras de arredondamento do percentual vão para a
 * ÚLTIMA ocorrência, de modo que a soma da série seja exatamente
 * round(valorImovel · percentual · ocorrencias).
 */
function serieComSobraNaUltima(
  valorImovel: Centavos,
  definicao: { valor?: Centavos; percentual?: Taxa },
  ocorrencias: number,
): Centavos[] {
  if (ocorrencias === 0) {
    return [];
  }
  if (definicao.valor !== undefined) {
    return new Array<Centavos>(ocorrencias).fill(definicao.valor);
  }
  if (definicao.percentual === undefined) {
    throw new RangeError("definição de série exige valor OU percentual");
  }
  const unitario = Math.round(valorImovel * definicao.percentual);
  const totalAlvo = Math.round(valorImovel * definicao.percentual * ocorrencias);
  const ultima = totalAlvo - unitario * (ocorrencias - 1);
  if (ultima < 0) {
    throw new RangeError(
      "sobra de arredondamento tornaria a última ocorrência negativa " +
        `(unitário ${unitario}, alvo ${totalAlvo}, ocorrências ${ocorrencias})`,
    );
  }
  const serie = new Array<Centavos>(ocorrencias).fill(unitario);
  serie[ocorrencias - 1] = ultima;
  return serie;
}

/** Meses de ocorrência de um balão: múltiplos da periodicidade até as chaves. */
function mesesDoBalao(balao: Balao, mesChaves: number): number[] {
  const meses: number[] = [];
  for (let mes = balao.periodicidadeMeses; mes <= mesChaves; mes += balao.periodicidadeMeses) {
    meses.push(mes);
  }
  return meses;
}

const ORDEM_TIPO: Record<TipoItemPlano, number> = Object.fromEntries(
  TIPOS_ITEM_PLANO.map((tipo, i) => [tipo, i]),
) as Record<TipoItemPlano, number>;

function somar(valores: Centavos[]): Centavos {
  return valores.reduce((acc, v) => acc + v, 0);
}

// --- Função principal -------------------------------------------------------

/**
 * Recalcula o plano de pagamento para uma entrada escolhida pelo cliente.
 *
 * - `entradaEscolhida` vira o ATO (mês 0); mínimo = round(valorImovel ·
 *   percentualMinimoAto) → abaixo disso retorna erro tipado com o mínimo.
 * - Parcelas mensais (meses 1..N) e balões (múltiplos da periodicidade)
 *   conforme o esquema; o RESTANTE é o `valorFinanciado` nas chaves (mês N).
 * - Invariante garantido por construção: ato + Σparcelas + Σbalões +
 *   valorFinanciado === valorImovel, centavo a centavo.
 */
export function recalcularPlano(input: EntradaRecalculoPlano): ResultadoRecalculoPlano {
  const { valorImovel, esquema, entradaEscolhida, financiamento } = input;

  // Erros estruturais (uso incorreto da API) lançam RangeError, como no
  // restante do core; violações de REGRA DE NEGÓCIO retornam Result.
  exigirInteiroNaoNegativo(valorImovel, "valorImovel");
  exigirInteiroNaoNegativo(entradaEscolhida, "entradaEscolhida");
  exigirEsquemaValido(esquema);
  if (valorImovel === 0) {
    throw new RangeError("valorImovel deve ser maior que zero");
  }
  const parcelaMensal: ParcelaMensalEsquema | undefined = esquema.parcelaMensal;
  if (esquema.numeroParcelasMensais > 0 && parcelaMensal === undefined) {
    throw new RangeError("esquema com parcelas mensais exige parcelaMensal");
  }

  // 1. Ato: valida percentual mínimo do esquema.
  const entradaMinima = Math.round(valorImovel * esquema.percentualMinimoAto);
  if (entradaEscolhida < entradaMinima) {
    return {
      ok: false,
      erro: {
        tipo: "entrada_abaixo_do_minimo",
        entradaEscolhida,
        entradaMinima,
        percentualMinimoAto: esquema.percentualMinimoAto,
      },
    };
  }

  // 2. Parcelas mensais (meses 1..N) e balões (múltiplos da periodicidade ≤ N).
  const mesChaves = esquema.numeroParcelasMensais;
  const parcelas =
    parcelaMensal === undefined
      ? []
      : serieComSobraNaUltima(valorImovel, parcelaMensal, esquema.numeroParcelasMensais);

  const itensBaloes: ItemCronograma[] = [];
  for (const balao of esquema.baloes) {
    const meses = mesesDoBalao(balao, mesChaves);
    const valores = serieComSobraNaUltima(valorImovel, balao, meses.length);
    meses.forEach((mesRelativo, i) => {
      itensBaloes.push({ tipo: "balao", mesRelativo, valor: valores[i]! });
    });
  }

  // 3. Restante → financiamento nas chaves. O invariante da soma vale por
  //    construção: valorFinanciado é definido como a diferença exata.
  const totalParcelas = somar(parcelas);
  const totalBaloes = somar(itensBaloes.map((b) => b.valor));
  const totalAteChaves = entradaEscolhida + totalParcelas + totalBaloes;
  if (totalAteChaves > valorImovel) {
    return {
      ok: false,
      erro: {
        tipo: "plano_excede_valor_imovel",
        totalAteChaves,
        valorImovel,
        excedente: totalAteChaves - valorImovel,
      },
    };
  }
  const valorFinanciado = valorImovel - totalAteChaves;

  // 4. Cronograma ordenado: ato → parcelas → balões → financiamento → chaves.
  const itens: ItemCronograma[] = [
    { tipo: "ato", mesRelativo: 0, valor: entradaEscolhida },
    ...parcelas.map((valor, i): ItemCronograma => ({
      tipo: "parcela",
      mesRelativo: i + 1,
      valor,
    })),
    ...itensBaloes,
    { tipo: "financiamento", mesRelativo: mesChaves, valor: valorFinanciado },
    // Marco visual da entrega (§4.4) — não é desembolso, valor 0.
    { tipo: "chaves", mesRelativo: mesChaves, valor: 0 },
  ];
  const cronograma = itens.sort(
    (a, b) => a.mesRelativo - b.mesRelativo || ORDEM_TIPO[a.tipo] - ORDEM_TIPO[b.tipo],
  );

  // 5. Parcela estimada do financiamento bancário pós-chaves.
  const taxaMensal = taxaMensalDeAnual(financiamento.taxaAnual);
  let parcelaEstimada: Centavos;
  let ultimaParcela: Centavos;
  if (financiamento.sistema === "price") {
    parcelaEstimada = parcelaPrice(valorFinanciado, taxaMensal, financiamento.prazoMeses);
    ultimaParcela = parcelaEstimada;
  } else {
    const sac = cronogramaSAC(valorFinanciado, taxaMensal, financiamento.prazoMeses);
    parcelaEstimada = sac.primeiraParcela;
    ultimaParcela = sac.ultimaParcela;
  }

  return {
    ok: true,
    plano: {
      cronograma,
      valorFinanciado,
      resumo: {
        valorImovel,
        totalAto: entradaEscolhida,
        totalParcelas,
        totalBaloes,
        totalAteChaves,
        percentualAteChaves: totalAteChaves / valorImovel,
      },
      financiamentoPosChaves: {
        sistema: financiamento.sistema,
        taxaAnual: financiamento.taxaAnual,
        taxaMensal,
        prazoMeses: financiamento.prazoMeses,
        parcelaEstimada,
        ultimaParcela,
      },
      // TODO(pós-MVP): correção monetária (INCC) — sem correção no MVP.
      correcaoMonetaria: undefined,
      ehEstimativa: true,
    },
  };
}
