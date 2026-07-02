// Sonhômetro — cálculo de capacidade de compra (ESCOPO.md §4.5/§6.3; H-16/H-17).
//
// Dado o perfil do cliente (renda, FGTS, idade, estado civil, dependentes,
// cidade) e os `ParametrosFinanceiros` vigentes, responde:
//   "Hoje você consegue comprar imóveis de até R$ X."
//
// Convenções (docs/ESCOPO.md §6):
// - Dinheiro em CENTAVOS (`Centavos`), taxas em fração decimal (`Taxa`).
// - NENHUM valor de negócio hard-coded: comprometimento, idade máxima, LTV,
//   prazos, faixas, subsídios e tetos vêm todos de `ParametrosFinanceiros`.
// - Todo resultado é ESTIMATIVA, não proposta formal (`ehEstimativa: true`;
//   ver `AVISO_ESTIMATIVA` em financiamento.ts).
//
// Nota de modelagem: `estadoCivil` e `dependentes` fazem parte do formulário
// do Sonhômetro (ESCOPO §4.5) e são aceitos no perfil, mas o snapshot atual de
// `ParametrosFinanceiros` não define nenhuma regra keyed por eles — ficam
// reservados para regras futuras (ex.: prioridade MCMV), sem efeito no cálculo.
// A composição de renda (§6.3) usa `rendaConjuge` e `rendaOutrosMembros`
// sempre que informados: o enquadramento de faixas (MCMV) é por renda bruta
// FAMILIAR — todos os moradores da unidade habitacional.

import {
  MODALIDADES,
  type Centavos,
  type ConfigModalidade,
  type EstadoCivil,
  type FaixaModalidade,
  type Modalidade,
  type ParametrosFinanceiros,
  type ParametrosGerais,
  type Taxa,
  type TetoValorImovel,
} from "@imobia/domain";
import {
  cronogramaSAC,
  parcelaMaximaPorRenda,
  parcelaPrice,
  prazoMaximoPorIdadeMeses,
  taxaMensalDeAnual,
  valorFinanciavelMaxPrice,
  valorFinanciavelMaxSAC,
} from "./financiamento";
import { extrairUf, formatarReais } from "./modalidades";

/** Perfil de entrada do Sonhômetro (ESCOPO §4.5). Informe `idadeMeses` OU `dataNascimento`. */
export interface PerfilSonhometro {
  /** Renda mensal bruta do titular, em centavos. */
  rendaMensal: Centavos;
  /** Renda mensal bruta do cônjuge (composição de renda, §6.3), em centavos. */
  rendaConjuge?: Centavos;
  /**
   * Renda mensal bruta dos DEMAIS moradores da unidade habitacional, em
   * centavos. O enquadramento MCMV usa renda bruta FAMILIAR (todos os
   * moradores) — omitir rendas de outros membros pode enquadrar o perfil em
   * faixa indevida (subsídio/taxa otimistas).
   */
  rendaOutrosMembros?: Centavos;
  /** Saldo de FGTS disponível para entrada, em centavos. */
  fgts: Centavos;
  /** Idade do proponente em meses (prevalece sobre `dataNascimento`). */
  idadeMeses?: number;
  /** Data de nascimento ISO (YYYY-MM-DD), alternativa a `idadeMeses`. */
  dataNascimento?: string;
  /** Data de referência ISO para idade via `dataNascimento` (default: hoje). */
  dataReferencia?: string;
  estadoCivil: EstadoCivil;
  /** Número de filhos/dependentes (inteiro >= 0). */
  dependentes: number;
  /** Cidade e UF, ex.: "Fortaleza-CE" (usado nos tetos por UF). */
  cidadeUF: string;
}

