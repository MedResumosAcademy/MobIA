// Snapshot SEED de ParametrosFinanceiros + seleção por vigência (H-05).
//
// Convenções (docs/ESCOPO.md §6.1, §6.3, §7):
// - Dinheiro em CENTAVOS (`Centavos`), taxas em fração decimal (`Taxa`).
// - NENHUM valor de negócio hard-coded no motor de cálculo: este módulo é a
//   FONTE dos valores (tabela versionada) — o motor só consome via parâmetro.
// - Cada valor traz comentário com FONTE + data. Valores não confirmados em
//   fonte razoável estão marcados com "// A VALIDAR" (e, por modalidade, com
//   `condicoesAValidar: true` para a UI exibir aviso reforçado/bloquear).
// - Toda simulação derivada destes parâmetros é ESTIMATIVA, não proposta formal.
//
// SEMÂNTICA DE TAXA: os campos `taxaAnualEfetiva` guardam taxa EFETIVA anual
// (convenção do repo: mensal = (1+i)^(1/12)−1). As fontes (Caixa, portarias
// MCMV) divulgam taxa NOMINAL a.a. com capitalização mensal (mensal = n/12);
// a conversão nominal→efetiva é feita AQUI, ao gravar o snapshot, via
// `taxaAnualEfetivaDeNominal` — o valor nominal de origem fica no comentário.
//
// H-05 ("atualizar sem deploy"): PARAMETROS_2026_07 é apenas o SEED — dado
// inicial a migrar para a tabela `parametros_financeiros` na história de
// persistência. Os apps NÃO devem importar a constante diretamente: usar
// `obterParametrosAtuais()` (ponto único a trocar pela fonte externa/DB).

import type { FaixaModalidade, ParametrosFinanceiros } from "@mobia/domain";
import { taxaAnualEfetivaDeNominal } from "./financiamento";

/**
 * Faixas MCMV urbanas vigentes em 2026 (atualização do programa de abr/2026).
 * FONTE: Ministério das Cidades (gov.br, notícias MCMV abr/2026) e imprensa
 * especializada (Tenda/blog atualizado 2026-05-25; ISTOÉ Dinheiro 2026;
 * CNN Brasil 2026). Consultado em 2026-07-01.
 *
 * Nota de modelagem: onde a fonte traz intervalo (por região / porte de
 * município / cotista FGTS), adotamos o limite SUPERIOR (estimativa
 * conservadora nas taxas; nos tetos, o valor que menos restringe).
 */
