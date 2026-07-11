// VISTAS DO FUNIL DE RELACIONAMENTO (Server Components de apresentação):
// chips de funil, alternador Lista|Kanban|Relatório, contadores, kanban por
// etapa e relatório com barras — espelho do padrão "CRM operacional" (ref.
// MRA) no design system quente do ImobIA. Dinheiro em CENTAVOS (formatarReais).

import Link from "next/link";
import {
  BarChart3,
  Flame,
  KanbanSquare,
  LayoutList,
  Settings2,
  Trophy,
} from "lucide-react";
import { formatarReais } from "@imobia/core";
import type { RelatorioFunil } from "@imobia/core";
import type { ContatoDoFunil, FunilResumo } from "@/lib/dados/funis";
import { tempoRelativo } from "../leads/tempo";
import { MoverEtapa } from "./MoverEtapa";

/** Query string preservando o funil — cada vista é URL-driven. */
function hrefVista(funilId: string, vista: string, etapa?: string): string {
  const p = new URLSearchParams({ funil: funilId, vista });
  if (etapa) {
    p.set("etapa", etapa);
  }
  return `/corretor/crm?${p.toString()}`;
}

// ——— Chips de funil ————————————————————————————————————————————————————————

export function ChipsFunis({
  funis,
  contagens,
  funilAtivo,
  ehGestor,
}: {
  funis: FunilResumo[];
  contagens: Record<string, number>;
  funilAtivo: string | null;
  ehGestor: boolean;
}) {
  const base =
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]";
  const ativo = "border-brand bg-brand-soft text-brand-strong";
  const inativo =
    "border-border bg-surface-card text-muted hover:border-brand/40 hover:text-foreground";

  return (
    <nav aria-label="Funis de relacionamento" className="mt-5 flex flex-wrap items-center gap-2">
      <Link
        href="/corretor/crm"
        aria-current={funilAtivo === null ? "true" : undefined}
        className={`${base} ${funilAtivo === null ? ativo : inativo}`}
      >
        Todos
      </Link>
      {funis.map((f) => (
        <Link
          key={f.id}
          href={hrefVista(f.id, "kanban")}
          aria-current={funilAtivo === f.id ? "true" : undefined}
          className={`${base} ${funilAtivo === f.id ? ativo : inativo}`}
        >
          {f.emoji && <span aria-hidden>{f.emoji}</span>}
          {f.nome}
          <span className="tabular-nums text-xs text-subtle">{contagens[f.id] ?? 0}</span>
        </Link>
      ))}
      {ehGestor && (
        <Link
          href="/corretor/crm/funis"
          className={`${base} ${inativo} border-dashed`}
          title="Criar e editar funis"
        >
          <Settings2 className="h-3.5 w-3.5" aria-hidden />
          Funis
        </Link>
      )}
    </nav>
  );
}

// ——— Contadores + alternador ———————————————————————————————————————————————

