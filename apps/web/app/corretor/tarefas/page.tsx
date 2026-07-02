// MINHAS TAREFAS (to-dos do CRM). Server Component: lista as tarefas PENDENTES do
// corretor logado, agrupadas em ATRASADAS (prazo vencido) e A FAZER (futuras/sem
// prazo). Gestor/admin ganham uma aba "Equipe" (?escopo=equipe) com as tarefas
// pendentes de toda a org (tarefasDaOrg). Anônimo → login. Escopo real vem da RLS
// (0012); aqui só apresentamos. pt-BR.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { obterPerfil, obterSessao } from "@/lib/auth/sessao";
import { minhasTarefas, tarefasDaOrg } from "@/lib/dados/tarefas";
import { ItemTarefa } from "./ItemTarefa";

export const metadata: Metadata = { title: "Tarefas — ImobIA" };
export const dynamic = "force-dynamic";

export default async function PaginaTarefas({
  searchParams,
}: {
  searchParams: Promise<{ escopo?: string }>;
}) {
  const sessao = await obterSessao();
  if (!sessao) {
    redirect("/entrar");
  }
  const perfil = await obterPerfil(sessao.usuarioId);
  const papel = perfil?.papel ?? "cliente";
  const podeVerEquipe = papel === "gestor" || papel === "admin";

  const { escopo } = await searchParams;
  const equipe = podeVerEquipe && escopo === "equipe";

  const tarefas = equipe ? await tarefasDaOrg() : await minhasTarefas();
  const atrasadas = tarefas.filter((t) => t.atrasada);
  const aFazer = tarefas.filter((t) => !t.atrasada);

  return (
    <div className="flex flex-1 flex-col items-center bg-background px-6 py-16 font-sans">
      <main className="w-full max-w-2xl">
        <Link
          href="/corretor"
          className="text-sm text-muted transition-colors hover:text-brand-strong"
        >
          ← Voltar ao painel
        </Link>

        <header className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-strong">
            Próximos passos
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
            {equipe ? "Tarefas da equipe" : "Minhas tarefas"}
          </h1>
        </header>

        {podeVerEquipe && (
          <nav className="mt-5 flex gap-2" aria-label="Escopo das tarefas">
            <Aba href="/corretor/tarefas" ativo={!equipe}>
              Minhas
            </Aba>
            <Aba href="/corretor/tarefas?escopo=equipe" ativo={equipe}>
              Equipe
            </Aba>
          </nav>
        )}

        {tarefas.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-dashed border-border-strong bg-surface-card p-8 text-center text-subtle">
            {equipe
              ? "Nenhuma tarefa pendente na equipe. Tudo em dia! 🎉"
              : "Você não tem tarefas pendentes. Tudo em dia! 🎉"}
          </p>
        ) : (
          <div className="mt-8 flex flex-col gap-8">
            {atrasadas.length > 0 && (
              <Grupo titulo="Atrasadas" contagem={atrasadas.length}>
                {atrasadas.map((t) => (
                  <ItemTarefa key={t.id} tarefa={t} mostrarCorretor={equipe} />
                ))}
              </Grupo>
            )}
            {aFazer.length > 0 && (
              <Grupo titulo="A fazer" contagem={aFazer.length}>
                {aFazer.map((t) => (
                  <ItemTarefa key={t.id} tarefa={t} mostrarCorretor={equipe} />
                ))}
              </Grupo>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function Aba({
  href,
  ativo,
  children,
}: {
  href: string;
  ativo: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
        ativo
          ? "bg-brand text-brand-contrast shadow-[var(--shadow-soft)]"
          : "border border-border-strong bg-surface-card text-muted hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}

function Grupo({
  titulo,
  contagem,
  children,
}: {
  titulo: string;
  contagem: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-subtle">
        {titulo} <span className="tabular-nums text-muted">({contagem})</span>
      </h2>
      <ul className="mt-3 flex flex-col gap-2">{children}</ul>
    </section>
  );
}
