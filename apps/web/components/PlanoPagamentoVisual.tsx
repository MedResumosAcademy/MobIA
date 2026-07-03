// Timeline horizontal do plano de pagamento (H-11): Ato → Parcelas → Balões →
// Financiamento → Chaves. Puro CSS/flex (Server Component, sem JS no cliente),
// legível no mobile. Recebe o plano JÁ calculado pelo core — não faz cálculo.

import { formatarReais } from "@imobia/core";
import type { PlanoPagamentoRecalculado } from "@imobia/domain";

type Marco = {
  chave: string;
  rotulo: string;
  detalhe: string;
  cor: string;
  ponto: string;
};

// Recoloração editorial contida: superfícies areia/verde suave/champanhe;
// pontos em verde (marca), dourado (parcimonioso) e areia. Sem multicor saturada.
const CORES: Record<string, { faixa: string; ponto: string }> = {
  ato: { faixa: "bg-brand-soft", ponto: "bg-brand" },
  parcela: { faixa: "bg-surface", ponto: "bg-brand" },
  balao: { faixa: "bg-gold-soft", ponto: "bg-gold" },
  financiamento: { faixa: "bg-surface-strong", ponto: "bg-brand" },
  chaves: { faixa: "bg-surface-strong", ponto: "bg-subtle" },
};

export function PlanoPagamentoVisual({ plano }: { plano: PlanoPagamentoRecalculado }) {
  const { cronograma, resumo, valorFinanciado, financiamentoPosChaves } = plano;

  const parcelas = cronograma.filter((i) => i.tipo === "parcela");
  const baloes = cronograma.filter((i) => i.tipo === "balao");
  const prazoFinanciamento = financiamentoPosChaves.prazoMeses;
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
    detalhe: `${financiamentoPosChaves.sistema.toUpperCase()} · financia em ${prazoFinanciamento} meses`,
    cor: CORES.chaves.faixa,
    ponto: CORES.chaves.ponto,
  });

  return (
    <div aria-label="Linha do tempo do plano de pagamento" className="w-full">
      <ol className="flex flex-col gap-3 sm:flex-row sm:gap-0">
        {marcos.map((marco) => (
          <li
            key={marco.chave}
            className="relative flex flex-1 flex-col gap-2 sm:items-center sm:text-center"
          >
            <div className="flex items-center gap-3 sm:w-full sm:flex-col sm:gap-2">
              <span
                aria-hidden
                className={`h-3 w-3 shrink-0 rounded-full ring-4 ring-background ${marco.ponto}`}
              />
              <span className="hidden h-px flex-1 bg-border sm:block" />
            </div>
            <div
              className={`rounded-xl px-3 py-2 sm:w-[calc(100%-0.5rem)] ${marco.cor}`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {marco.rotulo}
              </p>
              <p className="mt-0.5 text-sm font-medium tabular-nums text-foreground">
                {marco.detalhe}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
