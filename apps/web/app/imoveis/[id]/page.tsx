// Ficha do imóvel (E2 — H-10/H-11). Server Component: galeria, planta,
// localização, valor, descrição, unidades e — quando há esquema_pagamento —
// simulação do plano padrão calculada pelo @mobia/core com parâmetros vigentes.

import { formatarReais, recalcularPlano } from "@mobia/core";
import type { EsquemaPagamento, Modalidade, ParametrosFinanceiros } from "@mobia/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FichaGaleria } from "@/components/FichaGaleria";
import { FichaLocalizacao } from "@/components/FichaLocalizacao";
import { PlanoPagamentoVisual } from "@/components/PlanoPagamentoVisual";
import { registrarEvento } from "@/lib/dados/eventos";
import { obterImovel, type ImovelDetalhe } from "@/lib/dados/imoveis";
import { obterParametrosVigentesDoBanco } from "@/lib/parametros";

// H-05: parâmetros vêm do banco a cada request — sem cache de build.
export const dynamic = "force-dynamic";

const ROTULO_MODALIDADE: Record<Modalidade, string> = {
  mcmv: "Minha Casa Minha Vida",
  sbpe: "SBPE",
  credito_associativo: "Crédito associativo",
  imovel_novo: "Imóvel novo",
  imovel_usado: "Imóvel usado",
  terreno_e_construcao: "Terreno e construção",
};

type ParamsFicha = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: ParamsFicha): Promise<Metadata> {
  const { id } = await params;
  const imovel = await obterImovel(id);
  if (!imovel) {
    return { title: "Imóvel não encontrado — MobIA" };
  }
  return { title: `${imovel.titulo} — MobIA` };
}

function ehPdf(url: string): boolean {
  return /\.pdf(\?|$)/i.test(url);
}

/** Calcula o plano padrão: ato = percentual mínimo do esquema × valor. */
function simularPlanoPadrao(imovel: ImovelDetalhe, parametros: ParametrosFinanceiros) {
  // O jsonb persistido não guarda id/orgId/imovelId (anti-forja); o motor não os
  // lê. Completamos os campos derivados a partir do imóvel só para satisfazer o
  // tipo EsquemaPagamento esperado por recalcularPlano.
  const armazenado = imovel.esquemaPagamento;
  if (!armazenado) {
    return null;
  }
  const esquema: EsquemaPagamento = {
    id: imovel.id,
    orgId: imovel.orgId,
    imovelId: imovel.id,
    ...armazenado,
  };
  const modalidade = parametros.modalidades[esquema.modalidade];
  const entradaPadrao = Math.round(imovel.valor * esquema.percentualMinimoAto);
  const resultado = recalcularPlano({
    valorImovel: imovel.valor,
    esquema,
    entradaEscolhida: entradaPadrao,
    financiamento: {
      taxaAnual: modalidade.taxaAnualEfetiva,
      prazoMeses: modalidade.prazoMaxMeses,
      sistema: modalidade.sistemaAmortizacaoPadrao,
    },
  });
  return resultado;
}

