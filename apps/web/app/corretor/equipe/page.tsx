// DASHBOARD DO GESTOR (ESCOPO §5 — visão da imobiliária). Server Component com
// GATE de papel: só gestor/admin; corretor comum é redirecionado ao painel.
// KPIs da org, distribuição de temperatura e desempenho por corretor. Todas as
// métricas passam pela RLS multi-tenant + PORTÃO DE CONSENTIMENTO LGPD (leads só
// de clientes que autorizaram o atendimento) — aqui só apresentamos.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, Users, Flame, UserRound } from "lucide-react";
import type { Temperatura } from "@imobia/domain";
import { obterPerfil, obterSessao } from "@/lib/auth/sessao";
import {
  desempenhoPorCorretor,
  obterNomeOrg,
  resumoDaOrg,
  type DesempenhoCorretor,
  type ResumoOrg,
} from "@/lib/dados/gestor";
import { tempoRelativo } from "../leads/tempo";

export const metadata: Metadata = { title: "Equipe — ImobIA" };
export const dynamic = "force-dynamic";

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

  const [resumo, desempenho, nomeOrg] = await Promise.all([
    resumoDaOrg(),
    desempenhoPorCorretor(),
    obterNomeOrg(),
  ]);

  return (
    <div className="flex flex-1 flex-col items-center bg-background px-6 py-16 font-sans">
      <main className="w-full max-w-5xl">
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
            Equipe
          </h1>
          {nomeOrg && <p className="mt-1 text-muted">{nomeOrg}</p>}
        </header>

        {/* KPI cards */}
        <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CardKpi
            icone={<Building2 className="h-5 w-5" aria-hidden />}
            rotulo="Imóveis"
            valor={resumo.imoveisTotal}
            detalhe={
              <>
                {resumo.imoveisPorStatus.disponivel} disponível(is) ·{" "}
                {resumo.imoveisPorStatus.reservado} reservado(s) ·{" "}
                {resumo.imoveisPorStatus.vendido} vendido(s)
              </>
            }
          />
          <CardKpi
            icone={<Users className="h-5 w-5" aria-hidden />}
            rotulo="Leads"
            valor={resumo.leadsTotal}
            detalhe="clientes que autorizaram o atendimento"
          />
          <CardKpi
            icone={<Flame className="h-5 w-5 text-brand" aria-hidden />}
            rotulo="Prontos para compra"
            valor={resumo.leadsPorTemperatura.pronto_para_compra}
            detalhe="🔥🔥🔥 no auge do interesse"
            destaque
          />
          <CardKpi
            icone={<UserRound className="h-5 w-5" aria-hidden />}
            rotulo="Corretores"
            valor={resumo.corretoresTotal}
            detalhe="na equipe"
          />
        </section>

        {/* Distribuição de temperatura */}
        <section className="mt-8 rounded-2xl border border-border bg-surface-card p-6 shadow-[var(--shadow-soft)]">
          <h2 className="text-lg font-semibold text-foreground">
            Distribuição de temperatura
          </h2>
          <p className="mt-1 text-sm text-muted">
            Como estão distribuídos os {resumo.leadsTotal} lead(s) consentido(s).
          </p>
          <DistribuicaoTemperatura resumo={resumo} />
        </section>

        {/* Desempenho por corretor */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-foreground">
            Desempenho por corretor
          </h2>
          <TabelaDesempenho linhas={desempenho} />
        </section>

        <p className="mt-6 text-xs text-subtle">
          As métricas consideram apenas clientes que autorizaram o atendimento.
        </p>
      </main>
    </div>
  );
}

// —— KPI card ————————————————————————————————————————————————————————————————
function CardKpi({
  icone,
  rotulo,
  valor,
  detalhe,
  destaque = false,
}: {
  icone: React.ReactNode;
  rotulo: string;
  valor: number;
  detalhe: React.ReactNode;
  destaque?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border bg-surface-card p-5 shadow-[var(--shadow-soft)] ${
        destaque ? "border-brand/30 bg-brand-soft" : "border-border"
      }`}
    >
      <div className="flex items-center gap-2 text-subtle">
        <span className={destaque ? "text-brand-strong" : "text-brand"}>{icone}</span>
        <span className="text-xs font-medium uppercase tracking-[0.08em]">{rotulo}</span>
      </div>
      <p className="text-3xl font-semibold tabular-nums text-foreground">{valor}</p>
      <p className="text-xs text-subtle">{detalhe}</p>
    </div>
  );
}

// —— Barras de temperatura —————————————————————————————————————————————————
function DistribuicaoTemperatura({ resumo }: { resumo: ResumoOrg }) {
  const total = resumo.leadsTotal;
  if (total === 0) {
    return (
      <p className="mt-4 rounded-xl border border-dashed border-border-strong bg-surface p-4 text-center text-sm text-subtle">
        Nenhum lead consentido ainda.
      </p>
    );
  }
  return (
    <div className="mt-5 flex flex-col gap-4">
      {TEMPERATURAS.map((t) => {
        const n = resumo.leadsPorTemperatura[t.chave];
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
  );
}

// —— Tabela de desempenho ——————————————————————————————————————————————————
function TabelaDesempenho({ linhas }: { linhas: DesempenhoCorretor[] }) {
  if (linhas.length === 0) {
    return (
      <p className="mt-4 rounded-2xl border border-dashed border-border-strong bg-surface-card p-8 text-center text-subtle">
        Nenhum corretor na equipe ainda.
      </p>
    );
  }
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface-card shadow-[var(--shadow-soft)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-[0.08em] text-subtle">
            <th className="px-4 py-3 font-medium">Corretor</th>
            <th className="px-4 py-3 text-right font-medium">Imóveis</th>
            <th className="px-4 py-3 text-right font-medium">Leads</th>
            <th className="px-4 py-3 text-right font-medium">Quentes</th>
            <th className="px-4 py-3 text-right font-medium">Última atividade</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((c) => (
            <tr
              key={c.corretorId}
              className="border-b border-border last:border-0 hover:bg-surface"
            >
              <td className="px-4 py-3 font-medium text-foreground">
                {c.nome ?? "Corretor"}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-muted">{c.imoveis}</td>
              <td className="px-4 py-3 text-right tabular-nums text-muted">{c.leads}</td>
              <td className="px-4 py-3 text-right tabular-nums font-semibold text-brand-strong">
                {c.leadsQuentes}
              </td>
              <td className="px-4 py-3 text-right text-subtle">
                {tempoRelativo(c.ultimoEventoEm)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
