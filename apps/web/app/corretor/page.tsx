// PAINEL PESSOAL DO CORRETOR (área /corretor). Server Component: mostra os KPIs
// do próprio corretor logado (negócios em aberto, ganhos no mês, conversão,
// tarefas atrasadas/pendentes) + um mini-funil pessoal, e preserva os atalhos de
// navegação para as demais telas. Gestor/admin também ganham o CTA da Equipe.
//
// Dados via dashboardGerencial("meu") (métricas do funil do próprio corretor +
// contagem de tarefas) e minhasTarefas (para o total de pendentes). Sessão
// anônima é redirecionada ao login. Dinheiro em CENTAVOS; formatação pt-BR.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Handshake,
  Trophy,
  Percent,
  ListTodo,
  Building2,
  Users,
  Sparkles,
  CalendarDays,
  KanbanSquare,
  CheckSquare,
  UsersRound,
  ArrowRight,
  AlertTriangle,
  UserCircle,
  Target,
  CheckCircle2,
  PartyPopper,
} from "lucide-react";
import { formatarReais } from "@imobia/core";
import { ETAPAS_NEGOCIO, type EtapaNegocio } from "@imobia/domain";
import { obterPerfil, obterSessao } from "@/lib/auth/sessao";
import { dashboardGerencial } from "@/lib/dados/metricas";
import { minhasTarefas } from "@/lib/dados/tarefas";
import { obterNomeOrg } from "@/lib/dados/gestor";
import { prioridades, type ItemPrioridade, type NivelPrioridade } from "@/lib/dados/prioridades";
import { listarMetasComProgresso, type MetaComProgresso } from "@/lib/dados/metas";

export const metadata: Metadata = { title: "Painel do corretor — ImobIA" };
export const dynamic = "force-dynamic";

const ROTULOS_ETAPA: Record<EtapaNegocio, string> = {
  novo: "Novo",
  contato: "Contato",
  visita: "Visita",
  proposta: "Proposta",
  fechamento: "Fechamento",
};

