// CENTRAL DA NEWSLETTER (ESCOPO §V2, item 16) — só gestor/admin (mesmo gate do
// dashboard de equipe). Lista as edições da org (RLS) com badge de status,
// botão "Nova edição" e a seção de inscritos (colapsável). LGPD (0022): os
// e-mails crus só aparecem para o admin da plataforma; gestor vê o total.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronDown, Mail, PenLine, Plus, Users } from "lucide-react";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Badge, type VarianteBadge } from "@/components/ui/Badge";
import { classesBotao } from "@/components/ui/Botao";
import type { StatusEdicaoNewsletter } from "@imobia/domain";
import { obterPerfil, obterSessao } from "@/lib/auth/sessao";
import {
  listarEdicoes,
  listarInscritos,
  type EdicaoNewsletterResumo,
} from "@/lib/dados/newsletter";

export const metadata: Metadata = { title: "Newsletter" };
export const dynamic = "force-dynamic";

export default async function PaginaNewsletter() {
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

  const [edicoes, { total, inscritos }] = await Promise.all([
    listarEdicoes(),
    listarInscritos(),
  ]);

  return (
    <div className="flex flex-1 flex-col items-center bg-background px-6 py-16 font-sans">
      <main className="w-full max-w-4xl">
        <Link
          href="/corretor/equipe"
          className="text-sm text-muted transition-colors hover:text-brand-strong"
        >
          ← Voltar ao dashboard
        </Link>

        <header className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-strong">
              Relacionamento
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
              Newsletter
            </h1>
            <p className="mt-1 text-muted">
              Edições com os imóveis da sua carteira, para {total} inscrito(s) ativo(s).
            </p>
          </div>
          <Link href="/corretor/newsletter/nova" className={classesBotao("primario", "md")}>
            <Plus size={16} aria-hidden strokeWidth={2} />
            Nova edição
          </Link>
        </header>

        {/* Edições */}
        <section className="mt-8" aria-label="Edições">
          {edicoes.length === 0 ? (
            <EstadoVazio
              icone={<Mail className="h-6 w-6" aria-hidden />}
              titulo="Nenhuma edição ainda"
              descricao="Monte a primeira edição com os imóveis da sua carteira e mantenha os inscritos aquecidos."
              cta={{ href: "/corretor/newsletter/nova", rotulo: "Criar primeira edição" }}
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {edicoes.map((edicao) => (
                <ItemEdicao key={edicao.id} edicao={edicao} />
              ))}
            </ul>
          )}
        </section>

        {/* Inscritos (colapsável) */}
        <section className="mt-10" aria-label="Inscritos">
          <details className="group rounded-2xl border border-border bg-surface-card shadow-[var(--shadow-soft)]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2.5 text-base font-semibold text-foreground">
                <Users className="h-5 w-5 text-brand" aria-hidden />
                Inscritos ativos
                <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold tabular-nums text-brand-strong">
                  {total}
                </span>
              </span>
              <ChevronDown
                className="h-4 w-4 text-subtle transition-transform group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <div className="border-t border-border px-5 pb-5">
              {inscritos.length === 0 ? (
                <p className="py-6 text-center text-sm text-subtle">
                  {total > 0
                    ? "Por LGPD, os e-mails dos inscritos ficam restritos ao admin da plataforma ImobIA — aqui você acompanha o total agregado."
                    : "Ninguém se inscreveu ainda — o formulário está no site e no rodapé."}
                </p>
              ) : (
                <div className="mt-1 overflow-x-auto">
                  <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-[0.08em] text-subtle">
                      <th className="py-2.5 pr-4 font-medium">E-mail</th>
                      <th className="py-2.5 pr-4 font-medium">Nome</th>
                      <th className="py-2.5 text-right font-medium">Inscrito em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inscritos.map((inscrito) => (
                      <tr
                        key={inscrito.email}
                        className="border-b border-border last:border-0"
                      >
                        <td className="py-2.5 pr-4 text-foreground">{inscrito.email}</td>
                        <td className="py-2.5 pr-4 text-muted">{inscrito.nome ?? "—"}</td>
                        <td className="py-2.5 text-right tabular-nums text-subtle">
                          {formatarData(inscrito.consentiuEm)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  </table>
                </div>
              )}
              <p className="mt-4 text-xs text-subtle">
                Todos os inscritos deram consentimento explícito (LGPD) no momento
                do cadastro.
              </p>
            </div>
          </details>
        </section>
      </main>
    </div>
  );
}

// —— Item da lista de edições ————————————————————————————————————————————————
const BADGE_STATUS: Record<StatusEdicaoNewsletter, { rotulo: string; variante: VarianteBadge }> = {
  rascunho: { rotulo: "Rascunho", variante: "neutro" },
  pronta: { rotulo: "Pronta", variante: "destaque" },
  enviada: { rotulo: "Enviada", variante: "marca" },
  simulada: { rotulo: "Envio simulado", variante: "lancamento" },
};

function ItemEdicao({ edicao }: { edicao: EdicaoNewsletterResumo }) {
  const badge = BADGE_STATUS[edicao.status];
  return (
    <li>
      <Link
        href={`/corretor/newsletter/${edicao.id}`}
        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface-card p-5 shadow-[var(--shadow-soft)] transition-colors hover:border-brand/40 hover:bg-surface"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
            {edicao.status === "rascunho" ? (
              <PenLine className="h-5 w-5" aria-hidden />
            ) : (
              <Mail className="h-5 w-5" aria-hidden />
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold text-foreground">
              {edicao.titulo}
            </span>
            <span className="block text-xs text-subtle">
              {edicao.qtdImoveis} imóvel(is) ·{" "}
              {edicao.status === "enviada" && edicao.enviadaEm
                ? `enviada em ${formatarData(edicao.enviadaEm)}`
                : `criada em ${formatarData(edicao.criadoEm)}`}
            </span>
          </span>
        </span>
        <Badge variante={badge.variante}>{badge.rotulo}</Badge>
      </Link>
    </li>
  );
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
