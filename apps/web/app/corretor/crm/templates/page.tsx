// TEMPLATES DE WHATSAPP (gestor/admin) — espelho local dos templates da Meta:
// lista (nome, categoria, status com badge), criar/editar via URL (?novo=1 |
// ?editar=<id>, padrão da tela de funis) e o registro do ciclo de aprovação.
// HONESTIDADE: a aprovação acontece NO PAINEL DA META — aqui o gestor apenas
// registra o veredito; o envio real (conversas e campanhas) exige 'aprovado'.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Info, LayoutTemplate, Plus } from "lucide-react";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Badge } from "@/components/ui/Badge";
import { classesBotao } from "@/components/ui/Botao";
import { obterPapelEOrg } from "@/lib/dados/gestor";
import { listarTemplates } from "@/lib/dados/templates";
import type { CategoriaTemplate, StatusMetaTemplate } from "@imobia/domain";
import {
  BADGE_STATUS_TEMPLATE,
  ROTULO_CATEGORIA_TEMPLATE,
  ROTULO_STATUS_TEMPLATE,
} from "../rotulos";
import { AcoesTemplate } from "./AcoesTemplate";
import { FormTemplate } from "./FormTemplate";

export const metadata: Metadata = { title: "CRM — Templates" };
export const dynamic = "force-dynamic";

function ehStatus(s: string): s is StatusMetaTemplate {
  return s in ROTULO_STATUS_TEMPLATE;
}

function ehCategoria(c: string): c is CategoriaTemplate {
  return c in ROTULO_CATEGORIA_TEMPLATE;
}

export default async function PaginaTemplates({
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
  const templates = await listarTemplates();
  const emEdicao = editar ? (templates.find((t) => t.id === editar) ?? null) : null;
  const criando = novo === "1";

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Templates de WhatsApp
          </h1>
          <p className="mt-1 text-muted">
            Fora da janela de 24h (e nas campanhas), só sai template aprovado —
            este é o espelho local do que está registrado na Meta.
          </p>
        </div>
        {!criando && emEdicao === null && (
          <Link
            href="/corretor/crm/templates?novo=1"
            className={classesBotao("primario", "md")}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Novo template
          </Link>
        )}
      </header>

      <p className="mt-6 flex items-start gap-2 rounded-2xl border border-gold/40 bg-gold-soft px-5 py-4 text-sm text-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-gold-strong" aria-hidden />
        A aprovação do template acontece no painel da Meta (Business Manager) —
        registre aqui como <strong>Aprovado</strong> quando aprovar lá. Sem esse
        registro, o envio real fica bloqueado por segurança.
      </p>

      {(criando || emEdicao !== null) && (
        <section className="mt-6 rounded-2xl border border-brand/30 bg-surface-card p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground">
              {emEdicao ? `Editar — ${emEdicao.nome}` : "Novo template"}
            </h2>
            <Link
              href="/corretor/crm/templates"
              className="text-sm text-muted underline-offset-2 hover:text-foreground hover:underline"
            >
              Cancelar
            </Link>
          </div>
          <FormTemplate
            inicial={
              emEdicao
                ? {
                    id: emEdicao.id,
                    nome: emEdicao.nome,
                    idioma: emEdicao.idioma,
                    corpo: emEdicao.corpo,
                    categoria: ehCategoria(emEdicao.categoria)
                      ? emEdicao.categoria
                      : "utility",
                  }
                : { nome: "", idioma: "pt_BR", corpo: "", categoria: "utility" }
            }
          />
        </section>
      )}

      {templates.length === 0 && !criando ? (
        <EstadoVazio
          className="mt-6"
          icone={<LayoutTemplate className="h-6 w-6" aria-hidden />}
          titulo="Nenhum template ainda"
          descricao="Cadastre aqui o espelho dos templates registrados na Meta — as campanhas e as conversas fora da janela de 24h dependem deles."
          cta={{ href: "/corretor/crm/templates?novo=1", rotulo: "Criar o primeiro" }}
        />
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {templates.map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface-card p-4 shadow-[var(--shadow-soft)]"
            >
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  <code className="rounded-md bg-surface px-1.5 py-0.5 text-sm font-semibold text-foreground ring-1 ring-inset ring-border-strong/60">
                    {t.nome}
                  </code>
                  <span className="text-xs text-subtle">{t.idioma}</span>
                  <Badge variante="neutro">
                    {ehCategoria(t.categoria)
                      ? ROTULO_CATEGORIA_TEMPLATE[t.categoria]
                      : t.categoria}
                  </Badge>
                  <Badge
                    variante={
                      ehStatus(t.statusMeta) ? BADGE_STATUS_TEMPLATE[t.statusMeta] : "neutro"
                    }
                  >
                    {ehStatus(t.statusMeta)
                      ? ROTULO_STATUS_TEMPLATE[t.statusMeta]
                      : t.statusMeta}
                  </Badge>
                </p>
                <p className="mt-1.5 line-clamp-2 text-sm text-muted">{t.corpo}</p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Link
                  href={`/corretor/crm/templates?editar=${t.id}`}
                  className="rounded-full border border-border-strong bg-surface-card px-3 py-1 text-xs font-medium text-muted transition-colors hover:text-foreground"
                >
                  Editar
                </Link>
                <AcoesTemplate templateId={t.id} status={t.statusMeta} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
