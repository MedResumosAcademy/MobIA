// DASHBOARD GERENCIAL (ESCOPO §5 — visão da imobiliária). Server Component com
// GATE de papel: só gestor/admin; corretor comum é redirecionado ao painel.
// Nível BI: faixa de KPIs, funil por etapa, ranking de corretores, tendência
// mensal (criados vs ganhos) e distribuição de temperatura. Todas as métricas
// passam pela RLS multi-tenant + PORTÃO DE CONSENTIMENTO LGPD (leads só de
// clientes que autorizaram o atendimento) — aqui só apresentamos.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Handshake,
  Trophy,
  Percent,
  Receipt,
  Timer,
  Users,
  AlarmClock,
  Flame,
  Medal,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { formatarReais } from "@imobia/core";
import { ETAPAS_NEGOCIO, type EtapaNegocio, type Temperatura } from "@imobia/domain";
import { obterPerfil, obterSessao } from "@/lib/auth/sessao";
import { obterNomeOrg } from "@/lib/dados/gestor";
import { dashboardGerencial, type DashboardGerencial } from "@/lib/dados/metricas";

export const metadata: Metadata = { title: "Dashboard gerencial — ImobIA" };
export const dynamic = "force-dynamic";

// Rótulos das etapas do funil (o domínio guarda só as chaves; UI define texto).
const ROTULOS_ETAPA: Record<EtapaNegocio, string> = {
  novo: "Novo",
  contato: "Contato",
  visita: "Visita",
  proposta: "Proposta",
  fechamento: "Fechamento",
};

// Rótulos/chamas/cores das barras de temperatura (mesma escala do termômetro).
const TEMPERATURAS: {
  chave: Temperatura;
  rotulo: string;
  chamas: string;
  barra: string;
}[] = [
  { chave: "quente", rotulo: "Quente", chamas: "🔥", barra: "bg-gold" },
  { chave: "muito_quente", rotulo: "Muito quente", chamas: "🔥🔥", barra: "bg-brand/70" },
  {
    chave: "pronto_para_compra",
    rotulo: "Pronto para compra",
    chamas: "🔥🔥🔥",
    barra: "bg-brand",
  },
];

// Rótulo curto de mês (YYYY-MM → "jul") para o eixo da tendência.
const MESES_CURTOS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];
function rotuloMes(chave: string): string {
  const [, mes] = chave.split("-");
  const idx = Number(mes) - 1;
  return MESES_CURTOS[idx] ?? chave;
}

// Formata centavos como moeda compacta ("R$ 1,2 mi") para os KPIs de topo, onde
// os valores chegam a milhões e a legibilidade importa mais que o centavo.
function reaisCompacto(centavos: number): string {
  const reais = centavos / 100;
  if (reais >= 1_000_000) {
    return `R$ ${(reais / 1_000_000).toLocaleString("pt-BR", {
      maximumFractionDigits: 1,
    })} mi`;
  }
  if (reais >= 1_000) {
    return `R$ ${(reais / 1_000).toLocaleString("pt-BR", {
      maximumFractionDigits: 0,
    })} mil`;
  }
  return formatarReais(centavos);
}

export default async function PaginaEquipe() {
  // GATE de papel: corretor comum vai ao painel; anônimo, ao login.
  const sessao = await obterSessao();
  if (!sessao) {
    redirect("/entrar");
  }
  const perfil = await obterPerfil(sessao.usuarioId);
  const papel = perfil?.papel ?? "cliente";
  if (papel !== "gestor" && papel !== "admin") {
    redirect("/corretor?aviso=area-restrita-gestor");
  }

  const [dashboard, nomeOrg] = await Promise.all([
    dashboardGerencial("org"),
    obterNomeOrg(),
  ]);
  const { metricas, tarefas, leadsPorTemperatura } = dashboard;
  const leadsTotal =
    leadsPorTemperatura.quente +
    leadsPorTemperatura.muito_quente +
    leadsPorTemperatura.pronto_para_compra;

  return (
    <div className="flex flex-1 flex-col items-center bg-background px-6 py-16 font-sans">
      <main className="w-full max-w-6xl">
        <Link
          href="/corretor"
          className="text-sm text-muted transition-colors hover:text-brand-strong"
        >
          ← Voltar ao painel
        </Link>

        <header className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-strong">
            Visão da imobiliária
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
            Dashboard gerencial
          </h1>
          {nomeOrg && <p className="mt-1 text-muted">{nomeOrg}</p>}
        </header>

        {/* Faixa de KPIs */}
        <FaixaKpis
          metricas={metricas}
          tarefas={tarefas}
          leadsTotal={leadsTotal}
          prontosParaCompra={leadsPorTemperatura.pronto_para_compra}
        />

        {/* Funil por etapa + indicadores de fechamento */}
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-foreground">Funil de negócios</h2>
          <p className="mt-1 text-sm text-muted">
            Negócios em aberto por etapa — e quanto se converte em vendas.
          </p>
          <Funil metricas={metricas} />
        </section>

        {/* Ranking de corretores */}
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-foreground">Ranking de corretores</h2>
          <p className="mt-1 text-sm text-muted">
            Quem mais fecha — ordenado por valor ganho.
          </p>
          <Ranking linhas={metricas.ranking} />
        </section>

        {/* Tendência mensal + distribuição de temperatura */}
        <section className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Tendência dos últimos 6 meses
            </h2>
            <p className="mt-1 text-sm text-muted">
              Negócios criados vs. ganhos, por mês.
            </p>
            <Tendencia metricas={metricas} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Distribuição de temperatura
            </h2>
            <p className="mt-1 text-sm text-muted">
              Como estão distribuídos os {leadsTotal} lead(s) consentido(s).
            </p>
            <DistribuicaoTemperatura
              leadsPorTemperatura={leadsPorTemperatura}
              total={leadsTotal}
            />
          </div>
        </section>

        <p className="mt-8 text-xs text-subtle">
          As métricas de leads consideram apenas clientes que autorizaram o
          atendimento (LGPD).
        </p>
      </main>
    </div>
  );
}