const FAIXAS_MCMV_2026: FaixaModalidade[] = [
  {
    // Faixa 1 — renda até R$ 3.200/mês.
    // FONTE: Ministério das Cidades / Agência Brasil, abr/2026 (limite subiu de R$ 2.850).
    rendaMensalAte: 320_000,
    // Taxa NOMINAL 4,00% a.a. (N/NE) a 4,25% a.a. (S/SE/CO) — adotado o teto
    // 4,25% nominal, convertido para efetiva. FONTE: gov.br / Tenda blog, abr–mai/2026.
    taxaAnualEfetiva: taxaAnualEfetivaDeNominal(0.0425),
    // Subsídio de ATÉ R$ 55 mil (até R$ 65 mil na região Norte — granularidade
    // regional não representável no schema atual). Decresce com a renda — o
    // motor sinaliza `subsidioEhTeto`. FONTE: gov.br / CNN Brasil, 2026.
    subsidioMax: 5_500_000,
    tetoValorImovel: {
      // Teto F1/F2: R$ 210 mil a R$ 275 mil conforme porte do município —
      // adotado o teto superior R$ 275 mil. FONTE: gov.br (MCMV abr/2026).
      // Granularidade por porte de município não representável. // A VALIDAR
      padrao: 27_500_000,
    },
  },
  {
    // Faixa 2 — renda de R$ 3.200,01 a R$ 5.000/mês.
    // FONTE: Ministério das Cidades, abr/2026.
    rendaMensalAte: 500_000,
    // Taxa NOMINAL 5,00%–7,00% a.a. conforme região e cotista FGTS — adotado o
    // teto 7,00% nominal, convertido. FONTE: Ministério das Cidades, abr/2026.
    taxaAnualEfetiva: taxaAnualEfetivaDeNominal(0.07),
    // Subsídio de ATÉ R$ 55 mil (mesmo teto da Faixa 1 na regra 2026).
    // FONTE: Tenda blog (2026-05-25); algumas fontes citam R$ 35 mil. // A VALIDAR
    subsidioMax: 5_500_000,
    tetoValorImovel: {
      // Mesmo teto F1/F2 (R$ 210–275 mil por porte; adotado R$ 275 mil).
      // FONTE: gov.br (MCMV abr/2026).
      padrao: 27_500_000,
    },
  },
  {
    // Faixa 3 — renda de R$ 5.000,01 a R$ 9.600/mês.
    // FONTE: Ministério das Cidades, abr/2026.
    rendaMensalAte: 960_000,
    // Taxa NOMINAL 7,66%–8,16% a.a. — adotado o teto 8,16% nominal, convertido.
    // FONTE: ISTOÉ Dinheiro / Tenda blog, 2026.
    taxaAnualEfetiva: taxaAnualEfetivaDeNominal(0.0816),
    // Sem subsídio direto na Faixa 3. FONTE: Tenda blog (2026-05-25).
    subsidioMax: 0,
    tetoValorImovel: {
      // Teto da Faixa 3: R$ 400 mil. FONTE: gov.br (MCMV abr/2026).
      padrao: 40_000_000,
    },
  },
  {
    // Faixa 4 ("classe média") — renda de R$ 9.600,01 a R$ 13.000/mês.
    // FONTE: Ministério das Cidades, abr/2026 (renda subiu de R$ 12 mil para R$ 13 mil).
    rendaMensalAte: 1_300_000,
    // Taxa NOMINAL 10% a.a., convertida para efetiva.
    // FONTE: Ministério das Cidades / ISTOÉ Dinheiro, abr/2026.
    taxaAnualEfetiva: taxaAnualEfetivaDeNominal(0.1),
    // Sem subsídio direto na Faixa 4. FONTE: gov.br, abr/2026.
    subsidioMax: 0,
    // Teto da Faixa 4 = teto do programa (R$ 600 mil) — vale o da modalidade.
  },
];

/**
 * Snapshot SEED vigente a partir de 2026-07-01 (versão 1).
 *
 * Fontes principais (consultadas em 2026-07-01):
 * - MCMV: Ministério das Cidades (gov.br), atualização do programa de abr/2026.
 * - SBPE/Caixa: taxa balcão a partir de TR + 11,19% a.a. (nominal) em 2026;
 *   cota de financiamento de volta a 80% (SAC) / 70% (Price) no novo modelo de
 *   crédito (InfoMoney / imprensa especializada, jan–mar/2026).
 * - Teto SFH elevado pelo CMN para R$ 2,25 mi (out/2025); FGTS utilizável só
 *   até esse valor (CMN out/2025 + Conselho Curador FGTS nov/2025) —
 *   parametrizado em `parametrosGerais.tetoValorImovelParaFgts`.
 * - Regras gerais Caixa: comprometimento de renda ~30%; idade + prazo ≤ 80 anos
 *   e 6 meses (966 meses); prazo máximo 420 meses.
 *
 * ATENÇÃO (TR): as taxas de mercado (sbpe, imovel_novo, imovel_usado,
 * terreno_e_construcao) são a parte PREFIXADA de contratos "TR + x% a.a.".
 * O motor NÃO soma a TR (`indexador: "tr"` é informativo) — com TR positiva,
 * parcela e custo total reais serão MAIORES que o simulado (ver AVISO_ESTIMATIVA).
 */
