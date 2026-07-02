// Painel de RESULTADO do Sonhômetro (H-17). Client Component (renderizado dentro
// do formulário): headline "Você consegue comprar até R$ X", melhor modalidade e
// detalhamento por modalidade — elegível (valor máx., parcela, prazo, entrada,
// subsídio) ou inelegível (motivo). CTA "Ver imóveis compatíveis" (o filtro do
// catálogo já ficou ativo pelo cookie). Todo resultado é ESTIMATIVA.
"use client";

import { formatarReais, type CapacidadeModalidade, type ResultadoSonhometro } from "@mobia/core";
import type { Modalidade } from "@mobia/domain";
import Link from "next/link";

const ROTULO_MODALIDADE: Record<Modalidade, string> = {
  mcmv: "Minha Casa Minha Vida",
  sbpe: "SBPE",
  credito_associativo: "Crédito associativo",
  imovel_novo: "Imóvel novo",
  imovel_usado: "Imóvel usado",
  terreno_e_construcao: "Terreno e construção",
};

/** Anos aproximados a partir de meses, para exibição amigável do prazo. */
function prazoLegivel(meses: number): string {
  if (meses <= 0) return "—";
  const anos = Math.round(meses / 12);
  return `${meses} meses (~${anos} ${anos === 1 ? "ano" : "anos"})`;
}

function CartaoModalidade({
  cap,
  ehMelhor,
}: {
  cap: CapacidadeModalidade;
  ehMelhor: boolean;
}) {
  const rotulo = ROTULO_MODALIDADE[cap.modalidade];

  if (!cap.elegivel) {
    return (
      <div className="flex flex-col gap-1 rounded-xl border border-zinc-200 bg-zinc-50 p-4 opacity-80 dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{rotulo}</span>
          <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            Não elegível
          </span>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{cap.motivo ?? "Sem enquadramento."}</p>
      </div>
    );
  }

  const linhas: Array<{ rotulo: string; valor: string }> = [
    { rotulo: "Valor máximo do imóvel", valor: formatarReais(cap.valorMaximoImovel) },
    { rotulo: "Parcela estimada", valor: formatarReais(cap.parcelaEstimada) },
    { rotulo: "Prazo", valor: prazoLegivel(cap.prazoMeses) },
    { rotulo: "Entrada necessária", valor: formatarReais(cap.entradaNecessaria) },
  ];
  if (cap.subsidioEstimado > 0) {
    linhas.push({
      rotulo: cap.subsidioEhTeto ? "Subsídio (até)" : "Subsídio",
      valor: formatarReais(cap.subsidioEstimado),
    });
  }

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border p-4 ${
        ehMelhor
          ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
          : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{rotulo}</span>
        {ehMelhor && (
          <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white">
            Melhor opção
          </span>
        )}
      </div>
      <dl className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
        {linhas.map((l) => (
          <div key={l.rotulo} className="flex items-baseline justify-between gap-4 py-1.5">
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">{l.rotulo}</dt>
            <dd className="text-sm font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
              {l.valor}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function ResultadoSonhometroPainel({
  resultado,
}: {
  resultado: ResultadoSonhometro;
}) {
  const melhor = resultado.melhorModalidade;
  const temCapacidade = resultado.valorMaximoImovel > 0;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-900 dark:bg-emerald-950/30">
        {temCapacidade ? (
          <>
            <p className="text-sm font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
              Você consegue comprar até
            </p>
            <p className="text-4xl font-semibold tabular-nums text-emerald-900 sm:text-5xl dark:text-emerald-100">
              {formatarReais(resultado.valorMaximoImovel)}
            </p>
            {melhor && (
              <p className="text-sm text-emerald-800 dark:text-emerald-300">
                Melhor modalidade: <strong>{ROTULO_MODALIDADE[melhor]}</strong>
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              Ainda não encontramos uma opção compatível
            </p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Com os dados informados, nenhuma modalidade permitiu financiamento. Reveja a renda, o
              FGTS ou fale com um corretor.
            </p>
          </>
        )}
      </section>

      <section aria-label="Detalhamento por modalidade" className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Detalhamento por modalidade
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {resultado.porModalidade.map((cap) => (
            <CartaoModalidade
              key={cap.modalidade}
              cap={cap}
              ehMelhor={cap.modalidade === melhor && temCapacidade}
            />
          ))}
        </div>
      </section>

      <p className="text-xs leading-5 text-zinc-400 dark:text-zinc-500">
        Este é um cálculo <strong>estimativo</strong> com base nos dados informados e nos parâmetros
        vigentes — não constitui proposta formal de crédito. Subsídios e taxas reais podem variar
        conforme a análise da instituição financeira.
      </p>

      {temCapacidade && (
        <div>
          <Link
            href="/imoveis"
            className="inline-flex rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Ver imóveis compatíveis
          </Link>
        </div>
      )}
    </div>
  );
}