// —— Faixa de KPIs ————————————————————————————————————————————————————————————
function FaixaKpis({
  metricas,
  tarefas,
  leadsTotal,
  prontosParaCompra,
}: {
  metricas: DashboardGerencial["metricas"];
  tarefas: DashboardGerencial["tarefas"];
  leadsTotal: number;
  prontosParaCompra: number;
}) {
  const pctConversao = Math.round(metricas.taxaConversao * 100);
  return (
    <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <CardKpi
        icone={<Handshake className="h-5 w-5" aria-hidden />}
        rotulo="Em aberto"
        valor={reaisCompacto(metricas.emAberto.valor)}
        detalhe={`${metricas.emAberto.quantidade} negócio(s) ativo(s)`}
      />
      <CardKpi
        icone={<Trophy className="h-5 w-5" aria-hidden />}
        rotulo="Ganhos no mês"
        valor={reaisCompacto(metricas.ganhosNoMes.valor)}
        detalhe={`${metricas.ganhosNoMes.quantidade} venda(s) fechada(s)`}
        destaque
      />
      <CardKpi
        icone={<Percent className="h-5 w-5" aria-hidden />}
        rotulo="Conversão"
        valor={`${pctConversao}%`}
        detalhe={`${metricas.ganhos.quantidade} de ${
          metricas.ganhos.quantidade + metricas.perdidos.quantidade
        } fechado(s)`}
      />
      <CardKpi
        icone={<Receipt className="h-5 w-5" aria-hidden />}
        rotulo="Ticket médio"
        valor={reaisCompacto(metricas.ticketMedio)}
        detalhe="por venda ganha"
      />
      <CardKpi
        icone={<Timer className="h-5 w-5" aria-hidden />}
        rotulo="Ciclo médio"
        valor={`${metricas.cicloMedioDias} dia(s)`}
        detalhe="da criação ao fechamento"
      />
      <CardKpi
        icone={<Users className="h-5 w-5" aria-hidden />}
        rotulo="Leads"
        valor={String(leadsTotal)}
        detalhe="clientes consentidos"
      />
      <CardKpi
        icone={<Flame className="h-5 w-5 text-brand" aria-hidden />}
        rotulo="Prontos p/ compra"
        valor={String(prontosParaCompra)}
        detalhe="🔥🔥🔥 no auge do interesse"
        destaque
      />
      <CardKpi
        icone={<AlarmClock className="h-5 w-5" aria-hidden />}
        rotulo="Tarefas atrasadas"
        valor={String(tarefas.atrasadas)}
        detalhe={`${tarefas.pendentes} pendente(s) no total`}
        alerta={tarefas.atrasadas > 0}
      />
    </section>
  );
}

