// Métricas gerenciais do funil de vendas (agregação PURA, sem I/O).
//
// A partir de uma lista de negócios (etapa, resultado, valor, datas, corretor)
// e da data de HOJE (recebida como ISO YYYY-MM-DD), calcula os indicadores do
// painel do gestor: em aberto, ganhos/perdidos, ganhos no mês, taxa de
// conversão, ticket médio, ciclo médio, distribuição por etapa, ranking de
// corretores e tendência dos últimos 6 meses.
//
// PURO: não lê/escreve I/O, não muta a entrada e NÃO usa Date.now()/new Date()
// sem argumento. `hoje` é injetado; mês/dia são derivados parseando ISO com
// `new Date(isoString)` (permitido).
//
// CONVENÇÕES:
// - `resultado` 'ganho'|'perdido' ⇒ negócio FECHADO; null/ausente ⇒ ABERTO.
// - `valor` null/ausente conta na QUANTIDADE mas soma 0. Dinheiro em CENTAVOS.

import type { Centavos } from "@imobia/domain";
import { ETAPAS_NEGOCIO, type EtapaNegocio } from "@imobia/domain";

type ResultadoMetricas = "ganho" | "perdido";

/** Entrada mínima por negócio para as métricas gerenciais. */
export interface NegocioMetricas {
  etapa: EtapaNegocio;
  /** null/ausente ⇒ negócio aberto. */
  resultado?: ResultadoMetricas | null;
  /** null/ausente ⇒ conta na quantidade, soma 0. CENTAVOS. */
  valor?: Centavos | null;
  /** Timestamp ISO de criação. */
  criadoEm: string;
  /** Timestamp ISO de fechamento; null enquanto aberto. */
  fechadoEm?: string | null;
  corretorId: string;
  /** Nome do corretor para exibição no ranking. Opcional. */
  corretorNome?: string;
}

/** Contagem + soma de valores (CENTAVOS). */
export interface ResumoQtdValor {
  quantidade: number;
  valor: Centavos;
}

/** Linha do ranking de corretores. */
export interface RankingCorretor {
  corretorId: string;
  nome: string;
  ganhos: number;
  valorGanho: Centavos;
  emAberto: number;
  /** ganhos / (ganhos + perdidos) do corretor; 0 se denominador 0. */
  conversao: number;
}

/** Ponto da tendência mensal. */
export interface TendenciaMes {
  /** Mês no formato YYYY-MM. */
  mes: string;
  /** Negócios criados no mês (por criadoEm). */
  criados: number;
  /** Negócios ganhos no mês (por fechadoEm). */
  ganhos: number;
}

/** Resultado das métricas gerenciais. */
export interface MetricasGerenciais {
  /** Negócios não-fechados. */
  emAberto: ResumoQtdValor;
  ganhos: ResumoQtdValor;
  perdidos: ResumoQtdValor;
  /** Ganhos cujo fechadoEm cai no mês corrente de `hoje`. */
  ganhosNoMes: ResumoQtdValor;
  /** ganhos / (ganhos + perdidos); 0 se denominador 0. */
  taxaConversao: number;
  /** Valor médio dos negócios ganhos (CENTAVOS, arredondado); 0 se sem ganhos. */
  ticketMedio: Centavos;
  /** Média de (fechadoEm - criadoEm) dos ganhos, em dias (arredondado); 0 se sem ganhos. */
  cicloMedioDias: number;
  /** Distribuição dos negócios ABERTOS por etapa (todas as etapas presentes). */
  porEtapa: Record<EtapaNegocio, ResumoQtdValor>;
  /** Ranking de corretores, desc por valorGanho e depois ganhos. */
  ranking: RankingCorretor[];
  /** Últimos 6 meses até `hoje`, em ordem cronológica. */
  tendencia: TendenciaMes[];
}

interface AcumCorretor {
  corretorId: string;
  nome: string;
  ganhos: number;
  perdidos: number;
  valorGanho: number;
  emAberto: number;
}

function novoPorEtapa(): Record<EtapaNegocio, ResumoQtdValor> {
  const porEtapa = {} as Record<EtapaNegocio, ResumoQtdValor>;
  for (const etapa of ETAPAS_NEGOCIO) {
    porEtapa[etapa] = { quantidade: 0, valor: 0 };
  }
  return porEtapa;
}

