// AGENDA DE CONTATOS (aba raiz do hub CRM 2.0). Server Component: lista os
// contatos da org via listarContatos (RLS escopa), com busca/tag/"só meus"
// lidos da URL. O filtro de TAG é aplicado aqui sobre o resultado (mesma
// semântica do .contains) para as opções do select refletirem TODAS as tags
// visíveis — uma query só. LGPD: o selo de consentimento vem do carimbo
// consentimento_marketing_em (opt-in explícito registrado na ficha).

import type { Metadata } from "next";
import Link from "next/link";
import { MessagesSquare, Plus, ShieldCheck, Users } from "lucide-react";
import { EstadoVazio } from "@/components/EstadoVazio";
import { classesBotao } from "@/components/ui/Botao";
import { listarContatos } from "@/lib/dados/contatos";
import { contarContatosPorFunil, dadosDoFunil, listarFunis } from "@/lib/dados/funis";
import { obterPapelEOrg } from "@/lib/dados/gestor";
import { plural } from "@/lib/plural";
import { tempoRelativo } from "../leads/tempo";
import { FiltrosContatos } from "./FiltrosContatos";
import {
  BarraDoFunil,
  ChipsFunis,
  VistaKanban,
  VistaListaFunil,
  VistaRelatorio,
} from "./VistasFunil";

export const metadata: Metadata = { title: "CRM — Contatos" };
export const dynamic = "force-dynamic";

