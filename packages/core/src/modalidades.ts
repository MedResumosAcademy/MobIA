// Enquadramento de modalidades (H-06): dado um perfil resumido e um imóvel
// resumido, decide — de forma DETERMINÍSTICA e totalmente orientada por
// `ParametrosFinanceiros` — em quais modalidades o cenário se enquadra.
//
// Convenções (docs/ESCOPO.md §6.1):
// - NENHUM valor de negócio hard-coded: faixas de renda e tetos de valor vêm
//   da config de cada modalidade. O que é estrutural (ex.: "imovel_usado exige
//   imóvel usado") é semântica do vocabulário, não valor de negócio.
// - Resultado é apoio a ESTIMATIVAS de simulação, não análise formal de
//   crédito (ver `AVISO_ESTIMATIVA` em financiamento.ts).

import {
  MODALIDADES,
  type Centavos,
  type ConfigModalidade,
  type Modalidade,
  type ParametrosFinanceiros,
  type TetoValorImovel,
  type TipoImovel,
} from "@mobia/domain";

/** Condição do imóvel para fins de modalidade (novo/lançamento vs. usado). */
export const CONDICOES_IMOVEL = ["novo", "usado"] as const;
export type CondicaoImovel = (typeof CONDICOES_IMOVEL)[number];

/** Resumo do perfil do cliente relevante para enquadramento. */
export interface PerfilResumo {
  /** Renda mensal bruta total (composição familiar), em centavos. */
  rendaMensalTotal: Centavos;
  /** Cidade e UF, ex.: "Fortaleza-CE" (sigla final de 2 letras após separador — ver extrairUf). */
  cidadeUF?: string;
}

/** Resumo do imóvel relevante para enquadramento. */
export interface ImovelResumo {
  /** Valor do imóvel, em centavos. */
  valor: Centavos;
  tipo: TipoImovel;
  /** Novo (lançamento/na planta) ou usado. Irrelevante para terreno. */
  condicao: CondicaoImovel;
}

/** Resultado do enquadramento de UMA modalidade. */
export interface EnquadramentoModalidade {
  modalidade: Modalidade;
  elegivel: boolean;
  /** Presente apenas quando inelegível: explicação legível do porquê. */
  motivo?: string;
  /** Config da modalidade nos parâmetros usados (para simulação subsequente). */
  config: ConfigModalidade;
}

/** As 27 unidades federativas do Brasil (26 estados + DF). */
export const UFS_BRASIL = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

const UF_SET: ReadonlySet<string> = new Set(UFS_BRASIL);

/**
 * Extrai a sigla de UF do campo cidadeUF: aceita a sigla sozinha ("CE") ou
 * precedida de SEPARADOR ("Fortaleza-CE", "Belém/PA", "Natal, RN"), sempre
 * validada contra `UFS_BRASIL`. Exigir o separador evita falso positivo em
 * nomes de cidade terminados em 2 maiúsculas (ex.: "NATAL" NÃO vira UF "AL").
 */
export function extrairUf(cidadeUF: string | undefined): string | undefined {
  if (cidadeUF === undefined) {
    return undefined;
  }
  const match = /(?:^|[-/,\s])([A-Z]{2})$/.exec(cidadeUF.trim());
  const sigla = match?.[1];
  return sigla !== undefined && UF_SET.has(sigla) ? sigla : undefined;
}

/** Formata centavos como "R$ 1.234,56" (pt-BR), para motivos legíveis. */
export function formatarReais(centavos: Centavos): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(centavos / 100);
}

/**
 * Compatibilidade estrutural entre modalidade e imóvel (semântica do
 * vocabulário fixo — não envolve valores de negócio):
 * - `terreno_e_construcao` exige tipo "terreno"; as demais exigem edificação.
 * - `imovel_novo` e `credito_associativo` (apoio à produção) exigem imóvel novo.
 * - `imovel_usado` exige imóvel usado.
 */