export const PARAMETROS_2026_07: ParametrosFinanceiros = {
  versao: 1,
  vigenciaInicio: "2026-07-01",
  fonte:
    "Ministério das Cidades (MCMV abr/2026), Caixa/imprensa especializada (SBPE 2026), CMN out/2025 + Conselho Curador FGTS nov/2025 (teto SFH/FGTS)",
  parametrosGerais: {
    // Comprometimento máximo de renda na parcela: 30% da renda bruta familiar.
    // FONTE: regra usual Caixa/MCMV (regenteimoveis.com.br, abr/2026).
    comprometimentoRendaMax: 0.3,
    // Idade máxima ao fim do contrato: 80 anos e 6 meses = 966 meses.
    // FONTE: regra pública Caixa (idade + prazo ≤ 80a6m).
    idadeMaxMeses: 966,
    ltvMax: {
      // Cota máxima 70% na Tabela Price. FONTE: Caixa/imprensa (spimovel), 2026.
      price: 0.7,
      // Cota máxima 80% no SAC (retorno da cota 80% no novo modelo de crédito
      // de 2026). FONTE: InfoMoney / Caixa Notícias, out/2025–2026.
      sac: 0.8,
    },
    // FGTS só pode ser usado em imóveis de até R$ 2,25 mi (teto SFH).
    // FONTE: CMN out/2025 + Conselho Curador FGTS nov/2025.
    tetoValorImovelParaFgts: 225_000_000,
  },
  modalidades: {
    mcmv: {
      // Taxa default = pior caso (Faixa 4, nominal 10% a.a.); faixas sobrescrevem.
      // FONTE: Ministério das Cidades, abr/2026.
      taxaAnualEfetiva: taxaAnualEfetivaDeNominal(0.1),
      indexador: "nenhum",
      // Prazo máximo de 420 meses (35 anos). FONTE: Caixa/regenteimoveis, 2026.
      prazoMaxMeses: 420,
      // Cota máxima 80% (SAC). FONTE: InfoMoney/Caixa, 2026.
      ltvMax: 0.8,
      tetoValorImovel: {
        // Teto do programa = teto da Faixa 4: R$ 600 mil (subiu de R$ 500 mil).
        // Tetos menores por faixa (F1/F2/F3) estão em FAIXAS_MCMV_2026 — o
        // motor aplica min(teto da faixa, teto da modalidade).
        // FONTE: Ministério das Cidades, abr/2026.
        padrao: 60_000_000,
      },
      faixas: FAIXAS_MCMV_2026,
      // FGTS admitido como entrada/amortização no MCMV. FONTE: Caixa, 2026.
      permiteFgts: true,
      sistemaAmortizacaoPadrao: "sac",
    },
    sbpe: {
      // Taxa balcão Caixa 2026: a partir de TR + 11,19% a.a. NOMINAL (grandes
      // bancos entre 11,3% e 11,8% em fev–mar/2026), convertida para efetiva.
      // TR NÃO incluída na simulação. FONTE: spimovel/larya, 2026.
      taxaAnualEfetiva: taxaAnualEfetivaDeNominal(0.1119),
      indexador: "tr",
      // Prazo máximo de 420 meses. FONTE: Caixa (larya), 2026.
      prazoMaxMeses: 420,
      // Cota máxima 80% no SAC. FONTE: InfoMoney, 2026.
      ltvMax: 0.8,
      // Sem teto de valor no SBPE; o teto SFH (R$ 2,25 mi) rege apenas o uso do
      // FGTS — parametrizado em parametrosGerais.tetoValorImovelParaFgts.
      // FONTE: InfoMoney/CMN, out/2025.
      permiteFgts: true,
      sistemaAmortizacaoPadrao: "sac",
    },
    credito_associativo: {
      // Apoio à Produção (GERIC): recursos FGTS, condições alinhadas às faixas
      // MCMV. Taxa default = teto Faixa 3 (nominal 8,16%). // A VALIDAR
      taxaAnualEfetiva: taxaAnualEfetivaDeNominal(0.0816),
      indexador: "nenhum",
      prazoMaxMeses: 420, // Mesmo prazo das linhas FGTS/Caixa. // A VALIDAR
      ltvMax: 0.8, // Cota típica das linhas FGTS. // A VALIDAR
      tetoValorImovel: {
        // Segue os tetos do MCMV (R$ 600 mil, teto do programa). // A VALIDAR
        padrao: 60_000_000,
      },
      // Mesmas faixas de renda do MCMV (linha operada com recursos FGTS). // A VALIDAR
      faixas: FAIXAS_MCMV_2026,
      permiteFgts: true,
      sistemaAmortizacaoPadrao: "sac",
      // Condições copiadas do MCMV por suposição, SEM fonte própria — obter as
      // condições reais do Apoio à Produção/GERIC (ESCOPO §6.4). // A VALIDAR
      condicoesAValidar: true,
    },
    imovel_novo: {
      // Imóvel novo fora do MCMV: condições SBPE (TR + 11,19% a.a. nominal).
      // FONTE: spimovel, 2026.
      taxaAnualEfetiva: taxaAnualEfetivaDeNominal(0.1119),
      indexador: "tr",
      prazoMaxMeses: 420, // FONTE: Caixa (larya), 2026.
      // Cota 80% para imóvel novo (SAC). FONTE: InfoMoney, 2026.
      ltvMax: 0.8,
      permiteFgts: true, // FGTS até o teto SFH. FONTE: CMN, out/2025.
      sistemaAmortizacaoPadrao: "sac",
    },
    imovel_usado: {
      // Usado na Caixa em 2026 opera na MESMA taxa balcão SBPE (a partir de
      // TR + 11,19% a.a. nominal) — spread anterior de +0,30 p.p. removido por
      // não ter confirmação em fonte. FONTE: pesquisa Caixa/larya, 2026.
      taxaAnualEfetiva: taxaAnualEfetivaDeNominal(0.1119),
      indexador: "tr",
      prazoMaxMeses: 420, // FONTE: larya (guia usado Caixa), 2026.
      // Caixa voltou a financiar 80% do valor de avaliação do usado (SBPE/SAC)
      // em 2026 (antes 70%). FONTE: InfoMoney / larya, 2026.
      ltvMax: 0.8,
      permiteFgts: true, // Entrada pode ser coberta com FGTS. FONTE: larya, 2026.
      sistemaAmortizacaoPadrao: "sac",
    },
    terreno_e_construcao: {
      // Aquisição de terreno + construção: taxa acima do balcão padrão
      // (nominal 11,99% a.a.) — número NÃO confirmado em fonte. // A VALIDAR
      taxaAnualEfetiva: taxaAnualEfetivaDeNominal(0.1199),
      indexador: "tr",
      prazoMaxMeses: 420, // A VALIDAR
      ltvMax: 0.8, // Cota típica sobre terreno + orçamento de obra. // A VALIDAR
      permiteFgts: true, // FGTS admitido em construção. // A VALIDAR
      sistemaAmortizacaoPadrao: "sac",
      // Condições estimadas SEM fonte — validar com planilha de simulação
      // habitacional Caixa (ESCOPO §6.4). // A VALIDAR
      condicoesAValidar: true,
    },
  },
};

