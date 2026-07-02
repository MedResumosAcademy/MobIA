// Painel de RESULTADO do Sonhômetro (H-17). Client Component (renderizado dentro
// do formulário): headline "Você consegue comprar até R$ X", melhor modalidade e
// detalhamento por modalidade — elegível (valor máx., parcela, prazo, entrada,
// subsídio) ou inelegível (motivo). CTA "Ver imóveis compatíveis" (o filtro do
// catálogo já ficou ativo pelo cookie). Todo resultado é ESTIMATIVA.
"use client";

import { formatarReais, type CapacidadeModalidade, type ResultadoSonhometro } from "@mobia/core";
import type { Modalidade } from "@mobia/domain";
import Link from "next/link";
import { classesBotao } from "@/components/ui/Botao";

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
      <div className="flex flex-col gap-1 rounded-2xl border border-border bg-surface p-4 opacity-90">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-muted">{rotulo}</span>
          <span className="rounded-full bg-surface-strong px-2.5 py-0.5 text-xs font-medium text-subtle">
            Não elegível
          </span>
        </div>
        <p className="text-xs text-subtle">{cap.motivo ?? "Sem enquadramento."}</p>
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
      className={`flex flex-col gap-3 rounded-2xl border p-4 shadow-soft ${
        ehMelhor
          ? "border-brand/40 bg-brand-soft ring-1 ring-brand/20"
          : "border-border bg-surface-card"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">{rotulo}</span>
        {ehMelhor && (
          <span className="rounded-full bg-brand px-2.5 py-0.5 text-xs font-semibold text-brand-contrast">
            Melhor opção
          </span>
        )}
      </div>
      <dl className="flex flex-col divide-y divide-border">
        {linhas.map((l) => (
          <div key={l.rotulo} className="flex items-baseline justify-between gap-4 py-1.5">
            <dt className="text-xs text-muted">{l.rotulo}</dt>
            <dd className="text-sm font-semibold tabular-nums text-foreground">{l.valor}</dd>
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
      {temCapacidade ? (
        <section className="flex flex-col items-center gap-3 rounded-2xl border border-brand/25 bg-brand-soft p-8 text-center shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-strong">
            Você consegue comprar até
          </p>
          <p className="text-4xl font-bold tracking-tight tabular-nums text-foreground sm:text-5xl">
            {formatarReais(resultado.valorMaximoImovel)}
          </p>
          {melhor && (
            <p className="text-sm text-muted">
              Melhor modalidade:{" "}
              <strong className="font-semibold text-foreground">{ROTULO_MODALIDADE[melhor]}</strong>
            </p>
          )}
        </section>
      ) : (
        <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-8 text-center">
          <p className="text-lg font-semibold text-foreground">
            Ainda não encontramos uma opção compatível
          </p>
          <p className="text-sm text-muted">
            Com os dados informados, nenhuma modalidade permitiu financiamento. Reveja a renda, o
            FGTS ou fale com um corretor.
          </p>
        </section>
      )}

      <section aria-label="Detalhamento por modalidade" className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-foreground">Detalhamento por modalidade</h2>
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

      <p className="text-xs leading-5 text-subtle">
        Este é um cálculo <strong className="text-muted">estimativo</strong> com base nos dados
        informados e nos parâmetros vigentes — não constitui proposta formal de crédito. Subsídios e
        taxas reais podem variar conforme a análise da instituição financeira.
      </p>

      {temCapacidade && (
        <div>
          <Link href="/imoveis" className={classesBotao("primario", "lg")}>
            Ver imóveis compatíveis
          </Link>
        </div>
      )}
    </div>
  );
}
