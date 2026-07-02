// Coringa — motor DETERMINÍSTICO de estratégias de compra (ESCOPO.md §5.4/§6.4).
//
// "Não é CRM. Não é portal. É inteligência imobiliária." Dado o cenário do
// cliente (renda, FGTS, entrada, imóvel-alvo), gera e RANQUEIA estratégias
// variando alavancas (FGTS na entrada, aporte, modalidade, unidade, prazo,
// amortização) e reporta o impacto em parcela, total pago, prazo e viabilidade.
//
// Este módulo ORQUESTRA as funções puras de financiamento.ts — NÃO reimplementa
// matemática. Convenções (docs/ESCOPO.md §6):
// - Dinheiro em CENTAVOS; taxas em fração decimal.
// - NENHUM valor de negócio hard-coded: comprometimento, idadeMax, LTV, prazos,
//   taxas e tetos vêm de `ParametrosFinanceiros`.
// - Puro e testável; todo resultado é ESTIMATIVA (`ehEstimativa: true`).

import {
  type CenarioCalculado,
  type CenarioCoringa,
  type ConfigModalidade,
  type Estrategia,
  type FaixaModalidade,
  type ImovelCoringa,
  type Modalidade,
  type ParametrosFinanceiros,
  type ResultadoCoringa,
  type UnidadeCoringa,
} from "@imobia/domain";
import {
  cronogramaSAC,
  parcelaMaximaPorRenda,
  parcelaPrice,
  prazoMaximoPorIdadeMeses,
  taxaMensalDeAnual,
} from "./financiamento";
import { formatarReais } from "./modalidades";

function exigirCentavosNaoNegativos(valor: number, nome: string): void {
  if (!Number.isFinite(valor) || valor < 0) {
    throw new RangeError(`${nome} deve ser um valor não negativo em centavos (recebido: ${valor})`);
  }
}

/** Renda bruta FAMILIAR = titular + cônjuge (§6.3), base do comprometimento. */
function rendaTotalDe(cenario: CenarioCoringa): number {
  return cenario.rendaMensal + (cenario.rendaConjuge ?? 0);
}

interface ContextoCoringa {
  cenario: CenarioCoringa;
  rendaTotal: number;
  parcelaMax: number;
  parametros: ParametrosFinanceiros;
}

/**
 * Taxa EFETIVA anual da modalidade para a renda do cenário: a taxa da FAIXA
 * enquadrada (MCMV) sobrescreve a taxa padrão — mesma regra do Sonhômetro
 * (§6.3). Faixas ordenadas por rendaMensalAte; limite INCLUSIVO. Sem faixas ou
 * renda acima da última → taxa padrão da modalidade.
 */
function taxaAnualDaModalidade(config: ConfigModalidade, rendaTotal: number): number {
  if (config.faixas === undefined) {
    return config.taxaAnualEfetiva;
  }
  const faixa: FaixaModalidade | undefined = [...config.faixas]
    .sort((a, b) => a.rendaMensalAte - b.rendaMensalAte)
    .find((f) => rendaTotal <= f.rendaMensalAte);
  return faixa?.taxaAnualEfetiva ?? config.taxaAnualEfetiva;
}

/**
 * Calcula UM cenário de compra a partir de uma entrada total e uma modalidade.
 *
 * - financiado = max(0, valor − entradaTotal), respeitando o LTV efetivo
 *   (min(LTV da modalidade, LTV geral do sistema de amortização)): se a entrada
 *   for insuficiente (financiado > LTV·valor) o cenário é INVIÁVEL por LTV.
 * - prazo = min(prazo pela idade, prazo máximo da modalidade); `prazoForcado`
 *   sobrescreve (usado pela alavanca de prazo), sempre limitado a esse máximo.
 * - parcela via Price/SAC conforme `sistemaAmortizacaoPadrao` (SAC: 1ª parcela).
 * - totalPago = entrada + Σ parcelas (parcela×prazo p/ Price; soma real p/ SAC).
 * - comprometimentoPct = parcela / renda total.
 * - viavel = parcela ≤ parcelaMax E financiado ≤ LTV·valor.
 */