export function BarraDoFunil({
  funil,
  relatorio,
  vista,
}: {
  funil: FunilResumo;
  relatorio: RelatorioFunil;
  vista: "lista" | "kanban" | "relatorio";
}) {
  const contadores = [
    { rotulo: "Total", valor: String(relatorio.kpis.total) },
    { rotulo: "Entraram hoje", valor: String(relatorio.kpis.hoje) },
    { rotulo: "A contatar", valor: String(relatorio.aContatarTotal), fogo: true },
    { rotulo: "Ganhos", valor: String(relatorio.kpis.ganhos) },
  ];
  const vistas = [
    { chave: "lista", rotulo: "Lista", icone: <LayoutList className="h-4 w-4" aria-hidden /> },
    { chave: "kanban", rotulo: "Kanban", icone: <KanbanSquare className="h-4 w-4" aria-hidden /> },
    {
      chave: "relatorio",
      rotulo: "Relatório",
      icone: <BarChart3 className="h-4 w-4" aria-hidden />,
    },
  ] as const;

  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
      <dl className="flex flex-wrap items-center gap-2">
        {contadores.map((c) => (
          <div
            key={c.rotulo}
            className="flex items-baseline gap-1.5 rounded-xl border border-border bg-surface-card px-3 py-1.5"
          >
            <dt className="text-xs text-subtle">
              {c.fogo ? (
                <span className="inline-flex items-center gap-1">
                  <Flame className="h-3.5 w-3.5 text-brand" aria-hidden />
                  {c.rotulo}
                </span>
              ) : (
                c.rotulo
              )}
            </dt>
            <dd className="text-sm font-semibold tabular-nums text-foreground">{c.valor}</dd>
          </div>
        ))}
      </dl>
      <nav aria-label="Modo de visualização" className="flex items-center gap-1 rounded-full border border-border bg-surface-card p-1">
        {vistas.map((v) => (
          <Link
            key={v.chave}
            href={hrefVista(funil.id, v.chave)}
            aria-current={vista === v.chave ? "true" : undefined}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
              vista === v.chave
                ? "bg-brand text-brand-contrast"
                : "text-muted hover:text-foreground"
            }`}
          >
            {v.icone}
            {v.rotulo}
          </Link>
        ))}
      </nav>
    </div>
  );
}

// ——— Card de contato (kanban/lista do funil) ———————————————————————————————

function CardContatoFunil({
  contato,
  funil,
}: {
  contato: ContatoDoFunil;
  funil: FunilResumo;
}) {
  return (
    <article className="rounded-2xl border border-border bg-surface-card p-3 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/corretor/crm/contatos/${contato.id}`}
          className="min-w-0 font-semibold text-foreground hover:text-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <span className="block truncate">{contato.nome}</span>
        </Link>
        <span className="flex shrink-0 items-center gap-1">
          {contato.ganho && (
            <span title="Tem negócio ganho">
              <Trophy className="h-4 w-4 text-gold" aria-label="Tem negócio ganho" />
            </span>
          )}
          {contato.aContatar && (
            <span title="Precisa de contato">
              <Flame className="h-4 w-4 text-brand" aria-label="Precisa de contato" />
            </span>
          )}
        </span>
      </div>
      {contato.telefoneFormatado !== null && (
        <p className="mt-0.5 truncate text-xs text-muted">{contato.telefoneFormatado}</p>
      )}
      <p className="mt-1 text-[11px] text-subtle">
        {contato.ultimaInteracaoEm
          ? `interação ${tempoRelativo(contato.ultimaInteracaoEm)}`
          : "sem interação ainda"}
      </p>
      {contato.tags.length > 0 && (
        <p className="mt-1.5 flex flex-wrap gap-1">
          {contato.tags.slice(0, 3).map((t) => (
            <span
              key={t}
              className="inline-flex items-center rounded-full bg-badge-neutro-bg px-1.5 py-0.5 text-[10px] font-medium text-badge-neutro-fg ring-1 ring-inset ring-border-strong/60"
            >
              {t}
            </span>
          ))}
        </p>
      )}
      <div className="mt-2">
        <MoverEtapa
          contatoId={contato.id}
          funis={[{ id: funil.id, nome: funil.nome, emoji: funil.emoji, etapas: funil.etapas }]}
          funilAtual={funil.id}
          etapaAtual={contato.etapaChave}
          compacto
        />
      </div>
    </article>
  );
}

// ——— Kanban ————————————————————————————————————————————————————————————————

