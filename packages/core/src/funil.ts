// Resumo do funil de vendas (agregação PURA, sem I/O).
//
// A partir de uma lista de negócios (etapa + resultado + valor), calcula os
// agregados usados pelo painel do funil: contagem/valor por etapa, quantos
// estão abertos/ganhos/perdidos, valor em aberto, valor ganho e taxa de
// conversão. Lógica pura e testável — vive no motor (@imobia/core), nunca em SQL.
//
// CONVENÇÕES:
// - `resultado` presente (ganho/perdido) ⇒ negócio FECHADO; ausente/null ⇒ ABERTO.
// - `valor` ausente/null conta na QUANTIDADE mas soma 0 (negócio sem valor estimado).
// - Dinheiro em CENTAVOS (`Centavos`, inteiro).

import type { Centavos } from "@imobia/domain";
import { ETAPAS_NEGOCIO, type EtapaNegocio } from "@imobia/domain";

/** Entrada mínima por negócio para o resumo do funil. */
export interface NegocioFunil {
  etapa: EtapaNegocio;
  /** Ausente/null ⇒ negócio aberto. */
  resultado?: ResultadoNegocioFunil | null;
  /** Ausente/null ⇒ conta na quantidade, valor 0. */
  valor?: Centavos | null;
}

type ResultadoNegocioFunil = "ganho" | "perdido";

/** Agregado de uma etapa: quantos negócios e a soma dos valores (CENTAVOS). */
export interface ResumoEtapa {
  quantidade: number;
  valor: Centavos;
}

/** Resultado do resumo do funil. */
export interface ResumoFunil {
  /** Uma entrada por etapa de `ETAPAS_NEGOCIO` (sempre presentes, mesmo zeradas). */
  porEtapa: Record<EtapaNegocio, ResumoEtapa>;
  /** Negócios sem resultado (abertos). */
  abertos: number;
  /** Negócios com resultado 'ganho'. */
  ganhos: number;
  /** Negócios com resultado 'perdido'. */
  perdidos: number;
  /** Soma dos valores dos negócios ABERTOS (CENTAVOS). */
  valorEmAberto: Centavos;
  /** Soma dos valores dos negócios GANHOS (CENTAVOS). */
  valorGanho: Centavos;
  /** ganhos / (ganhos + perdidos); 0 se denominador 0. */
  taxaConversao: number;
}

function novoPorEtapa(): Record<EtapaNegocio, ResumoEtapa> {
  const porEtapa = {} as Record<EtapaNegocio, ResumoEtapa>;
  for (const etapa of ETAPAS_NEGOCIO) {
    porEtapa[etapa] = { quantidade: 0, valor: 0 };
  }
  return porEtapa;
}

/**
 * Agrega uma lista de negócios no resumo do funil.
 *
 * Puro: não lê/escreve I/O e não muta a entrada. `porEtapa` sempre traz TODAS
 * as etapas de `ETAPAS_NEGOCIO`, mesmo que zeradas.
 */
export function resumoFunil(negocios: NegocioFunil[]): ResumoFunil {
  const porEtapa = novoPorEtapa();
  let abertos = 0;
  let ganhos = 0;
  let perdidos = 0;
  let valorEmAberto = 0;
  let valorGanho = 0;

  for (const negocio of negocios) {
    const valor = negocio.valor ?? 0;
    const etapa = porEtapa[negocio.etapa];
    etapa.quantidade += 1;
    etapa.valor += valor;

    if (negocio.resultado === "ganho") {
      ganhos += 1;
      valorGanho += valor;
    } else if (negocio.resultado === "perdido") {
      perdidos += 1;
    } else {
      abertos += 1;
      valorEmAberto += valor;
    }
  }

  const fechados = ganhos + perdidos;
  const taxaConversao = fechados === 0 ? 0 : ganhos / fechados;

  return {
    porEtapa,
    abertos,
    ganhos,
    perdidos,
    valorEmAberto,
    valorGanho,
    taxaConversao,
  };
}
