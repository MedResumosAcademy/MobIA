// GESTÃO DE FUNIS DE RELACIONAMENTO (gestor/admin). Server Component: lista
// os funis da org (ativos e arquivados) e abre o editor via URL (?novo=1 |
// ?editar=<id>). Corretor é redirecionado ao CRM com aviso (padrão equipe).

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GitBranch, Plus } from "lucide-react";
import { classesBotao } from "@/components/ui/Botao";
import { contarContatosPorFunil, listarFunis } from "@/lib/dados/funis";
import { obterPapelEOrg } from "@/lib/dados/gestor";
import { plural } from "@/lib/plural";
import { ArquivarFunil } from "./ArquivarFunil";
import { FormFunil } from "./FormFunil";

export const metadata: Metadata = { title: "CRM — Funis" };
export const dynamic = "force-dynamic";

export default async function PaginaFunis({
  searchParams,
}: {
  searchParams: Promise<{ novo?: string; editar?: string }>;
}) {
  const contexto = await obterPapelEOrg();
  if (contexto === null) {
    redirect("/entrar");
  }
  if (contexto.papel !== "gestor" && contexto.papel !== "admin") {
    redirect("/corretor/crm?aviso=area-restrita-gestor");
  }

  const { novo, editar } = await searchParams;
  const [funis, contagens] = await Promise.all([
    listarFunis({ incluirArquivados: true }),
    contarContatosPorFunil(),
  ]);
  const emEdicao = editar ? (funis.find((f) => f.id === editar) ?? null) : null;
  const criando = novo === "1";

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Funis de relacionamento
          </h1>
          <p className="mt-1 text-muted">
            Cada funil é uma jornada com etapas próprias — os contatos andam por elas
            no kanban. O funil de <strong>negócios</strong> (venda do imóvel) segue à
            parte, alimentando receita e metas.
          </p>
        </div>
        {!criando && emEdicao === null && (
          <Link href="/corretor/crm/funis?novo=1" className={classesBotao("primario", "md")}>
            <Plus className="h-4 w-4" aria-hidden />
            Novo funil
          </Link>
        )}
      </header>

      {(criando || emEdicao !== null) && (
        <section className="mt-6 rounded-2xl border border-brand/30 bg-surface-card p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground">
              {emEdicao ? `Editar — ${emEdicao.nome}` : "Novo funil"}
            </h2>
            <Link
              href="/corretor/crm/funis"
              className="text-sm text-muted underline-offset-2 hover:text-foreground hover:underline"
            >
              Cancelar
            </Link>
          </div>
          <FormFunil
            inicial={
              emEdicao
                ? {
                    id: emEdicao.id,
                    nome: emEdicao.nome,
                    emoji: emEdicao.emoji ?? "",
                    descricao: emEdicao.descricao ?? "",
                    diasParaEsfriar: emEdicao.diasParaEsfriar,
                    etapas: emEdicao.etapas.map((e) => ({
                      chave: e.chave,
                      nome: e.nome,
                      cor: e.cor ?? "",
                    })),
                  }
                : {
                    nome: "",
                    emoji: "",
                    descricao: "",
                    diasParaEsfriar: 7,
                    etapas: [
                      { chave: "novo_contato", nome: "Novo contato", cor: "#DB6414" },
                      { chave: "em_conversa", nome: "Em conversa", cor: "#F2A93B" },
                      { chave: "concluido", nome: "Concluído", cor: "#9C4310" },
                    ],
                  }
            }
          />
        </section>
      )}

      <ul className="mt-6 flex flex-col gap-3">
        {funis.map((f) => (
          <li
            key={f.id}
            className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 shadow-[var(--shadow-soft)] ${
              f.arquivado ? "border-border bg-surface opacity-70" : "border-border bg-surface-card"
            }`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                aria-hidden
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-lg"
              >
                {f.emoji ?? <GitBranch className="h-5 w-5 text-brand-strong" aria-hidden />}
              </span>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
                  <span className="truncate">{f.nome}</span>
                  {f.padrao && (
                    <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand-strong">
                      padrão
                    </span>
                  )}
                  {f.arquivado && (
                    <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-subtle ring-1 ring-inset ring-border-strong/60">
                      arquivado
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-sm text-muted">
                  {f.etapas.length} etapas · {contagens[f.id] ?? 0}{" "}
                  {plural(contagens[f.id] ?? 0, "contato", "contatos")} · 🔥 após{" "}
                  {f.diasParaEsfriar} {plural(f.diasParaEsfriar, "dia", "dias")}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {!f.arquivado && (
                <Link
                  href={`/corretor/crm?funil=${f.id}&vista=kanban`}
                  className="rounded-full border border-border-strong bg-surface-card px-3 py-1 text-xs font-medium text-muted transition-colors hover:text-foreground"
                >
                  Ver kanban
                </Link>
              )}
              <Link
                href={`/corretor/crm/funis?editar=${f.id}`}
                className="rounded-full border border-border-strong bg-surface-card px-3 py-1 text-xs font-medium text-muted transition-colors hover:text-foreground"
              >
                Editar
              </Link>
              {!f.padrao && <ArquivarFunil funilId={f.id} arquivado={f.arquivado} />}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
