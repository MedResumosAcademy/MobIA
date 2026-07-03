// EDIÇÃO da newsletter — preview do e-mail + ações (gestor/admin).
// O HTML é gerado no servidor (gerarHtmlEdicao, puro) e renderizado em um
// <iframe srcDoc> SANDBOXED: isola totalmente os estilos/DOM do e-mail da UI.
// Envio pluggável: o botão só ativa se RESEND_API_KEY estiver configurada.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PenLine } from "lucide-react";
import type { StatusEdicaoNewsletter } from "@imobia/domain";
import { Badge, type VarianteBadge } from "@/components/ui/Badge";
import { obterPerfil, obterSessao } from "@/lib/auth/sessao";
import { gerarHtmlEdicao } from "@/lib/email/newsletter-html";
import { obterEdicao, obterImoveisDaEdicao } from "@/lib/dados/newsletter";
import { AcoesEdicao } from "./AcoesEdicao";

export const metadata: Metadata = { title: "Edição da newsletter — ImobIA" };
export const dynamic = "force-dynamic";

const BADGE_STATUS: Record<StatusEdicaoNewsletter, { rotulo: string; variante: VarianteBadge }> = {
  rascunho: { rotulo: "Rascunho", variante: "neutro" },
  pronta: { rotulo: "Pronta", variante: "destaque" },
  enviada: { rotulo: "Enviada", variante: "marca" },
};

export default async function PaginaEdicaoNewsletter({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessao = await obterSessao();
  if (!sessao) {
    redirect("/entrar");
  }
  const perfil = await obterPerfil(sessao.usuarioId);
  const papel = perfil?.papel ?? "cliente";
  if (papel !== "gestor" && papel !== "admin") {
    redirect("/corretor?aviso=area-restrita-gestor");
  }

  const { id } = await params;
  const edicao = await obterEdicao(id);
  if (!edicao) {
    notFound();
  }

  const imoveis = await obterImoveisDaEdicao(edicao.imovelIds);
  const html = gerarHtmlEdicao(edicao, imoveis);
  const badge = BADGE_STATUS[edicao.status];

  return (
    <div className="flex flex-1 flex-col items-center bg-background px-6 py-16 font-sans">
      <main className="w-full max-w-4xl">
        <Link
          href="/corretor/newsletter"
          className="text-sm text-muted transition-colors hover:text-brand-strong"
        >
          ← Voltar à newsletter
        </Link>

        <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-strong">
              Newsletter
            </p>
            <h1 className="mt-1 flex flex-wrap items-center gap-3 text-3xl font-semibold tracking-tight text-foreground">
              {edicao.titulo}
              <Badge variante={badge.variante}>{badge.rotulo}</Badge>
            </h1>
            <p className="mt-1 text-muted">
              Assunto: <span className="text-foreground">{edicao.assunto}</span>
            </p>
          </div>
          {edicao.status !== "enviada" && (
            <Link
              href={`/corretor/newsletter/${edicao.id}/editar`}
              className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-surface-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-brand/40 hover:bg-surface"
            >
              <PenLine size={15} aria-hidden strokeWidth={2} />
              Editar
            </Link>
          )}
        </header>

        <section className="mt-8" aria-label="Ações">
          <AcoesEdicao
            id={edicao.id}
            status={edicao.status}
            html={html}
            envioConfigurado={Boolean(process.env.RESEND_API_KEY)}
          />
        </section>

        {/* Preview isolado do e-mail */}
        <section className="mt-8" aria-label="Preview do e-mail">
          <h2 className="text-lg font-semibold text-foreground">Preview</h2>
          <p className="mt-1 text-sm text-muted">
            Exatamente como o inscrito vai receber ({edicao.qtdImoveis} imóvel(is)).
          </p>
          <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface-card shadow-[var(--shadow-soft)]">
            <iframe
              srcDoc={html}
              title={`Preview do e-mail — ${edicao.titulo}`}
              sandbox=""
              className="h-[720px] w-full border-0"
            />
          </div>
        </section>
      </main>
    </div>
  );
}