/**
 * Histórico SEED de snapshots (a migrar para a tabela `parametros_financeiros`).
 * Enquanto a persistência (H-05) não existe, é a fonte de `obterParametrosAtuais`.
 */
export const HISTORICO_PARAMETROS: readonly ParametrosFinanceiros[] = [PARAMETROS_2026_07];

/**
 * Seleciona o snapshot de parâmetros vigente em `data` (ISO YYYY-MM-DD):
 * o de vigência mais recente cujo `vigenciaInicio` seja ≤ `data`.
 *
 * Datas ISO comparam corretamente como string (ordem lexicográfica).
 * Lança RangeError se nenhum snapshot estiver vigente na data.
 */
export function obterParametrosVigentes(
  data: string,
  historico: readonly ParametrosFinanceiros[],
): ParametrosFinanceiros {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    throw new RangeError(`data deve estar no formato ISO YYYY-MM-DD (recebido: ${data})`);
  }

  let vigente: ParametrosFinanceiros | undefined;
  for (const snapshot of historico) {
    if (snapshot.vigenciaInicio > data) {
      continue;
    }
    if (
      vigente === undefined ||
      snapshot.vigenciaInicio > vigente.vigenciaInicio ||
      (snapshot.vigenciaInicio === vigente.vigenciaInicio && snapshot.versao > vigente.versao)
    ) {
      vigente = snapshot;
    }
  }

  if (vigente === undefined) {
    throw new RangeError(`nenhum snapshot de parâmetros vigente em ${data}`);
  }
  return vigente;
}

/**
 * Ponto ÚNICO de acesso dos apps aos parâmetros vigentes (H-05): hoje resolve
 * sobre o HISTORICO_PARAMETROS embarcado (seed); quando a persistência entrar,
 * esta função passa a carregar o snapshot do banco/config SEM tocar na UI.
 */
export function obterParametrosAtuais(
  data: string = new Date().toISOString().slice(0, 10),
): ParametrosFinanceiros {
  return obterParametrosVigentes(data, HISTORICO_PARAMETROS);
}
