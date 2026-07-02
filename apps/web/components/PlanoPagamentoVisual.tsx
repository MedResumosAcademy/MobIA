// Timeline horizontal do plano de pagamento (H-11): Ato → Parcelas → Balões →
// Financiamento → Chaves. Puro CSS/flex (Server Component, sem JS no cliente),
// legível no mobile. Recebe o plano JÁ calculado pelo core — não faz cálculo.

import { formatarReais } from "@mobia/core";
import type { PlanoPagamentoRecalculado } from "@mobia/domain";

type Marco = {
  chave: string;
  rotulo: string;
  detalhe: string;
  cor: string;
  ponto: string;
};

const CORES: Record<string, { faixa: string; ponto: string }> = {
  ato: { faixa: "bg-emerald-50 dark:bg-emerald-950/40", ponto: "bg-emerald-500" },
  parcela: { faixa: "bg-sky-50 dark:bg-sky-950/40", ponto: "bg-sky-500" },
  balao: { faixa: "bg-amber-50 dark:bg-amber-950/40", ponto: "bg-amber-500" },
  financiamento: { faixa: "bg-violet-50 dark:bg-violet-950/40", ponto: "bg-violet-500" },
  chaves: { faixa: "bg-zinc-100 dark:bg-zinc-800/60", ponto: "bg-zinc-500" },
};

export function PlanoPagamentoVisual({ plano }: { plano: PlanoPagamentoRecalculado }) {
  const { cronograma, resumo, valorFinanciado, financiamentoPosChaves } = plano;

  const parcelas = cronograma.filter((i) => i.tipo === "parcela");
  const baloes = cronograma.filter((i) => i.tipo === "balao");
  const mesChaves = financiamentoPosChaves.prazoMeses;
  const primeiraParcela = parcelas[0]?.valor ?? 0;
  const mesFinanciamento =
    cronograma.find((i) => i.tipo === "financiamento")?.mesRelativo ?? 0;

  const marcos: Marco[] = [];

  marcos.push({
    chave: "ato",
    rotulo: "Ato (entrada)",
    detalhe: formatarReais(resumo.totalAto),
    cor: CORES.ato.faixa,
    ponto: CORES.ato.ponto,
  });

  if (parcelas.length > 0) {
    marcos.push({
      chave: "parcela",
      rotulo: "Parcelas mensais",
      detalhe: `${parcelas.length}× de ${formatarReais(primeiraParcela)}`,
      cor: CORES.parcela.faixa,
      ponto: CORES.parcela.ponto,
    });
  }

  if (baloes.length > 0) {
    marcos.push({
      chave: "balao",
      rotulo: baloes.length === 1 ? "Balão" : "Balões",
      detalhe: `${baloes.length}× — total ${formatarReais(resumo.totalBaloes)}`,
      cor: CORES.balao.faixa,
      ponto: CORES.balao.ponto,
    });
  }

  marcos.push({
    chave: "financiamento",
    rotulo: "Financiamento nas chaves",
    detalhe: formatarReais(valorFinanciado),
    cor: CORES.financiamento.faixa,
    ponto: CORES.financiamento.ponto,
  });

  marcos.push({
    chave: "chaves",
    rotulo: `Chaves (mês ${mesFinanciamento})`,
    detalhe: `${financiamentoPosChaves.sistema.toUpperCase()} · ${mesChaves} meses`,
    cor: CORES.chaves.faixa,
    ponto: CORES.chaves.ponto,
  });

  return (
    <div aria-label="Linha do tempo do plano de pagamento" className="w-full">
      <ol className="flex flex-col gap-3 sm:flex-row sm:gap-0">
        {marcos.map((marco, i) => (
          <li
            key={marco.chave}
            className="relative flex flex-1 flex-col gap-2 sm:items-center sm:text-center"
          >
            <div className="flex items-center gap-3 sm:w-full sm:flex-col sm:gap-2">
              <span
                aria-hidden
                className={`h-3 w-3 shrink-0 rounded-full ring-4 ring-white dark:ring-zinc-950 ${marco.ponto}`}
              />
              <span className="hidden h-px flex-1 bg-zinc-200 dark:bg-zinc-800 sm:block" />
            </div>
            <div
              className={`rounded-xl px-3 py-2 sm:w-[calc(100%-0.5rem)] ${marco.cor}`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
                {marco.rotulo}
              </p>
              <p className="mt-0.5 text-sm font-medium tabular-nums text-zinc-950 dark:text-zinc-50">
                {marco.detalhe}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