function motivoIncompatibilidadeEstrutural(
  modalidade: Modalidade,
  imovel: ImovelResumo,
): string | undefined {
  if (modalidade === "terreno_e_construcao") {
    return imovel.tipo === "terreno"
      ? undefined
      : `modalidade exige terreno (imóvel é ${imovel.tipo})`;
  }
  if (imovel.tipo === "terreno") {
    return "modalidade exige imóvel edificado (imóvel é terreno)";
  }
  if ((modalidade === "imovel_novo" || modalidade === "credito_associativo") &&
      imovel.condicao !== "novo") {
    return "modalidade destinada a imóvel novo (imóvel é usado)";
  }
  if (modalidade === "imovel_usado" && imovel.condicao !== "usado") {
    return "modalidade destinada a imóvel usado (imóvel é novo)";
  }
  return undefined;
}

/**
 * Enquadra o cenário em TODAS as modalidades do vocabulário, na ordem de
 * `MODALIDADES`. Cada item explica inelegibilidade via `motivo`.
 *
 * Regras orientadas pelos parâmetros:
 * - Se a config tem `faixas`: renda acima da última faixa → inelegível.
 * - Teto de valor efetivo = min(teto da FAIXA enquadrada pela renda, teto da
 *   MODALIDADE), ambos com sobrescrita por UF: valor acima → inelegível
 *   (ex.: MCMV 2026 — Faixa 1 limita a R$ 275 mil mesmo com teto do programa
 *   em R$ 600 mil).
 * Limites são INCLUSIVOS: renda/valor exatamente no limite enquadram.
 */
export function enquadrarModalidades(
  perfil: PerfilResumo,
  imovel: ImovelResumo,
  parametros: ParametrosFinanceiros,
): EnquadramentoModalidade[] {
  const uf = extrairUf(perfil.cidadeUF);

  const resolverTeto = (teto: TetoValorImovel | undefined): number => {
    if (teto === undefined) {
      return Infinity;
    }
    return (uf !== undefined ? teto.porUf?.[uf] : undefined) ?? teto.padrao;
  };

  return MODALIDADES.map((modalidade) => {
    const config = parametros.modalidades[modalidade];

    const motivoEstrutural = motivoIncompatibilidadeEstrutural(modalidade, imovel);
    if (motivoEstrutural !== undefined) {
      return { modalidade, elegivel: false, motivo: motivoEstrutural, config };
    }

    // Faixas ordenadas por rendaMensalAte — defensivo: o schema já exige a
    // ordem (refine), mas dados que não passaram pelo zod não quebram o motor.
    const faixasOrdenadas =
      config.faixas !== undefined
        ? [...config.faixas].sort((a, b) => a.rendaMensalAte - b.rendaMensalAte)
        : undefined;

    // Faixas de renda (ex.: MCMV): última faixa define a renda máxima admitida.
    const ultimaFaixa = faixasOrdenadas?.at(-1);
    if (ultimaFaixa !== undefined && perfil.rendaMensalTotal > ultimaFaixa.rendaMensalAte) {
      return {
        modalidade,
        elegivel: false,
        motivo:
          `renda ${formatarReais(perfil.rendaMensalTotal)} acima da última faixa ` +
          `(${formatarReais(ultimaFaixa.rendaMensalAte)})`,
        config,
      };
    }

    // Faixa enquadrada pela renda (limite inclusivo, como em sonhometro.ts).
    const faixa = faixasOrdenadas?.find((f) => perfil.rendaMensalTotal <= f.rendaMensalAte);

    // Teto de valor efetivo = min(teto da faixa enquadrada, teto da modalidade).
    const teto = Math.min(resolverTeto(faixa?.tetoValorImovel), resolverTeto(config.tetoValorImovel));
    if (imovel.valor > teto) {
      return {
        modalidade,
        elegivel: false,
        motivo:
          `valor ${formatarReais(imovel.valor)} acima do teto da modalidade ` +
          `(${formatarReais(teto)})`,
        config,
      };
    }

    return { modalidade, elegivel: true, config };
  });
}
