import type { Metadata } from "next";
import Link from "next/link";
import { obterPerfil, obterSessao } from "@/lib/auth/sessao";
import { classesBotao } from "@/components/ui/Botao";

export const metadata: Metadata = { title: "Painel do corretor — ImobIA" };

export default async function PainelCorretor() {
  const sessao = await obterSessao();
  const perfil = sessao ? await obterPerfil(sessao.usuarioId) : null;

  return (
    <div className="flex flex-1 flex-col items-center bg-background px-6 py-16 font-sans">
      <main className="w-full max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Painel do corretor
        </h1>
        <p className="mt-2 text-muted">
          Olá, {perfil?.nome ?? sessao?.email ?? "corretor"}.
        </p>

        <nav className="mt-6 flex flex-wrap gap-3">
          <Link href="/corretor/imoveis" className={classesBotao("secundario", "md")}>
            Meus imóveis
          </Link>
          <Link href="/corretor/leads" className={classesBotao("secundario", "md")}>
            Leads
          </Link>
        </nav>

        <section className="mt-8 rounded-2xl border border-border bg-surface-card p-8 shadow-[var(--shadow-soft)]">
          <dl className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-sm text-subtle">Papel</dt>
              <dd className="text-base font-medium text-foreground">
                {perfil?.papel ?? "corretor"}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-sm text-subtle">Organização</dt>
              <dd className="text-base font-medium text-foreground">
                {perfil?.orgId ?? "org não configurada"}
              </dd>
            </div>
          </dl>
          <p className="mt-6 border-t border-border pt-4 text-sm text-muted">
            Acompanhe seus imóveis e os leads dos clientes pelos atalhos acima.
          </p>
        </section>
      </main>
    </div>
  );
}