export function calcularCenario(
  entradaTotal: number,
  valorImovel: number,
  modalidade: Modalidade,
  usouFgts: boolean,
  ctx: ContextoCoringa,
  prazoForcado?: number,
): CenarioCalculado {
  const config = ctx.parametros.modalidades[modalidade];
  const gerais = ctx.parametros.parametrosGerais;
  const sistema = config.sistemaAmortizacaoPadrao;

  const prazoMax = prazoMaximoPorIdadeMeses(
    ctx.cenario.idadeMeses,
    gerais.idadeMaxMeses,
    config.prazoMaxMeses,
  );
  const prazoMeses =
    prazoForcado !== undefined ? Math.max(1, Math.min(prazoForcado, prazoMax)) : prazoMax;

  const entrada = Math.min(Math.max(0, Math.round(entradaTotal)), valorImovel);
  const valorFinanciado = Math.max(0, valorImovel - entrada);

  // LTV efetivo = min(LTV da modalidade, LTV geral do sistema) — o mais restritivo.
  const ltv = Math.min(config.ltvMax, gerais.ltvMax[sistema]);
  const financiadoMaxPorLtv = Math.floor(ltv * valorImovel);
  const respeitaLtv = valorFinanciado <= financiadoMaxPorLtv;

  const taxaMensal = taxaMensalDeAnual(taxaAnualDaModalidade(config, ctx.rendaTotal));

  let parcelaEstimada: number;
  let somaParcelas: number;
  if (valorFinanciado === 0 || prazoMeses < 1) {
    parcelaEstimada = 0;
    somaParcelas = 0;
  } else if (sistema === "price") {
    parcelaEstimada = parcelaPrice(valorFinanciado, taxaMensal, prazoMeses);
    somaParcelas = parcelaEstimada * prazoMeses;
  } else {
    const crono = cronogramaSAC(valorFinanciado, taxaMensal, prazoMeses);
    parcelaEstimada = crono.primeiraParcela;
    somaParcelas = crono.parcelas.reduce((acc, p) => acc + p, 0);
  }

  const totalPago = entrada + somaParcelas;
  const comprometimentoPct = ctx.rendaTotal > 0 ? parcelaEstimada / ctx.rendaTotal : Infinity;
  const viavel = prazoMeses >= 1 && parcelaEstimada <= ctx.parcelaMax && respeitaLtv;

  return {
    modalidade,
    entradaTotal: entrada,
    usouFgts,
    valorFinanciado,
    prazoMeses,
    parcelaEstimada,
    totalPago,
    comprometimentoPct,
    viavel,
  };
}

/** Constrói o objeto Estrategia calculando o impacto antes→depois. */
function montarEstrategia(
  id: string,
  tipo: Estrategia["tipo"],
  titulo: string,
  descricao: string,
  base: CenarioCalculado,
  novo: CenarioCalculado,
): Estrategia {
  const viabilizou = !base.viavel && novo.viavel;
  return {
    id,
    tipo,
    titulo,
    descricao,
    impacto: {
      parcelaAntes: base.parcelaEstimada,
      parcelaDepois: novo.parcelaEstimada,
      deltaParcela: novo.parcelaEstimada - base.parcelaEstimada,
      totalAntes: base.totalPago,
      totalDepois: novo.totalPago,
      deltaTotal: novo.totalPago - base.totalPago,
      prazoDepois: novo.prazoMeses,
    },
    viabilizou,
    ganho: 0, // atribuído no ranking
  };
}

/**
 * Uma estratégia é BENÉFICA vs. baseline quando VIABILIZA (baseline inviável →
 * viável) OU reduz a parcela OU o total pago. Estratégias que REDUZEM a parcela
 * de um baseline ainda inviável são úteis (aproximam da aprovação e o corretor
 * combina alavancas), então também entram — a viabilidade e a magnitude ficam a
 * cargo do RANKING (`ganho`). Nunca inclui estratégias sem efeito (delta 0 em
 * ambos), que pioram, ou cujo cenário resultante seja MENOS viável que o baseline.
 */