export function VistaKanban({
  funil,
  contatos,
}: {
  funil: FunilResumo;
  contatos: ContatoDoFunil[];
}) {
  const chavesConhecidas = new Set(funil.etapas.map((e) => e.chave));
  const semEtapa = contatos.filter(
    (c) => c.etapaChave === null || !chavesConhecidas.has(c.etapaChave),
  );

  const colunas = [
    ...(semEtapa.length > 0
      ? [{ chave: null as string | null, nome: "Sem etapa", cor: null as string | null, itens: semEtapa }]
      : []),
    ...funil.etapas.map((e) => ({
      chave: e.chave as string | null,
      nome: e.nome,
      cor: e.cor ?? null,
      itens: contatos.filter((c) => c.etapaChave === e.chave),
    })),
  ];

  return (
    <div className="mt-5 overflow-x-auto pb-2" role="region" aria-label={`Kanban do funil ${funil.nome}`}>
      <div className="flex min-w-max gap-3">
        {colunas.map((col) => {
          const fogo = col.itens.filter((c) => c.aContatar).length;
          return (
            <section
              key={col.chave ?? "__sem_etapa"}
              className="w-64 shrink-0 rounded-2xl border border-border bg-surface p-2"
            >
              <header className="flex items-center justify-between gap-2 px-1.5 py-1">
                <p className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-foreground">
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: col.cor ?? "var(--color-border-strong)" }}
                  />
                  <span className="truncate">{col.nome}</span>
                </p>
                <p className="flex shrink-0 items-center gap-1.5 text-xs tabular-nums text-subtle">
                  {col.itens.length}
                  {fogo > 0 && (
                    <span className="inline-flex items-center gap-0.5 font-semibold text-brand">
                      <Flame className="h-3 w-3" aria-hidden />
                      {fogo}
                    </span>
                  )}
                </p>
              </header>
              <div className="mt-1 flex flex-col gap-2">
                {col.itens.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-subtle">
                    Sem contatos
                  </p>
                ) : (
                  col.itens.map((c) => <CardContatoFunil key={c.id} contato={c} funil={funil} />)
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

// ——— Lista do funil ————————————————————————————————————————————————————————

export function VistaListaFunil({
  funil,
  contatos,
  etapaFiltro,
}: {
  funil: FunilResumo;
  contatos: ContatoDoFunil[];
  etapaFiltro?: string;
}) {
  const filtrados =
    etapaFiltro && funil.etapas.some((e) => e.chave === etapaFiltro)
      ? contatos.filter((c) => c.etapaChave === etapaFiltro)
      : contatos;
  const nomeEtapa = funil.etapas.find((e) => e.chave === etapaFiltro)?.nome;

  return (
    <div className="mt-5">
      {nomeEtapa && (
        <p className="mb-3 text-sm text-muted">
          Filtrando pela etapa <strong className="text-foreground">{nomeEtapa}</strong> ·{" "}
          <Link href={hrefVista(funil.id, "lista")} className="text-brand-strong underline-offset-2 hover:underline">
            limpar
          </Link>
        </p>
      )}
      {filtrados.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-subtle">
          Nenhum contato aqui ainda.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((c) => (
            <li key={c.id}>
              <CardContatoFunil contato={c} funil={funil} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ——— Relatório —————————————————————————————————————————————————————————————

/** R$ compacto para os cards ("R$ 8,8 mi") — o valor exato vai no title. */
function reaisCompacto(centavos: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(centavos / 100);
}

export function VistaRelatorio({
  funil,
  relatorio,
}: {
  funil: FunilResumo;
  relatorio: RelatorioFunil;
}) {
  const kpis = relatorio.kpis;
  const cards: { rotulo: string; valor: string; titulo?: string; destaque?: boolean }[] = [
    { rotulo: "Hoje", valor: String(kpis.hoje) },
    { rotulo: "Últimos 7 dias", valor: String(kpis.ultimos7) },
    { rotulo: "Últimos 30 dias", valor: String(kpis.ultimos30) },
    { rotulo: "Total", valor: String(kpis.total) },
    { rotulo: "Ganhos", valor: String(kpis.ganhos), destaque: true },
    { rotulo: "Conversão", valor: `${Math.round(kpis.conversao * 100)}%` },
    {
      rotulo: "Receita no funil",
      valor: reaisCompacto(kpis.receitaFunilCentavos),
      titulo: formatarReais(kpis.receitaFunilCentavos),
    },
    {
      rotulo: "Receita ganha",
      valor: reaisCompacto(kpis.receitaGanhaCentavos),
      titulo: formatarReais(kpis.receitaGanhaCentavos),
      destaque: true,
    },
  ];
  const maximo = Math.max(1, ...relatorio.porEtapa.map((e) => e.total));

  return (
    <div className="mt-5">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.rotulo}
            title={c.titulo}
            className={`rounded-2xl border p-4 shadow-[var(--shadow-soft)] ${
              c.destaque ? "border-brand/30 bg-brand-soft" : "border-border bg-surface-card"
            }`}
          >
            <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-subtle">
              {c.rotulo}
            </dt>
            <dd
              className={`mt-1 text-2xl font-semibold tabular-nums ${
                c.destaque ? "text-brand-strong" : "text-foreground"
              }`}
            >
              {c.valor}
            </dd>
          </div>
        ))}
      </dl>

      <section className="mt-6 rounded-2xl border border-border bg-surface-card p-5 shadow-[var(--shadow-soft)]">
        <h2 className="text-sm font-semibold text-foreground">Funil em detalhe</h2>
        <p className="mt-0.5 text-xs text-subtle">
          Clique numa etapa para ver os contatos ·{" "}
          <Flame className="inline h-3 w-3 text-brand" aria-hidden /> = precisam de contato (
          {funil.diasParaEsfriar}+ dias sem interação)
        </p>
        <ol className="mt-4 flex flex-col gap-2.5">
          {relatorio.porEtapa.map((e) => {
            const cor = funil.etapas.find((et) => et.chave === e.chave)?.cor ?? null;
            const pct = kpis.total > 0 ? Math.round((e.total / kpis.total) * 100) : 0;
            return (
              <li key={e.chave}>
                <Link
                  href={hrefVista(funil.id, "lista", e.chave)}
                  className="group grid grid-cols-[10rem_1fr_auto] items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                >
                  <span className="flex min-w-0 items-center gap-1.5 text-sm text-muted group-hover:text-foreground">
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: cor ?? "var(--color-border-strong)" }}
                    />
                    <span className="truncate">{e.nome}</span>
                  </span>
                  <span className="h-3 overflow-hidden rounded-full bg-surface-strong" aria-hidden>
                    <span
                      className="block h-full rounded-full bg-brand transition-[width]"
                      style={{ width: `${Math.max(e.total > 0 ? 4 : 0, (e.total / maximo) * 100)}%` }}
                    />
                  </span>
                  <span className="flex items-center gap-2 text-sm tabular-nums">
                    <strong className="text-foreground">{e.total}</strong>
                    <span className="text-xs text-subtle">{pct}%</span>
                    {e.aContatar > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-brand">
                        <Flame className="h-3 w-3" aria-hidden />
                        {e.aContatar}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