/** Capacidade de compra calculada para UMA modalidade. */
export interface CapacidadeModalidade {
  modalidade: Modalidade;
  elegivel: boolean;
  /** Presente apenas quando inelegível: explicação legível do porquê. */
  motivo?: string;
  /** Valor máximo de imóvel comprável nesta modalidade, em centavos. */
  valorMaximoImovel: Centavos;
  /** Parcela estimada no cenário máximo (Price: fixa; SAC: primeira parcela). */
  parcelaEstimada: Centavos;
  /** Prazo usado: min(prazo por idade, prazo máximo da modalidade). */
  prazoMeses: number;
  /** Subsídio máximo da faixa de renda enquadrada (0 se não há faixa/subsídio). */
  subsidioEstimado: Centavos;
  /**
   * true quando `subsidioEstimado` usa o TETO da faixa ("até R$ X"): o subsídio
   * real decresce com a renda e varia por localização — o resultado pode ser
   * otimista. Documenta a superestimativa até o subsídio ser parametrizado
   * como função da renda.
   */
  subsidioEhTeto: boolean;
  /**
   * Entrada MÍNIMA (recursos próprios/FGTS) necessária para atingir o valor
   * máximo, dado que o banco financia até min(financiável pela parcela, LTV·V):
   * max(0, V − financiado − subsídio). Quando um teto de valor limita V, é
   * menor que o FGTS disponível.
   */
  entradaNecessaria: Centavos;
}

/** Resultado do Sonhômetro. */
export interface ResultadoSonhometro {
  /** "Hoje você consegue comprar imóveis de até..." — melhor modalidade elegível. */
  valorMaximoImovel: Centavos;
  /** Modalidade com maior capacidade (empate: primeira na ordem de MODALIDADES). */
  melhorModalidade: Modalidade | undefined;
  /** Capacidade detalhada em TODAS as modalidades, na ordem de MODALIDADES. */
  porModalidade: CapacidadeModalidade[];
  detalhamento: {
    /** Teto de parcela: renda total × comprometimento máximo. */
    parcelaMax: Centavos;
    /** Prazo máximo pela idade (sem cap de modalidade; caps em porModalidade). */
    prazoMax: number;
    /** FGTS disponível como entrada, se a MELHOR modalidade permite FGTS. */
    entradaDisponivel: Centavos;
    /** Fração de comprometimento de renda usada (dos parâmetros vigentes). */
    comprometimentoUsado: Taxa;
  };
  /** Toda simulação é estimativa, não proposta formal (ESCOPO §6.4). */
  ehEstimativa: true;
}