function ehBeneficia(base: CenarioCalculado, novo: CenarioCalculado): boolean {
  // Não regredir: se o baseline já é viável, o cenário novo também precisa ser.
  if (base.viavel && !novo.viavel) {
    return false;
  }
  if (!base.viavel && novo.viavel) {
    return true; // viabilizou
  }
  const reduzParcela = novo.parcelaEstimada < base.parcelaEstimada;
  const reduzTotal = novo.totalPago < base.totalPago;
  return reduzParcela || reduzTotal;
}

/**
 * Ganho para ranking: estratégias que VIABILIZAM vêm primeiro (peso dominante),
 * depois maior redução de parcela e, como desempate, maior economia total.
 * Compõe as três dimensões em um único escalar mantendo essa prioridade
 * lexicográfica (parcela pesa muito mais que total; viabilizar pesa acima de tudo).
 */
function calcularGanho(e: Estrategia): number {
  const reducaoParcela = Math.max(0, -e.impacto.deltaParcela);
  const economiaTotal = Math.max(0, -e.impacto.deltaTotal);
  const bonusViabilizou = e.viabilizou ? 1e15 : 0;
  return bonusViabilizou + reducaoParcela * 1e6 + economiaTotal;
}

/** Entrada mínima para viabilizar (parcela ≤ máx E LTV) via busca binária em centavos. */
function entradaMinimaViavel(
  valorImovel: number,
  modalidade: Modalidade,
  usouFgts: boolean,
  ctx: ContextoCoringa,
): { entrada: number; cenario: CenarioCalculado } | undefined {
  // Cheque de contorno: entrada = valorImovel (financiado 0) é sempre viável se
  // houver prazo. Se nem assim, não há solução.
  const teto = calcularCenario(valorImovel, valorImovel, modalidade, usouFgts, ctx);
  if (!teto.viavel) {
    return undefined;
  }
  let lo = 0;
  let hi = valorImovel;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const c = calcularCenario(mid, valorImovel, modalidade, usouFgts, ctx);
    if (c.viavel) {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }
  return { entrada: lo, cenario: calcularCenario(lo, valorImovel, modalidade, usouFgts, ctx) };
}

/**
 * Gera e ranqueia estratégias de compra para o cenário/imóvel dados.
 *
 * BASELINE: primeira modalidade elegível, entrada = recursos próprios (sem FGTS),
 * prazo padrão (máximo pela idade/modalidade).
 *
 * ALAVANCAS (cada uma gera 0..1 estratégia SE aplicável E benéfica):
 *  1. fgts_entrada — FGTS na entrada (se fgts>0 e modalidade permiteFgts).
 *  2. aumentar_entrada — aporte próprio mínimo p/ viabilizar (baseline inviável)
 *     ou p/ eliminar o financiamento (baseline viável, reduz total a 0 juros).
 *  3. trocar_modalidade — melhor OUTRA modalidade elegível que melhora/viabiliza.
 *  4. trocar_unidade — unidade mais barata que reduz parcela/viabiliza.
 *  5. ajustar_prazo — estende p/ viabilizar (inviável) ou encurta p/ reduzir
 *     juros totais mantendo a parcela ≤ máx (viável com folga).
 *  6. amortizar — ilustrativa: aporte no saldo devedor reduz total/prazo.
 *
 * RANKING (`ganho`): viabilizadoras no topo, depois maior redução de parcela,
 * depois maior economia total. Desc por `ganho`. Sem estratégias neutras/piores.
 */