/** Extrai "YYYY-MM" de uma data ISO parseando com Date (UTC). */
function chaveMes(iso: string): string {
  const d = new Date(iso);
  const ano = d.getUTCFullYear();
  const mes = d.getUTCMonth() + 1;
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

/** Lista as chaves YYYY-MM dos últimos 6 meses até `hoje` (cronológica). */
function ultimos6Meses(hojeIso: string): string[] {
  const base = new Date(`${hojeIso}T00:00:00Z`);
  const ano = base.getUTCFullYear();
  const mes = base.getUTCMonth(); // 0-based
  const chaves: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(ano, mes - i, 1));
    chaves.push(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
    );
  }
  return chaves;
}

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Agrega uma lista de negócios nas métricas gerenciais.
 *
 * @param negocios itens do funil (aberto/ganho/perdido) com datas e corretor.
 * @param hoje data ISO YYYY-MM-DD que define "mês corrente" e a janela de 6 meses.
 */
export function metricasGerenciais(
  negocios: NegocioMetricas[],
  hoje: string,
): MetricasGerenciais {
  const emAberto: ResumoQtdValor = { quantidade: 0, valor: 0 };
  const ganhos: ResumoQtdValor = { quantidade: 0, valor: 0 };
  const perdidos: ResumoQtdValor = { quantidade: 0, valor: 0 };
  const ganhosNoMes: ResumoQtdValor = { quantidade: 0, valor: 0 };
  const porEtapa = novoPorEtapa();

  const mesCorrente = chaveMes(`${hoje}T00:00:00Z`);
  let somaCicloDias = 0;

  const corretores = new Map<string, AcumCorretor>();
  const tendMap = new Map<string, TendenciaMes>();
  for (const chave of ultimos6Meses(hoje)) {
    tendMap.set(chave, { mes: chave, criados: 0, ganhos: 0 });
  }

  for (const n of negocios) {
    const valor = n.valor ?? 0;

    let acum = corretores.get(n.corretorId);
    if (!acum) {
      acum = {
        corretorId: n.corretorId,
        nome: n.corretorNome ?? n.corretorId,
        ganhos: 0,
        perdidos: 0,
        valorGanho: 0,
        emAberto: 0,
      };
      corretores.set(n.corretorId, acum);
    } else if (n.corretorNome) {
      acum.nome = n.corretorNome;
    }

    // Tendência: criados por mês de criadoEm.
    const mesCriado = chaveMes(n.criadoEm);
    const pontoCriado = tendMap.get(mesCriado);
    if (pontoCriado) pontoCriado.criados += 1;

    if (n.resultado === "ganho") {
      ganhos.quantidade += 1;
      ganhos.valor += valor;
      acum.ganhos += 1;
      acum.valorGanho += valor;

      if (n.fechadoEm) {
        const mesFechado = chaveMes(n.fechadoEm);
        if (mesFechado === mesCorrente) {
          ganhosNoMes.quantidade += 1;
          ganhosNoMes.valor += valor;
        }
        const pontoGanho = tendMap.get(mesFechado);
        if (pontoGanho) pontoGanho.ganhos += 1;

        const dias =
          (new Date(n.fechadoEm).getTime() - new Date(n.criadoEm).getTime()) /
          MS_POR_DIA;
        somaCicloDias += dias;
      }
    } else if (n.resultado === "perdido") {
      perdidos.quantidade += 1;
      perdidos.valor += valor;
      acum.perdidos += 1;
    } else {
      emAberto.quantidade += 1;
      emAberto.valor += valor;
      acum.emAberto += 1;
      const etapa = porEtapa[n.etapa];
      etapa.quantidade += 1;
      etapa.valor += valor;
    }
  }

  const fechados = ganhos.quantidade + perdidos.quantidade;
  const taxaConversao = fechados === 0 ? 0 : ganhos.quantidade / fechados;
  const ticketMedio =
    ganhos.quantidade === 0 ? 0 : Math.round(ganhos.valor / ganhos.quantidade);
  const cicloMedioDias =
    ganhos.quantidade === 0 ? 0 : Math.round(somaCicloDias / ganhos.quantidade);

  const ranking: RankingCorretor[] = [...corretores.values()]
    .map((c) => {
      const fech = c.ganhos + c.perdidos;
      return {
        corretorId: c.corretorId,
        nome: c.nome,
        ganhos: c.ganhos,
        valorGanho: c.valorGanho,
        emAberto: c.emAberto,
        conversao: fech === 0 ? 0 : c.ganhos / fech,
      };
    })
    .sort((a, b) =>
      b.valorGanho !== a.valorGanho
        ? b.valorGanho - a.valorGanho
        : b.ganhos - a.ganhos,
    );

  const tendencia = [...tendMap.values()];

  return {
    emAberto,
    ganhos,
    perdidos,
    ganhosNoMes,
    taxaConversao,
    ticketMedio,
    cicloMedioDias,
    porEtapa,
    ranking,
    tendencia,
  };
}