function exigirCentavosNaoNegativos(valor: number, nome: string): void {
  if (!Number.isFinite(valor) || valor < 0) {
    throw new RangeError(`${nome} deve ser um valor não negativo em centavos (recebido: ${valor})`);
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Idade em meses COMPLETOS entre `dataNascimento` e `dataReferencia`
 * (ISO YYYY-MM-DD). Ex.: 1996-07-02 → 2026-07-02 = 360 meses.
 */
export function idadeEmMeses(dataNascimento: string, dataReferencia: string): number {
  for (const [nome, data] of [
    ["dataNascimento", dataNascimento],
    ["dataReferencia", dataReferencia],
  ] as const) {
    if (!ISO_DATE.test(data)) {
      throw new RangeError(`${nome} deve estar no formato ISO YYYY-MM-DD (recebido: ${data})`);
    }
  }
  const [an, mn, dn] = dataNascimento.split("-").map(Number) as [number, number, number];
  const [ar, mr, dr] = dataReferencia.split("-").map(Number) as [number, number, number];
  let meses = (ar - an) * 12 + (mr - mn);
  if (dr < dn) {
    meses -= 1; // mês corrente ainda não completou
  }
  if (meses < 0) {
    throw new RangeError(
      `dataNascimento (${dataNascimento}) posterior à referência (${dataReferencia})`,
    );
  }
  return meses;
}

/** Resolve a idade em meses do perfil (idadeMeses prevalece sobre dataNascimento). */
function resolverIdadeMeses(perfil: PerfilSonhometro): number {
  if (perfil.idadeMeses !== undefined) {
    if (!Number.isFinite(perfil.idadeMeses) || perfil.idadeMeses < 0) {
      throw new RangeError(`idadeMeses deve ser >= 0 (recebido: ${perfil.idadeMeses})`);
    }
    return Math.floor(perfil.idadeMeses);
  }
  if (perfil.dataNascimento !== undefined) {
    const referencia = perfil.dataReferencia ?? new Date().toISOString().slice(0, 10);
    return idadeEmMeses(perfil.dataNascimento, referencia);
  }
  throw new RangeError("perfil deve informar idadeMeses ou dataNascimento");
}

/**
 * Ordena faixas por rendaMensalAte crescente — defensivo: o schema já exige a
 * ordem (refine em configModalidadeSchema), mas o motor não depende disso para
 * dados que cheguem sem passar pela validação zod.
 */
function ordenarFaixas(faixas: readonly FaixaModalidade[]): FaixaModalidade[] {
  return [...faixas].sort((a, b) => a.rendaMensalAte - b.rendaMensalAte);
}

/**
 * Faixa de renda enquadrada: primeira faixa (ordenadas por rendaMensalAte)
 * cuja renda máxima comporta a renda total. Limite INCLUSIVO (como em
 * enquadrarModalidades). `undefined` se a renda excede a última faixa.
 */
function enquadrarFaixa(
  faixas: readonly FaixaModalidade[],
  rendaTotal: Centavos,
): FaixaModalidade | undefined {
  return ordenarFaixas(faixas).find((f) => rendaTotal <= f.rendaMensalAte);
}

interface ContextoCalculo {
  rendaTotal: Centavos;
  fgts: Centavos;
  idadeMeses: number;
  parcelaMax: Centavos;
  uf: string | undefined;
  gerais: ParametrosGerais;
}

/** Resolve um teto de valor (sobrescrita por UF quando cadastrada); ausente = Infinity. */
function resolverTeto(teto: TetoValorImovel | undefined, uf: string | undefined): number {
  if (teto === undefined) {
    return Infinity;
  }
  return (uf !== undefined ? teto.porUf?.[uf] : undefined) ?? teto.padrao;
}

function capacidadeDaModalidade(
  modalidade: Modalidade,
  config: ConfigModalidade,
  ctx: ContextoCalculo,
): CapacidadeModalidade {
  // Prazo = min(prazo pela regra de idade, prazo máximo da modalidade).
  const prazoMeses = prazoMaximoPorIdadeMeses(
    ctx.idadeMeses,
    ctx.gerais.idadeMaxMeses,
    config.prazoMaxMeses,
  );

  const inelegivel = (motivo: string): CapacidadeModalidade => ({
    modalidade,
    elegivel: false,
    motivo,
    valorMaximoImovel: 0,
    parcelaEstimada: 0,
    prazoMeses,
    subsidioEstimado: 0,
    subsidioEhTeto: false,
    entradaNecessaria: 0,
  });

  // Faixas de renda (ex.: MCMV): renda acima da última faixa → inelegível.
  const faixa = config.faixas !== undefined ? enquadrarFaixa(config.faixas, ctx.rendaTotal) : undefined;
  if (config.faixas !== undefined && faixa === undefined) {
    const ultima = ordenarFaixas(config.faixas).at(-1);
    return inelegivel(
      `renda ${formatarReais(ctx.rendaTotal)} acima da última faixa` +
        (ultima !== undefined ? ` (${formatarReais(ultima.rendaMensalAte)})` : ""),
    );
  }

  // Idade não comporta nem 1 mês de prazo → não há financiamento possível.
  if (prazoMeses < 1) {
    return inelegivel("idade não comporta prazo mínimo de financiamento (1 mês)");
  }

  // Taxa: a da faixa enquadrada sobrescreve a taxa padrão da modalidade.
  const taxaMensal = taxaMensalDeAnual(faixa?.taxaAnualEfetiva ?? config.taxaAnualEfetiva);
  const sistema = config.sistemaAmortizacaoPadrao;

  // 1) Financiável máximo pela parcela (inversa Price ou SAC, conforme o sistema).
  const financiavelMax =
    sistema === "price"
      ? valorFinanciavelMaxPrice(ctx.parcelaMax, taxaMensal, prazoMeses)
      : valorFinanciavelMaxSAC(ctx.parcelaMax, taxaMensal, prazoMeses);

  // Subsídio da faixa — estimado pelo MÁXIMO ("até R$ X"): ver `subsidioEhTeto`.
  const subsidioEstimado = faixa?.subsidioMax ?? 0;

  // L efetivo = min(LTV da modalidade, LTV geral do sistema de amortização) —
  // ambos parametrizados; vale o mais restritivo.
  const ltv = Math.min(config.ltvMax, ctx.gerais.ltvMax[sistema]);

  // Teto de valor efetivo = min(teto da FAIXA enquadrada, teto da MODALIDADE),
  // ambos com sobrescrita por UF (ex.: MCMV F1/F2 R$ 275 mil < teto R$ 600 mil).
  const tetoValor = Math.min(
    resolverTeto(faixa?.tetoValorImovel, ctx.uf),
    resolverTeto(config.tetoValorImovel, ctx.uf),
  );

  // Cenário de compra dado o quanto de entrada está disponível e um teto de
  // valor adicional (usado para o teto SFH de uso do FGTS).
  const cenario = (entradaDisponivel: Centavos, tetoAdicional: number) => {
    const capacidadeBruta = financiavelMax + entradaDisponivel + subsidioEstimado;

    // Teto por LTV — DERIVAÇÃO:
    //   Para um imóvel de valor V, o banco financia (V − E − S), onde
    //   E = entrada disponível e S = subsídio, e exige financiado ≤ L·V:
    //       V − E − S ≤ L·V  ⇒  V·(1 − L) ≤ E + S  ⇒  V ≤ (E + S) / (1 − L)
    //   Consequências:
    //   - E + S = 0 e L < 1 ⇒ V ≤ 0: SEM entrada e SEM subsídio não há compra
    //     possível por maior que seja a renda (o banco não financia 100%).
    //   - L ≥ 1 ⇒ sem teto por LTV.
    //   Math.floor garante a desigualdade mesmo após truncar para centavos.
    const tetoPorLtv =
      ltv >= 1 ? Infinity : Math.floor((entradaDisponivel + subsidioEstimado) / (1 - ltv));

    const valorMaximoImovel = Math.max(
      0,
      Math.min(capacidadeBruta, tetoPorLtv, tetoValor, tetoAdicional),
    );

    // Financiado no cenário máximo = o MAIOR financiamento admissível
    // (⇒ a MENOR entrada necessária): limitado pela parcela (financiavelMax),
    // pelo LTV (floor(L·V)) e por não exceder o que falta após o subsídio.
    const financiado = Math.max(
      0,
      Math.min(
        financiavelMax,
        ltv >= 1 ? valorMaximoImovel : Math.floor(ltv * valorMaximoImovel),
        valorMaximoImovel - subsidioEstimado,
      ),
    );
    const parcelaEstimada =
      financiado === 0
        ? 0
        : sistema === "price"
          ? parcelaPrice(financiado, taxaMensal, prazoMeses)
          : cronogramaSAC(financiado, taxaMensal, prazoMeses).primeiraParcela;

    // Entrada MÍNIMA que satisfaz parcela e LTV (≤ E por construção de V).
    const entradaNecessaria = Math.max(0, valorMaximoImovel - financiado - subsidioEstimado);

    return { valorMaximoImovel, parcelaEstimada, entradaNecessaria };
  };

  // FGTS como entrada: apenas se a modalidade permite E o imóvel resultante não
  // ultrapassa o teto SFH de uso do FGTS (parametrizado). Comparamos o cenário
  // COM FGTS (valor limitado ao teto SFH) e SEM FGTS (sem esse teto) e
  // reportamos o maior.
  const tetoFgts = ctx.gerais.tetoValorImovelParaFgts ?? Infinity;
  const semFgts = cenario(0, Infinity);
  const comFgts = config.permiteFgts ? cenario(ctx.fgts, tetoFgts) : undefined;
  const melhorCenario =
    comFgts !== undefined && comFgts.valorMaximoImovel >= semFgts.valorMaximoImovel
      ? comFgts
      : semFgts;

  return {
    modalidade,
    elegivel: true,
    ...melhorCenario,
    prazoMeses,
    subsidioEstimado,
    subsidioEhTeto: subsidioEstimado > 0,
  };
}

/**
 * Calcula a capacidade de compra do perfil em TODAS as modalidades e elege a
 * melhor (maior valor máximo de imóvel entre as elegíveis).
 *
 * Regras (todas parametrizadas por `ParametrosFinanceiros`):
 * - parcelaMax = renda total × comprometimento máximo, onde renda total é a
 *   renda bruta FAMILIAR (titular + cônjuge + outros moradores) — é essa renda
 *   que também enquadra as faixas MCMV;
 * - prazo = min(prazo pela idade, prazo máximo da modalidade);
 * - financiável máximo pela inversa da parcela (Price/SAC conforme modalidade);
 * - capacidade limitada por LTV (ver derivação em `capacidadeDaModalidade`),
 *   pelo teto de valor efetivo (min(teto da faixa enquadrada, teto da
 *   modalidade), com sobrescrita por UF) e — quando o FGTS compõe a entrada —
 *   pelo teto SFH de uso do FGTS (`parametrosGerais.tetoValorImovelParaFgts`).
 */
export function calcularCapacidade(
  perfil: PerfilSonhometro,
  parametros: ParametrosFinanceiros,
): ResultadoSonhometro {
  exigirCentavosNaoNegativos(perfil.rendaMensal, "rendaMensal");
  if (perfil.rendaConjuge !== undefined) {
    exigirCentavosNaoNegativos(perfil.rendaConjuge, "rendaConjuge");
  }
  if (perfil.rendaOutrosMembros !== undefined) {
    exigirCentavosNaoNegativos(perfil.rendaOutrosMembros, "rendaOutrosMembros");
  }
  exigirCentavosNaoNegativos(perfil.fgts, "fgts");
  if (!Number.isInteger(perfil.dependentes) || perfil.dependentes < 0) {
    throw new RangeError(`dependentes deve ser inteiro >= 0 (recebido: ${perfil.dependentes})`);
  }

  const gerais = parametros.parametrosGerais;
  // Renda bruta FAMILIAR (todos os moradores) — base do MCMV (§6.3).
  const rendaTotal =
    perfil.rendaMensal + (perfil.rendaConjuge ?? 0) + (perfil.rendaOutrosMembros ?? 0);
  const idadeMeses = resolverIdadeMeses(perfil);
  const parcelaMax = parcelaMaximaPorRenda(rendaTotal, gerais.comprometimentoRendaMax);
  const prazoMax = prazoMaximoPorIdadeMeses(idadeMeses, gerais.idadeMaxMeses);

  const ctx: ContextoCalculo = {
    rendaTotal,
    fgts: perfil.fgts,
    idadeMeses,
    parcelaMax,
    uf: extrairUf(perfil.cidadeUF),
    gerais,
  };

  const porModalidade = MODALIDADES.map((modalidade) =>
    capacidadeDaModalidade(modalidade, parametros.modalidades[modalidade], ctx),
  );

  // Melhor = maior valorMaximoImovel entre elegíveis; empate mantém a
  // primeira na ordem de MODALIDADES (comparação estrita >).
  let melhor: CapacidadeModalidade | undefined;
  for (const cap of porModalidade) {
    if (cap.elegivel && (melhor === undefined || cap.valorMaximoImovel > melhor.valorMaximoImovel)) {
      melhor = cap;
    }
  }

  const entradaDisponivel =
    melhor !== undefined && parametros.modalidades[melhor.modalidade].permiteFgts
      ? perfil.fgts
      : 0;

  return {
    valorMaximoImovel: melhor?.valorMaximoImovel ?? 0,
    melhorModalidade: melhor?.modalidade,
    porModalidade,
    detalhamento: {
      parcelaMax,
      prazoMax,
      entradaDisponivel,
      comprometimentoUsado: gerais.comprometimentoRendaMax,
    },
    ehEstimativa: true,
  };
}