export default async function FichaImovel({ params }: ParamsFicha) {
  const { id } = await params;
  const imovel = await obterImovel(id);
  if (!imovel) {
    notFound();
  }

  // Sinal de interesse (E7) — no-op se anônimo/corretor.
  await registrarEvento("visita_ficha", { imovelId: imovel.id });

  const parametros = await obterParametrosVigentesDoBanco();
  const simulacao = imovel.esquemaPagamento
    ? simularPlanoPadrao(imovel, parametros)
    : null;
  const modalidadeRotulo = imovel.esquemaPagamento
    ? ROTULO_MODALIDADE[imovel.esquemaPagamento.modalidade]
    : null;

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-4 py-10 font-sans sm:px-6 dark:bg-black">
      <main className="flex w-full max-w-4xl flex-col gap-8">
        <nav>
          <Link
            href="/imoveis"
            className="text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            ← Voltar ao catálogo
          </Link>
        </nav>

        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {imovel.titulo}
          </h1>
          <p className="text-2xl font-medium tabular-nums text-emerald-700 dark:text-emerald-400">
            {formatarReais(imovel.valor)}
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {imovel.cidade}/{imovel.uf}
            {imovel.condicao ? ` · ${imovel.condicao}` : ""}
          </p>
        </header>

        <FichaGaleria fotos={imovel.fotos} titulo={imovel.titulo} />

        {imovel.descricao && (
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Descrição
            </h2>
            <p className="whitespace-pre-line text-base leading-7 text-zinc-700 dark:text-zinc-300">
              {imovel.descricao}
            </p>
          </section>
        )}

        {imovel.plantas.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Planta
            </h2>
            <ul className="flex flex-col gap-3">
              {imovel.plantas.map((url, i) =>
                ehPdf(url) ? (
                  <li key={url}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-medium text-sky-700 hover:underline dark:text-sky-400"
                    >
                      Abrir planta {imovel.plantas.length > 1 ? i + 1 : ""} (PDF) →
                    </a>
                  </li>
                ) : (
                  <li key={url}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Planta ${i + 1} — ${imovel.titulo}`}
                      className="w-full rounded-2xl border border-zinc-200 object-contain dark:border-zinc-800"
                    />
                  </li>
                ),
              )}
            </ul>
          </section>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Localização
          </h2>
          <FichaLocalizacao
            endereco={imovel.endereco}
            cidade={imovel.cidade}
            uf={imovel.uf}
            lat={imovel.lat}
            lng={imovel.lng}
          />
        </section>

        {imovel.unidades.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Unidades disponíveis
            </h2>
            <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                  <tr>
                    <th className="px-4 py-2 font-medium">Unidade</th>
                    <th className="px-4 py-2 font-medium">Andar</th>
                    <th className="px-4 py-2 text-right font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {imovel.unidades.map((u) => (
                    <tr key={u.id}>
                      <td className="px-4 py-2 text-zinc-800 dark:text-zinc-200">
                        {u.identificador}
                      </td>
                      <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                        {u.andar ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-zinc-950 dark:text-zinc-50">
                        {formatarReais(u.valor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section
          aria-label="Simulação de pagamento"
          className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              Simulação — plano padrão
            </h2>
            {modalidadeRotulo && (
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {modalidadeRotulo}
              </span>
            )}
          </div>

          {simulacao === null && (
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              Condições sob consulta. Fale com o corretor para montar seu plano de
              pagamento.
            </p>
          )}

          {simulacao !== null && !simulacao.ok && (
            <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">
              Não foi possível montar o plano padrão para este imóvel. Condições sob
              consulta.
            </p>
          )}

          {simulacao !== null && simulacao.ok && (
            <PlanoSimulado
              plano={simulacao.plano}
              parametros={parametros}
              numeroParcelas={imovel.esquemaPagamento!.numeroParcelasMensais}
            />
          )}
        </section>
      </main>
    </div>
  );
}

function PlanoSimulado({
  plano,
  parametros,
  numeroParcelas,
}: {
  plano: import("@mobia/domain").PlanoPagamentoRecalculado;
  parametros: ParametrosFinanceiros;
  numeroParcelas: number;
}) {
  const { financiamentoPosChaves } = plano;
  const primeiraParcela =
    plano.cronograma.find((i) => i.tipo === "parcela")?.valor ?? 0;

  const linhas: Array<{ rotulo: string; valor: string }> = [
    { rotulo: "Ato (entrada)", valor: formatarReais(plano.resumo.totalAto) },
    {
      rotulo: "Parcelas mensais até as chaves",
      valor:
        numeroParcelas > 0
          ? `${numeroParcelas}× de ${formatarReais(primeiraParcela)}`
          : "—",
    },
    { rotulo: "Financiado nas chaves", valor: formatarReais(plano.valorFinanciado) },
    {
      rotulo: `Parcela estimada pós-chaves (${financiamentoPosChaves.sistema.toUpperCase()}, ${financiamentoPosChaves.prazoMeses} meses)`,
      valor: formatarReais(financiamentoPosChaves.parcelaEstimada),
    },
  ];

  return (
    <>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Entrada mínima do empreendimento sobre {formatarReais(plano.resumo.valorImovel)}.
      </p>

      <div className="mt-6">
        <PlanoPagamentoVisual plano={plano} />
      </div>

      <dl className="mt-6 flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
        {linhas.map((linha) => (
          <div
            key={linha.rotulo}
            className="flex items-baseline justify-between gap-4 py-3"
          >
            <dt className="text-sm text-zinc-500 dark:text-zinc-400">{linha.rotulo}</dt>
            <dd className="text-base font-medium tabular-nums text-zinc-950 dark:text-zinc-50">
              {linha.valor}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 text-xs leading-5 text-zinc-400 dark:text-zinc-500">
        Estimativa (parâmetros {parametros.vigenciaInicio}, v{parametros.versao}) — não
        constitui proposta formal de crédito.
      </p>
    </>
  );
}
