// Termômetro de lead scoring (ESCOPO.md §5.3; H-5.3).
//
// Classifica a INTENÇÃO DE COMPRA de um cliente a partir dos seus sinais de
// comportamento agregados (`SinaisLead`). Lógica PURA e TESTÁVEL — vive no motor
// (@mobia/core), NUNCA em SQL nem na UI. A camada de dados só agrega as
// contagens de eventos e chama `calcularTemperatura`.
//
// MODELO (documentado e parametrizável):
//
// 1) SCORE = soma ponderada dos sinais. Os pesos refletem a força de cada sinal
//    como indicador de intenção (ESCOPO §5.3: "frequência de visitas,
//    profundidade de simulação, favoritos, e ações de alto valor"):
//      - clique_financiamento é a AÇÃO DE MAIOR VALOR (intenção de fechar) → peso máximo;
//      - simulacoes (profundidade) e retornos (recorrência) pesam mais que visitas;
//      - favoritos ficam no meio (interesse declarado, mas passivo);
//      - visitas são o sinal mais fraco (curiosidade).
//
// 2) TEMPERATURA = faixa do score, com um ATALHO por intenção forte:
//      - quente:              score  <  LIMIAR_MUITO_QUENTE
//      - muito_quente:        LIMIAR_MUITO_QUENTE <= score < LIMIAR_PRONTO
//      - pronto_para_compra:  score >= LIMIAR_PRONTO
//    ATALHO: qualquer clique em financiamento OU >= SIMULACOES_PARA_PRONTO
//    simulações leva direto a 'pronto_para_compra', independentemente do score —
//    são sinais inequívocos de que o cliente está no fundo do funil.
//
// Todas as constantes são exportadas para tuning futuro (ver PESOS_TERMOMETRO,
// LIMIARES_TERMOMETRO). Ajustá-las NÃO exige tocar na lógica nem nos testes de
// monotonicidade — apenas nos testes de fronteira, que derivam dos limiares.

import type { SinaisLead, Temperatura } from "@mobia/domain";

/**
 * Pesos de cada sinal na soma do score. Escolhidos de modo que:
 *   clique_financiamento (10) > simulacoes (5) > retornos (4) > favoritos (3) > visitas (1).
 * Ajustáveis sem alterar a lógica de classificação.
 */
export const PESOS_TERMOMETRO = {
  visitas: 1,
  favoritos: 3,
  retornos: 4,
  simulacoes: 5,
  cliquesFinanciamento: 10,
} as const;

/**
 * Limiares de score e atalhos por intenção forte.
 *
 * - muitoQuente / pronto: fronteiras INCLUSIVAS por baixo (score >= limiar).
 *   Com os pesos padrão, `muitoQuente = 6` é atingido, por ex., por 2 visitas +
 *   1 favorito + 1 simulação? não — por 3 favoritos, ou 1 simulação + 1 visita,
 *   etc.; `pronto = 12` exige acúmulo relevante OU o atalho abaixo.
 * - simulacoesParaPronto: nº de simulações que, por si só, força
 *   'pronto_para_compra' (profundidade de simulação = alta intenção).
 * - cliqueFinanciamentoForcaPronto: um único clique em financiamento força
 *   'pronto_para_compra' (ação de maior valor).
 */
export const LIMIARES_TERMOMETRO = {
  /** score >= este valor ⇒ ao menos 'muito_quente'. */
  muitoQuente: 6,
  /** score >= este valor ⇒ 'pronto_para_compra'. */
  pronto: 12,
  /** >= este nº de simulações ⇒ atalho para 'pronto_para_compra'. */
  simulacoesParaPronto: 3,
  /** >= 1 clique em financiamento ⇒ atalho para 'pronto_para_compra'. */
  cliqueFinanciamentoForcaPronto: true,
} as const;

/** Resultado do termômetro: temperatura classificada + score bruto (para depuração/ordenação). */
export interface ResultadoTermometro {
  temperatura: Temperatura;
  /** Soma ponderada dos sinais (inteiro >= 0). Ordenável entre leads. */
  score: number;
}

function exigirInteiroNaoNegativo(valor: number, nome: string): void {
  if (!Number.isInteger(valor) || valor < 0) {
    throw new RangeError(`${nome} deve ser inteiro >= 0 (recebido: ${valor})`);
  }
}

/**
 * Calcula a temperatura do lead a partir dos seus sinais agregados.
 *
 * O `score` é monotônico: aumentar qualquer sinal nunca reduz o score (todos os
 * pesos são positivos). A `temperatura` também é monotônica não-decrescente no
 * score (faixas crescentes) e nos atalhos (só ELEVAM a temperatura).
 *
 * @throws RangeError se algum sinal não for inteiro >= 0.
 */
export function calcularTemperatura(sinais: SinaisLead): ResultadoTermometro {
  exigirInteiroNaoNegativo(sinais.visitas, "visitas");
  exigirInteiroNaoNegativo(sinais.simulacoes, "simulacoes");
  exigirInteiroNaoNegativo(sinais.favoritos, "favoritos");
  exigirInteiroNaoNegativo(sinais.cliquesFinanciamento, "cliquesFinanciamento");
  exigirInteiroNaoNegativo(sinais.retornos, "retornos");

  const score =
    sinais.visitas * PESOS_TERMOMETRO.visitas +
    sinais.favoritos * PESOS_TERMOMETRO.favoritos +
    sinais.retornos * PESOS_TERMOMETRO.retornos +
    sinais.simulacoes * PESOS_TERMOMETRO.simulacoes +
    sinais.cliquesFinanciamento * PESOS_TERMOMETRO.cliquesFinanciamento;

  // Atalho por intenção forte: ação de maior valor OU profundidade de simulação.
  const intencaoForte =
    (LIMIARES_TERMOMETRO.cliqueFinanciamentoForcaPronto && sinais.cliquesFinanciamento >= 1) ||
    sinais.simulacoes >= LIMIARES_TERMOMETRO.simulacoesParaPronto;

  let temperatura: Temperatura;
  if (intencaoForte || score >= LIMIARES_TERMOMETRO.pronto) {
    temperatura = "pronto_para_compra";
  } else if (score >= LIMIARES_TERMOMETRO.muitoQuente) {
    temperatura = "muito_quente";
  } else {
    temperatura = "quente";
  }

  return { temperatura, score };
}