export default async function PainelCorretor({
  searchParams,
}: {
  searchParams: Promise<{ bemvindo?: string }>;
}) {
  const sessao = await obterSessao();
  if (!sessao) {
    redirect("/entrar");
  }
  const { bemvindo } = await searchParams;
  const perfil = await obterPerfil(sessao.usuarioId);
  const papel = perfil?.papel ?? "cliente";
  const ehGestor = papel === "gestor" || papel === "admin";

  const [dashboard, tarefas, nomeOrg, itensPrioridade, metasOrg] = await Promise.all([
    dashboardGerencial("meu"),
    minhasTarefas(),
    obterNomeOrg(),
    prioridades("meu"),
    listarMetasComProgresso("org"),
  ]);

  const { metricas, tarefas: resumoTarefas } = dashboard;
  const pctConversao = Math.round(metricas.taxaConversao * 100);
  const tarefasPendentes = tarefas.length;

  return (
    <div className="flex flex-1 flex-col items-center bg-background px-6 py-16 font-sans">
      <main className="w-full max-w-5xl">
        {/* Cabeçalho */}
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-strong">
            Meu painel
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
            Olá, {perfil?.nome ?? sessao.email ?? "corretor"}
          </h1>
          <p className="mt-1 text-muted">
            {nomeOrg ? nomeOrg : "Sua atividade em um só lugar"}
          </p>
        </header>

        {/* Boas-vindas pós-onboarding (?bemvindo=1) — sutil, some ao navegar. */}
        {bemvindo === "1" && (
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-gold/40 bg-gold-soft px-5 py-4">
            <PartyPopper className="h-5 w-5 shrink-0 text-gold-strong" aria-hidden />
            <p className="text-sm text-foreground">
              <strong>Cadastro concluído!</strong> Sua vitrine já está no ar — explore
              o painel e bons negócios.
            </p>
          </div>
        )}

        {/* DESTAQUE — Onde agir agora (fila de prioridades pessoal) */}
        <OndeAgirAgora itens={itensPrioridade} ehGestor={ehGestor} />

        {/* KPIs pessoais */}
        <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CardKpi
            icone={<Handshake className="h-5 w-5" aria-hidden />}
            rotulo="Em aberto"
            valor={String(metricas.emAberto.quantidade)}
            detalhe={formatarReais(metricas.emAberto.valor)}
          />
          <CardKpi
            icone={<Trophy className="h-5 w-5 text-brand-strong" aria-hidden />}
            rotulo="Ganhos no mês"
            valor={String(metricas.ganhosNoMes.quantidade)}
            detalhe={formatarReais(metricas.ganhosNoMes.valor)}
            destaque
          />
          <CardKpi
            icone={<Percent className="h-5 w-5" aria-hidden />}
            rotulo="Conversão"
            valor={`${pctConversao}%`}
            detalhe={`${metricas.ganhos.quantidade} ganho(s) de ${
              metricas.ganhos.quantidade + metricas.perdidos.quantidade
            } fechado(s)`}
          />
          <CardKpi
            icone={
              resumoTarefas.atrasadas > 0 ? (
                <AlertTriangle className="h-5 w-5 text-gold-strong" aria-hidden />
              ) : (
                <ListTodo className="h-5 w-5" aria-hidden />
              )
            }
            rotulo="Tarefas"
            valor={String(tarefasPendentes)}
            detalhe={
              resumoTarefas.atrasadas > 0
                ? `${resumoTarefas.atrasadas} atrasada(s)`
                : "pendente(s)"
            }
            alerta={resumoTarefas.atrasadas > 0}
          />
        </section>

        {/* Mini-funil pessoal */}
        <section className="mt-8 rounded-2xl border border-border bg-surface-card p-6 shadow-[var(--shadow-soft)]">
          <h2 className="text-lg font-semibold text-foreground">Meu funil</h2>
          <p className="mt-1 text-sm text-muted">
            Seus negócios em aberto, por etapa.
          </p>
          <MiniFunil porEtapa={metricas.porEtapa} />
        </section>

        {/* Metas da empresa (read-only para o corretor: o alvo do time) */}
        <MetasDaEmpresa metas={metasOrg} />

        {/* Atalhos de navegação — TODOS num único bloco */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-foreground">Atalhos</h2>
          <nav className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <CardAtalho
              href="/corretor/coringa"
              icone={<Sparkles className="h-5 w-5" aria-hidden />}
              titulo="Coringa"
              descricao="Sua ferramenta rápida do dia a dia"
              destaque
            />
            <CardAtalho
              href="/corretor/assistente"
              icone={<Sparkles className="h-5 w-5" aria-hidden />}
              titulo="Assistente"
              descricao="Fale ou digite — ela preenche o CRM por você"
              destaque
            />
            <CardAtalho
              href="/corretor/agenda"
              icone={<CalendarDays className="h-5 w-5" aria-hidden />}
              titulo="Agenda"
              descricao="Seus compromissos e visitas da semana"
            />
            <CardAtalho
              href="/corretor/perfil"
              icone={<UserCircle className="h-5 w-5" aria-hidden />}
              titulo="Meu perfil"
              descricao="Sua vitrine, conquistas e depoimentos"
            />
            <CardAtalho
              href="/corretor/imoveis"
              icone={<Building2 className="h-5 w-5" aria-hidden />}
              titulo="Meus imóveis"
              descricao="Seu portfólio de imóveis"
            />
            <CardAtalho
              href="/corretor/leads"
              icone={<Users className="h-5 w-5" aria-hidden />}
              titulo="Leads"
              descricao="Clientes que autorizaram atendimento"
            />
            <CardAtalho
              href="/corretor/negocios"
              icone={<KanbanSquare className="h-5 w-5" aria-hidden />}
              titulo="Negócios"
              descricao="Seu funil de vendas"
            />
            <CardAtalho
              href="/corretor/tarefas"
              icone={<CheckSquare className="h-5 w-5" aria-hidden />}
              titulo="Tarefas"
              descricao="Seus to-dos e prazos"
            />
            {ehGestor && (
              <CardAtalho
                href="/corretor/equipe"
                icone={<UsersRound className="h-5 w-5" aria-hidden />}
                titulo="Equipe"
                descricao="Visão da imobiliária"
              />
            )}
          </nav>
        </section>

        {/* CTA para o dashboard da equipe (gestor/admin) */}
        {ehGestor && (
          <Link
            href="/corretor/equipe"
            className="mt-8 flex items-center justify-between gap-4 rounded-2xl border border-brand/30 bg-brand-soft p-6 shadow-[var(--shadow-soft)] transition-colors hover:bg-brand-soft/70"
          >
            <div>
              <p className="flex items-center gap-2 text-base font-semibold text-brand-strong">
                <UsersRound className="h-5 w-5" aria-hidden />
                Ver dashboard da equipe
              </p>
              <p className="mt-1 text-sm text-brand-strong/80">
                KPIs da org, funil consolidado e desempenho por corretor.
              </p>
            </div>
            <ArrowRight className="h-5 w-5 shrink-0 text-brand-strong" aria-hidden />
          </Link>
        )}
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
    ? "border-gold/40 bg-gold-soft"
    : destaque
      ? "border-brand/30 bg-brand-soft"
      : "border-border bg-surface-card";
  const corIcone = alerta ? "text-gold-strong" : destaque ? "text-brand-strong" : "text-brand";
  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border p-5 shadow-[var(--shadow-soft)] ${borda}`}
    >
      <div className="flex items-center gap-2 text-subtle">
        <span className={corIcone}>{icone}</span>
        <span className="text-xs font-medium uppercase tracking-[0.08em]">{rotulo}</span>
      </div>
      <p className="text-3xl font-semibold tabular-nums text-foreground">{valor}</p>
      <p className="text-xs text-subtle tabular-nums">{detalhe}</p>
    </div>
  );
}

// —— Mini-funil pessoal ————————————————————————————————————————————————————
function MiniFunil({
  porEtapa,
}: {
  porEtapa: Record<EtapaNegocio, { quantidade: number; valor: number }>;
}) {
  const totalAberto = ETAPAS_NEGOCIO.reduce(
    (soma, e) => soma + porEtapa[e].quantidade,
    0,
  );
  if (totalAberto === 0) {
    return (
      <p className="mt-4 rounded-xl border border-dashed border-border-strong bg-surface p-4 text-center text-sm text-subtle">
        Nenhum negócio em aberto. Comece pelos seus leads.
      </p>
    );
  }
  const maxEtapa = Math.max(1, ...ETAPAS_NEGOCIO.map((e) => porEtapa[e].quantidade));
  return (
    <div className="mt-5 flex flex-col gap-3">
      {ETAPAS_NEGOCIO.map((etapa) => {
        const { quantidade, valor } = porEtapa[etapa];
        const pct = Math.round((quantidade / maxEtapa) * 100);
        return (
          <div key={etapa}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium text-foreground">{ROTULOS_ETAPA[etapa]}</span>
              <span className="tabular-nums text-subtle">
                {quantidade} · {formatarReais(valor)}
              </span>
            </div>
            <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-surface">
              <div
                className="h-full rounded-full bg-brand"
                style={{ width: `${Math.max(pct, quantidade > 0 ? 6 : 0)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// —— Card de atalho ————————————————————————————————————————————————————————
function CardAtalho({
  href,
  icone,
  titulo,
  descricao,
  destaque = false,
}: {
  href: string;
  icone: React.ReactNode;
  titulo: string;
  descricao: string;
  destaque?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group flex items-start gap-3 rounded-2xl border p-5 shadow-[var(--shadow-soft)] transition-colors ${
        destaque
          ? "border-brand/30 bg-brand-soft hover:bg-brand-soft/70"
          : "border-border bg-surface-card hover:border-brand/40 hover:bg-surface"
      }`}
    >
      <span className={destaque ? "text-brand-strong" : "text-brand"}>{icone}</span>
      <span className="flex flex-col gap-0.5">
        <span className="flex items-center gap-1.5 font-semibold text-foreground">
          {titulo}
          <ArrowRight
            className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
            aria-hidden
          />
        </span>
        <span className="text-xs text-subtle">{descricao}</span>
      </span>
    </Link>
  );
}

// —— Onde agir agora (fila de prioridades) ————————————————————————————————————
// Selo por nível: crítico/parado = brand (vermelho quente), alto/atrasada = gold,
// médio/lead quente = brand-soft. As cores derivam do nível já resolvido na
// camada de dados (parado→crítico, atrasada→crítico/alto, lead→médio).
const ESTILO_SELO: Record<
  NivelPrioridade,
  { selo: string; icone: string; rotulo: string }
> = {
  critico: {
    selo: "bg-brand text-white",
    icone: "text-brand-strong",
    rotulo: "Urgente",
  },
  alto: {
    selo: "bg-gold-soft text-gold-strong",
    icone: "text-gold-strong",
    rotulo: "Atenção",
  },
  medio: {
    selo: "bg-brand-soft text-brand-strong",
    icone: "text-brand-strong",
    rotulo: "Oportunidade",
  },
};

function OndeAgirAgora({
  itens,
  ehGestor,
}: {
  itens: ItemPrioridade[];
  ehGestor: boolean;
}) {
  return (
    <section className="mt-8 rounded-2xl border border-brand/30 bg-surface-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Sparkles className="h-5 w-5 text-brand-strong" aria-hidden />
            Onde agir agora
          </h2>
          <p className="mt-1 text-sm text-muted">
            Suas ações mais urgentes, priorizadas.
          </p>
        </div>
        {ehGestor && (
          <Link
            href="/corretor/equipe"
            className="hidden shrink-0 items-center gap-1.5 rounded-xl border border-brand/30 bg-brand-soft px-3 py-2 text-xs font-semibold text-brand-strong transition-colors hover:bg-brand-soft/70 sm:flex"
          >
            <UsersRound className="h-4 w-4" aria-hidden />
            Dashboard da equipe
          </Link>
        )}
      </div>

      {itens.length === 0 ? (
        <p className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong bg-surface p-6 text-center text-sm font-medium text-foreground">
          <CheckCircle2 className="h-5 w-5 text-brand-strong" aria-hidden />
          Tudo em dia! Nenhuma ação urgente.
        </p>
      ) : (
        <ul className="mt-5 flex flex-col gap-2.5">
          {itens.map((item) => {
            const Icone = item.icone;
            const estilo = ESTILO_SELO[item.nivel];
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-brand/40 hover:bg-surface-card"
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-card ${estilo.icone}`}
                  >
                    <Icone className="h-4.5 w-4.5" aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate font-semibold text-foreground">
                      {item.titulo}
                    </span>
                    <span className="truncate text-xs text-subtle">
                      {item.subtitulo}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.06em] ${estilo.selo}`}
                  >
                    {estilo.rotulo}
                  </span>
                  <ArrowRight
                    className="h-4 w-4 shrink-0 -translate-x-1 text-subtle opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// —— Metas da empresa (read-only para o corretor) ————————————————————————————
function MetasDaEmpresa({ metas }: { metas: MetaComProgresso[] }) {
  const formatarValor = (m: MetaComProgresso, n: number) =>
    m.monetaria ? formatarReais(n) : String(n);
  return (
    <section className="mt-8 rounded-2xl border border-border bg-surface-card p-6 shadow-[var(--shadow-soft)]">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
        <Target className="h-5 w-5 text-brand-strong" aria-hidden />
        Metas da empresa
      </h2>
      <p className="mt-1 text-sm text-muted">
        O alvo do time neste mês — acompanhe para onde estamos indo juntos.
      </p>
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {metas.map((m) => {
          const pct = Math.round(m.progresso * 100);
          const semAlvo = m.alvo <= 0;
          return (
            <div key={m.tipo}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  {m.rotulo}
                  {m.atingida && !semAlvo && (
                    <CheckCircle2 className="h-4 w-4 text-brand-strong" aria-hidden />
                  )}
                </span>
                <span className="tabular-nums text-subtle">
                  {semAlvo ? (
                    <>{formatarValor(m, m.atual)} · sem meta</>
                  ) : (
                    <>
                      {formatarValor(m, m.atual)}{" "}
                      <span className="text-subtle/70">/ {formatarValor(m, m.alvo)}</span>
                    </>
                  )}
                </span>
              </div>
              <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-surface">
                <div
                  className={`h-full rounded-full ${m.atingida && !semAlvo ? "bg-gold" : "bg-brand"}`}
                  style={{ width: `${semAlvo ? 0 : Math.max(pct, m.atual > 0 ? 4 : 0)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