export default async function PaginaContatos({
  searchParams,
}: {
  searchParams: Promise<{
    busca?: string;
    tag?: string;
    meus?: string;
    funil?: string;
    vista?: string;
    etapa?: string;
  }>;
}) {
  const { busca, tag, meus, funil, vista, etapa } = await searchParams;

  const [funis, contagens, contexto] = await Promise.all([
    listarFunis(),
    contarContatosPorFunil(),
    obterPapelEOrg(),
  ]);
  const ehGestor = contexto?.papel === "gestor" || contexto?.papel === "admin";

  // ——— VISTA POR FUNIL (kanban | relatório | lista do funil) ———
  const funilEscolhido = funis.find((f) => f.id === funil) ?? null;
  if (funilEscolhido !== null) {
    const dados = await dadosDoFunil(funilEscolhido.id);
    const vistaAtiva =
      vista === "lista" || vista === "relatorio" ? vista : ("kanban" as const);
    return (
      <>
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              {funilEscolhido.emoji ? `${funilEscolhido.emoji} ` : ""}
              {funilEscolhido.nome}
            </h1>
            <p className="mt-1 text-muted">
              {funilEscolhido.descricao ??
                "Funil de relacionamento — cada contato no próximo passo certo."}
            </p>
          </div>
          <Link href="/corretor/crm/contatos/novo" className={classesBotao("primario", "md")}>
            <Plus className="h-4 w-4" aria-hidden />
            Novo contato
          </Link>
        </header>

        <ChipsFunis
          funis={funis}
          contagens={contagens}
          funilAtivo={funilEscolhido.id}
          ehGestor={ehGestor}
        />

        {dados === null ? (
          <p className="mt-6 rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-subtle">
            Não foi possível carregar o funil agora — recarregue a página.
          </p>
        ) : (
          <>
            <BarraDoFunil funil={dados.funil} relatorio={dados.relatorio} vista={vistaAtiva} />
            {vistaAtiva === "kanban" && (
              <VistaKanban funil={dados.funil} contatos={dados.contatos} />
            )}
            {vistaAtiva === "relatorio" && (
              <VistaRelatorio funil={dados.funil} relatorio={dados.relatorio} />
            )}
            {vistaAtiva === "lista" && (
              <VistaListaFunil
                funil={dados.funil}
                contatos={dados.contatos}
                etapaFiltro={etapa}
              />
            )}
          </>
        )}
      </>
    );
  }

  // ——— AGENDA COMPLETA ("Todos") ———
  const todos = await listarContatos({ busca, apenasMeus: meus === "1" });

  // Opções do select de tag = todas as tags dos contatos visíveis (ordenadas).
  const tags = [...new Set(todos.flatMap((c) => c.tags))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
  const tagLimpa = tag?.trim() ?? "";
  const contatos =
    tagLimpa === "" ? todos : todos.filter((c) => c.tags.includes(tagLimpa));

  const temFiltro = Boolean(busca?.trim()) || tagLimpa !== "" || meus === "1";

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Contatos
          </h1>
          <p className="mt-1 text-muted">
            A agenda da sua organização — {contatos.length}{" "}
            {plural(contatos.length, "contato", "contatos")}
            {temFiltro ? " com os filtros atuais" : ""}.
          </p>
        </div>
        <Link href="/corretor/crm/contatos/novo" className={classesBotao("primario", "md")}>
          <Plus className="h-4 w-4" aria-hidden />
          Novo contato
        </Link>
      </header>

      <ChipsFunis funis={funis} contagens={contagens} funilAtivo={null} ehGestor={ehGestor} />

      <FiltrosContatos tags={tags} />

      {contatos.length === 0 ? (
        <div className="mt-6">
          {temFiltro ? (
            <EstadoVazio
              icone={<Users className="h-6 w-6" aria-hidden />}
              titulo="Nenhum contato encontrado"
              descricao="Nenhum contato casa com os filtros atuais. Ajuste a busca ou limpe os filtros para ver a agenda inteira."
              cta={{ href: "/corretor/crm", rotulo: "Limpar filtros" }}
            />
          ) : (
            <EstadoVazio
              icone={<Users className="h-6 w-6" aria-hidden />}
              titulo="Sua agenda começa aqui"
              descricao="Cadastre o primeiro contato para acompanhar conversas, negócios e campanhas em um só lugar."
              cta={{ href: "/corretor/crm/contatos/novo", rotulo: "Criar o primeiro contato" }}
            />
          )}
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {contatos.map((c) => (
            <li key={c.id}>
              <Link
                href={`/corretor/crm/contatos/${c.id}`}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-card p-4 shadow-[var(--shadow-soft)] transition-[border-color,box-shadow] hover:border-brand/30 hover:shadow-[var(--shadow-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand-strong"
                  >
                    {c.nome.trim().charAt(0).toUpperCase() || "?"}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold text-foreground">{c.nome}</p>
                      {c.consentimentoMarketingEm !== null ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand-strong">
                          <ShieldCheck className="h-3 w-3" aria-hidden />
                          Marketing
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-subtle">
                          — sem opt-in
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted">
                      {[c.telefoneFormatado, c.email].filter(Boolean).join(" · ") ||
                        "Sem telefone nem e-mail"}
                    </p>
                    {c.tags.length > 0 && (
                      <p className="mt-1.5 flex flex-wrap gap-1.5">
                        {c.tags.slice(0, 4).map((t) => (
                          <span
                            key={t}
                            className="inline-flex items-center rounded-full bg-badge-neutro-bg px-2 py-0.5 text-[11px] font-medium text-badge-neutro-fg ring-1 ring-inset ring-border-strong/60"
                          >
                            {t}
                          </span>
                        ))}
                        {c.tags.length > 4 && (
                          <span className="text-[11px] font-medium text-subtle">
                            +{c.tags.length - 4}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-1 text-sm sm:items-end">
                  <span className="font-medium tabular-nums text-foreground">
                    {c.negociosAbertos}{" "}
                    {plural(c.negociosAbertos, "negócio aberto", "negócios abertos")}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-subtle">
                    <MessagesSquare className="h-3.5 w-3.5" aria-hidden />
                    {c.ultimaMensagem
                      ? `última mensagem ${tempoRelativo(c.ultimaMensagem.criadoEm)}`
                      : "sem conversas ainda"}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