function CardKpi({
  icone,
  rotulo,
  valor,
  detalhe,
  destaque = false,
  alerta = false,
}: {
  icone: React.ReactNode;
  rotulo: string;
  valor: string;
  detalhe: React.ReactNode;
  destaque?: boolean;
  alerta?: boolean;
}) {
  const borda = alerta
    ? "border-gold-strong/40 bg-gold-soft"
    : destaque
      ? "border-brand/30 bg-brand-soft"
      : "border-border bg-surface-card";
  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border p-5 shadow-[var(--shadow-soft)] ${borda}`}
    >
      <div
        className={`flex items-center gap-2 ${
          alerta ? "text-gold-strong" : destaque ? "text-brand-strong" : "text-subtle"
        }`}
      >
        <span className={destaque && !alerta ? "text-brand-strong" : "text-brand"}>
          {icone}
        </span>
        <span className="text-xs font-medium uppercase tracking-[0.08em]">{rotulo}</span>
      </div>
      <p
        className={`text-3xl font-semibold tabular-nums ${
          alerta ? "text-gold-strong" : "text-foreground"
        }`}
      >
        {valor}
      </p>
      <p className="text-xs text-subtle">{detalhe}</p>
    </div>
  );
}

// —— Funil por etapa + indicadores ————————————————————————————————————————————
function Funil({ metricas }: { metricas: DashboardGerencial["metricas"] }) {
  const totalNegocios =
    metricas.emAberto.quantidade +
    metricas.ganhos.quantidade +
    metricas.perdidos.quantidade;
  if (totalNegocios === 0) {
    return (
      <p className="mt-4 rounded-2xl border border-dashed border-border-strong bg-surface-card p-8 text-center text-subtle">
        Nenhum negócio registrado ainda.
      </p>
    );
  }

  // Base das barras: a maior quantidade em aberto entre as etapas.
  const maxEtapa = Math.max(
    1,
    ...ETAPAS_NEGOCIO.map((e) => metricas.porEtapa[e].quantidade),
  );
  const pctConversao = Math.round(metricas.taxaConversao * 100);

  return (
    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Barras por etapa (negócios em aberto) */}
      <div className="rounded-2xl border border-border bg-surface-card p-6 shadow-[var(--shadow-soft)] lg:col-span-2">
        <p className="mb-4 text-xs font-medium uppercase tracking-[0.08em] text-subtle">
          Em aberto por etapa
        </p>
        <div className="flex flex-col gap-3">
          {ETAPAS_NEGOCIO.map((etapa) => {
            const { quantidade, valor } = metricas.porEtapa[etapa];
            const pct = Math.round((quantidade / maxEtapa) * 100);
            return (
              <div key={etapa}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium text-foreground">
                    {ROTULOS_ETAPA[etapa]}
                  </span>
                  <span className="tabular-nums text-subtle">
                    {quantidade} · {formatarReais(valor)}
                  </span>
                </div>
                <div className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-surface">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${Math.max(pct, quantidade > 0 ? 6 : 0)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Coluna de indicadores de fechamento */}
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-brand/30 bg-brand-soft p-5 shadow-[var(--shadow-soft)]">
          <div className="flex items-center gap-2 text-brand-strong">
            <Trophy className="h-5 w-5" aria-hidden />
            <span className="text-xs font-medium uppercase tracking-[0.08em]">
              Taxa de conversão
            </span>
          </div>
          <p className="mt-3 text-4xl font-semibold tabular-nums text-brand-strong">
            {pctConversao}%
          </p>
          <p className="mt-1 text-xs text-brand-strong/80">
            {metricas.ganhos.quantidade} ganho(s) de{" "}
            {metricas.ganhos.quantidade + metricas.perdidos.quantidade} fechado(s)
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <MiniIndicador
            icone={<Handshake className="h-4 w-4" aria-hidden />}
            rotulo="Em aberto"
            valor={metricas.emAberto.quantidade}
            detalhe={formatarReais(metricas.emAberto.valor)}
          />
          <MiniIndicador
            icone={<Trophy className="h-4 w-4" aria-hidden />}
            rotulo="Ganhos"
            valor={metricas.ganhos.quantidade}
            detalhe={formatarReais(metricas.ganhos.valor)}
            destaque
          />
          <MiniIndicador
            icone={<XCircle className="h-4 w-4" aria-hidden />}
            rotulo="Perdidos"
            valor={metricas.perdidos.quantidade}
          />
        </div>
      </div>
    </div>
  );
}

function MiniIndicador({
  icone,
  rotulo,
  valor,
  detalhe,
  destaque = false,
}: {
  icone: React.ReactNode;
  rotulo: string;
  valor: number;
  detalhe?: string;
  destaque?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface-card p-4 shadow-[var(--shadow-soft)]">
      <div
        className={`flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.08em] ${
          destaque ? "text-brand-strong" : "text-subtle"
        }`}
      >
        {icone}
        <span>{rotulo}</span>
      </div>
      <p className="text-2xl font-semibold tabular-nums text-foreground">{valor}</p>
      {detalhe && <p className="text-xs text-subtle tabular-nums">{detalhe}</p>}
    </div>
  );
}

// —— Ranking de corretores ————————————————————————————————————————————————————
const MEDALHAS = ["text-gold-strong", "text-muted", "text-brand-strong"];

function Ranking({ linhas }: { linhas: DashboardGerencial["metricas"]["ranking"] }) {
  if (linhas.length === 0) {
    return (
      <p className="mt-4 rounded-2xl border border-dashed border-border-strong bg-surface-card p-8 text-center text-subtle">
        Nenhum corretor com negócios ainda.
      </p>
    );
  }
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface-card shadow-[var(--shadow-soft)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-[0.08em] text-subtle">
            <th className="px-4 py-3 font-medium">#</th>
            <th className="px-4 py-3 font-medium">Corretor</th>
            <th className="px-4 py-3 text-right font-medium">Ganhos</th>
            <th className="px-4 py-3 text-right font-medium">Valor ganho</th>
            <th className="px-4 py-3 text-right font-medium">Em aberto</th>
            <th className="px-4 py-3 text-right font-medium">Conversão</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((c, i) => {
            const topo = i < 3;
            return (
              <tr
                key={c.corretorId}
                className={`border-b border-border last:border-0 hover:bg-surface ${
                  i === 0 ? "bg-brand-soft/50" : ""
                }`}
              >
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 tabular-nums text-subtle">
                    {topo ? (
                      <Medal className={`h-4 w-4 ${MEDALHAS[i]}`} aria-hidden />
                    ) : null}
                    {i + 1}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium text-foreground">{c.nome}</td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-brand-strong">
                  {c.ganhos}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-foreground">
                  {formatarReais(c.valorGanho)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted">
                  {c.emAberto}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted">
                  {Math.round(c.conversao * 100)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// —— Tendência mensal (mini gráfico de barras CSS) ————————————————————————————
function Tendencia({ metricas }: { metricas: DashboardGerencial["metricas"] }) {
  const pontos = metricas.tendencia;
  const max = Math.max(
    1,
    ...pontos.map((p) => Math.max(p.criados, p.ganhos)),
  );
  const temDados = pontos.some((p) => p.criados > 0 || p.ganhos > 0);

  return (
    <div className="mt-4 rounded-2xl border border-border bg-surface-card p-6 shadow-[var(--shadow-soft)]">
      {!temDados ? (
        <p className="py-6 text-center text-sm text-subtle">
          Sem movimentação nos últimos 6 meses.
        </p>
      ) : (
        <>
          <div className="flex items-end justify-between gap-3">
            {pontos.map((p) => {
              const hCriados = Math.round((p.criados / max) * 100);
              const hGanhos = Math.round((p.ganhos / max) * 100);
              return (
                <div key={p.mes} className="flex flex-1 flex-col items-center gap-1">
                  {/* Área das barras com altura DEFINIDA (px) para o % resolver */}
                  <div
                    className="flex w-full items-end justify-center gap-1"
                    style={{ height: 130 }}
                  >
                    <div
                      className="w-1/2 max-w-[18px] rounded-t bg-border-strong"
                      style={{ height: `${Math.max(hCriados, p.criados > 0 ? 6 : 0)}%` }}
                      title={`${p.criados} criado(s)`}
                    />
                    <div
                      className="w-1/2 max-w-[18px] rounded-t bg-brand"
                      style={{ height: `${Math.max(hGanhos, p.ganhos > 0 ? 6 : 0)}%` }}
                      title={`${p.ganhos} ganho(s)`}
                    />
                  </div>
                  <span className="text-[11px] tabular-nums text-subtle">
                    {rotuloMes(p.mes)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-center gap-4 text-xs text-subtle">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-border-strong" aria-hidden />
              Criados
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-brand" aria-hidden />
              Ganhos
            </span>
            <span className="ml-auto inline-flex items-center gap-1 text-subtle">
              <TrendingUp className="h-3.5 w-3.5" aria-hidden />
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// —— Barras de temperatura —————————————————————————————————————————————————
function DistribuicaoTemperatura({
  leadsPorTemperatura,
  total,
}: {
  leadsPorTemperatura: Record<Temperatura, number>;
  total: number;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-border bg-surface-card p-6 shadow-[var(--shadow-soft)]">
      {total === 0 ? (
        <p className="py-6 text-center text-sm text-subtle">
          Nenhum lead consentido ainda.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {TEMPERATURAS.map((t) => {
            const n = leadsPorTemperatura[t.chave];
            const pct = Math.round((n / total) * 100);
            return (
              <div key={t.chave}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium text-foreground">
                    <span aria-hidden className="mr-1">
                      {t.chamas}
                    </span>
                    {t.rotulo}
                  </span>
                  <span className="tabular-nums text-subtle">
                    {n} · {pct}%
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-surface">
                  <div
                    className={`h-full rounded-full ${t.barra}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