export function gerarEstrategias(
  cenario: CenarioCoringa,
  imovel: ImovelCoringa,
  parametros: ParametrosFinanceiros,
): ResultadoCoringa {
  exigirCentavosNaoNegativos(cenario.rendaMensal, "rendaMensal");
  if (cenario.rendaConjuge !== undefined) {
    exigirCentavosNaoNegativos(cenario.rendaConjuge, "rendaConjuge");
  }
  exigirCentavosNaoNegativos(cenario.fgts, "fgts");
  exigirCentavosNaoNegativos(cenario.entradaPropria, "entradaPropria");
  exigirCentavosNaoNegativos(imovel.valorImovel, "valorImovel");
  if (!Number.isFinite(cenario.idadeMeses) || cenario.idadeMeses < 0) {
    throw new RangeError(`idadeMeses deve ser >= 0 (recebido: ${cenario.idadeMeses})`);
  }
  if (imovel.modalidadesElegiveis.length === 0) {
    throw new RangeError("imóvel sem modalidades elegíveis: nada a otimizar");
  }

  const rendaTotal = rendaTotalDe(cenario);
  const parcelaMax = parcelaMaximaPorRenda(
    rendaTotal,
    parametros.parametrosGerais.comprometimentoRendaMax,
  );
  const ctx: ContextoCoringa = { cenario, rendaTotal, parcelaMax, parametros };

  // BASELINE: primeira modalidade elegível, entrada própria (sem FGTS).
  const modalidadeBase = imovel.modalidadesElegiveis[0]!;
  const baseline = calcularCenario(
    cenario.entradaPropria,
    imovel.valorImovel,
    modalidadeBase,
    false,
    ctx,
  );

  const estrategias: Estrategia[] = [];
  const permiteFgtsBase = parametros.modalidades[modalidadeBase].permiteFgts;

  // 1. FGTS na entrada.
  if (cenario.fgts > 0 && permiteFgtsBase) {
    const comFgts = calcularCenario(
      cenario.entradaPropria + cenario.fgts,
      imovel.valorImovel,
      modalidadeBase,
      true,
      ctx,
    );
    if (ehBeneficia(baseline, comFgts)) {
      const acao = comFgts.viavel && !baseline.viavel ? "viabiliza a compra e leva" : "leva";
      estrategias.push(
        montarEstrategia(
          "fgts_entrada",
          "fgts_entrada",
          "Use o FGTS na entrada",
          `Use o FGTS de ${formatarReais(cenario.fgts)} na entrada: ${acao} a parcela de ` +
            `${formatarReais(baseline.parcelaEstimada)} para ${formatarReais(comFgts.parcelaEstimada)}.`,
          baseline,
          comFgts,
        ),
      );
    }
  }

  // 2. Aumentar a entrada com recursos próprios.
  {
    let alvo: { entrada: number; cenario: CenarioCalculado } | undefined;
    if (!baseline.viavel) {
      // Entrada mínima (própria) para viabilizar.
      alvo = entradaMinimaViavel(imovel.valorImovel, modalidadeBase, false, ctx);
    } else if (baseline.valorFinanciado > 0) {
      // Viável: quitar à vista elimina os juros (menor total possível).
      alvo = {
        entrada: imovel.valorImovel,
        cenario: calcularCenario(imovel.valorImovel, imovel.valorImovel, modalidadeBase, false, ctx),
      };
    }
    if (alvo !== undefined && ehBeneficia(baseline, alvo.cenario)) {
      const acrescimo = Math.max(0, alvo.entrada - cenario.entradaPropria);
      const efeito = alvo.cenario.viavel && !baseline.viavel
        ? `viabiliza a compra: a parcela vai para ${formatarReais(alvo.cenario.parcelaEstimada)}`
        : `a parcela cai para ${formatarReais(alvo.cenario.parcelaEstimada)} e o total pago para ${formatarReais(alvo.cenario.totalPago)}`;
      estrategias.push(
        montarEstrategia(
          "aumentar_entrada",
          "aumentar_entrada",
          "Aumente a entrada",
          `Acrescente ${formatarReais(acrescimo)} de entrada: ${efeito}.`,
          baseline,
          alvo.cenario,
        ),
      );
    }
  }

  // 3. Trocar de modalidade — melhor OUTRA modalidade elegível.
  {
    let melhor: { modalidade: Modalidade; cenario: CenarioCalculado } | undefined;
    for (const modalidade of imovel.modalidadesElegiveis) {
      if (modalidade === modalidadeBase) {
        continue;
      }
      const usaFgts = baseline.usouFgts && parametros.modalidades[modalidade].permiteFgts;
      const c = calcularCenario(cenario.entradaPropria, imovel.valorImovel, modalidade, usaFgts, ctx);
      if (!ehBeneficia(baseline, c)) {
        continue;
      }
      if (
        melhor === undefined ||
        c.parcelaEstimada < melhor.cenario.parcelaEstimada ||
        (c.parcelaEstimada === melhor.cenario.parcelaEstimada &&
          c.totalPago < melhor.cenario.totalPago)
      ) {
        melhor = { modalidade, cenario: c };
      }
    }
    if (melhor !== undefined) {
      const acao =
        melhor.cenario.viavel && !baseline.viavel ? "viabiliza a compra e a parcela vai" : "a parcela vai";
      estrategias.push(
        montarEstrategia(
          "trocar_modalidade",
          "trocar_modalidade",
          "Troque de modalidade",
          `Enquadrando em ${melhor.modalidade.toUpperCase()}, ${acao} para ` +
            `${formatarReais(melhor.cenario.parcelaEstimada)}.`,
          baseline,
          melhor.cenario,
        ),
      );
    }
  }

  // 4. Trocar de unidade — a mais barata que melhora/viabiliza.
  if (imovel.unidades !== undefined && imovel.unidades.length > 0) {
    const atual: UnidadeCoringa | undefined =
      imovel.unidades.find((u) => u.id === imovel.unidadeAtualId);
    const identificadorAtual = atual?.identificador ?? "atual";

    let melhor: { unidade: UnidadeCoringa; cenario: CenarioCalculado } | undefined;
    for (const unidade of imovel.unidades) {
      if (unidade.id === imovel.unidadeAtualId) {
        continue;
      }
      // Só considera unidades MAIS BARATAS que o imóvel-alvo atual.
      if (unidade.valor >= imovel.valorImovel) {
        continue;
      }
      const c = calcularCenario(cenario.entradaPropria, unidade.valor, modalidadeBase, false, ctx);
      if (!ehBeneficia(baseline, c)) {
        continue;
      }
      if (
        melhor === undefined ||
        c.parcelaEstimada < melhor.cenario.parcelaEstimada ||
        (c.parcelaEstimada === melhor.cenario.parcelaEstimada &&
          c.totalPago < melhor.cenario.totalPago)
      ) {
        melhor = { unidade, cenario: c };
      }
    }
    if (melhor !== undefined) {
      const economia = Math.max(0, baseline.parcelaEstimada - melhor.cenario.parcelaEstimada);
      const acao =
        melhor.cenario.viavel && !baseline.viavel
          ? `viabiliza a compra: parcela de ${formatarReais(melhor.cenario.parcelaEstimada)}`
          : `economize ${formatarReais(economia)} na parcela`;
      estrategias.push(
        montarEstrategia(
          "trocar_unidade",
          "trocar_unidade",
          "Troque de unidade",
          `Troque da unidade ${identificadorAtual} para a ${melhor.unidade.identificador} e ${acao}.`,
          baseline,
          melhor.cenario,
        ),
      );
    }
  }

  // 5. Ajustar prazo.
  {
    const config = parametros.modalidades[modalidadeBase];
    const prazoMax = prazoMaximoPorIdadeMeses(
      cenario.idadeMeses,
      parametros.parametrosGerais.idadeMaxMeses,
      config.prazoMaxMeses,
    );
    let alvo: CenarioCalculado | undefined;
    if (!baseline.viavel && baseline.prazoMeses < prazoMax) {
      // Estender ao máximo para tentar viabilizar (parcela cai com prazo maior).
      alvo = calcularCenario(cenario.entradaPropria, imovel.valorImovel, modalidadeBase, false, ctx, prazoMax);
    } else if (baseline.viavel && baseline.valorFinanciado > 0) {
      // Viável: menor prazo cuja parcela ainda cabe no comprometimento → menos juros.
      const menor = menorPrazoViavel(cenario.entradaPropria, imovel.valorImovel, modalidadeBase, ctx, baseline.prazoMeses);
      if (menor !== undefined && menor.prazoMeses < baseline.prazoMeses) {
        alvo = menor;
      }
    }
    if (alvo !== undefined && ehBeneficia(baseline, alvo)) {
      const encurtou = alvo.prazoMeses < baseline.prazoMeses;
      const descricao = encurtou
        ? `Encurte o prazo para ${alvo.prazoMeses} meses: você economiza ${formatarReais(Math.max(0, baseline.totalPago - alvo.totalPago))} em juros (a parcela sobe para ${formatarReais(alvo.parcelaEstimada)}, ainda dentro do limite).`
        : `Estenda o prazo para ${alvo.prazoMeses} meses: viabiliza a compra com parcela de ${formatarReais(alvo.parcelaEstimada)}.`;
      estrategias.push(
        montarEstrategia(
          "ajustar_prazo",
          "ajustar_prazo",
          encurtou ? "Encurte o prazo" : "Estenda o prazo",
          descricao,
          baseline,
          alvo,
        ),
      );
    }
  }

  // 6. Amortizar — ilustrativa. Um aporte no saldo devedor equivale a financiar
  // menos: reaproveitamos calcularCenario com entrada = própria + aporte para uma
  // ESTIMATIVA consistente do efeito em total pago e (encurtando prazo) juros.
  if (baseline.viavel && baseline.valorFinanciado > 0) {
    // Aporte ilustrativo = FGTS disponível, senão 10% do financiado.
    const aporte = cenario.fgts > 0 ? cenario.fgts : Math.round(baseline.valorFinanciado * 0.1);
    if (aporte > 0) {
      const comAmortizacao = calcularCenario(
        cenario.entradaPropria + aporte,
        imovel.valorImovel,
        modalidadeBase,
        cenario.fgts > 0,
        ctx,
      );
      if (ehBeneficia(baseline, comAmortizacao)) {
        const reducaoTotal = Math.max(0, baseline.totalPago - comAmortizacao.totalPago);
        const reducaoParcela = Math.max(0, baseline.parcelaEstimada - comAmortizacao.parcelaEstimada);
        estrategias.push(
          montarEstrategia(
            "amortizar",
            "amortizar",
            "Amortize o saldo",
            `Uma amortização de ${formatarReais(aporte)} no saldo reduz cerca de ${formatarReais(reducaoParcela)} na parcela e ${formatarReais(reducaoTotal)} no total pago.`,
            baseline,
            comAmortizacao,
          ),
        );
      }
    }
  }

  // RANKING: ganho desc (viabilizadoras no topo, depois parcela, depois total).
  for (const e of estrategias) {
    e.ganho = calcularGanho(e);
  }
  estrategias.sort((a, b) => b.ganho - a.ganho);

  return { baseline, estrategias, ehEstimativa: true };
}

/**
 * Menor prazo (≤ prazoAtual) cuja parcela ainda cabe no comprometimento máximo —
 * busca binária. Menos meses = menos juros totais. `undefined` se nem o próprio
 * prazoAtual couber (não deveria ocorrer quando o baseline é viável).
 */
function menorPrazoViavel(
  entradaTotal: number,
  valorImovel: number,
  modalidade: Modalidade,
  ctx: ContextoCoringa,
  prazoAtual: number,
): CenarioCalculado | undefined {
  const noPrazoAtual = calcularCenario(entradaTotal, valorImovel, modalidade, false, ctx, prazoAtual);
  if (!noPrazoAtual.viavel) {
    return undefined;
  }
  let lo = 1;
  let hi = prazoAtual;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const c = calcularCenario(entradaTotal, valorImovel, modalidade, false, ctx, mid);
    if (c.viavel) {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }
  return calcularCenario(entradaTotal, valorImovel, modalidade, false, ctx, lo);
}
