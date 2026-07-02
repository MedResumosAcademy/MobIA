// Detalhe de um LEAD (ESCOPO §5.2–5.3): termômetro, TIMELINE cronológica do
// comportamento do cliente e a capacidade do Sonhômetro (se a RLS a expõe).
// A visibilidade é governada pela RLS + consentimento (Decisão 6).

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatarReais } from "@imobia/core";
import { obterLead } from "@/lib/dados/leads";
import { listarCorretoresDaOrg, obterPapelEOrg } from "@/lib/dados/gestor";
import { ChipTermometro } from "../termometro";
import { tempoRelativo } from "../tempo";
import { ReatribuirLead } from "./reatribuir";

export const metadata: Metadata = { title: "Lead — ImobIA" };
export const dynamic = "force-dynamic";

export default async function PaginaLead({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detalhe = await obterLead(id);
  if (!detalhe) {
    notFound();
  }
  const { lead, timeline, capacidadeCliente } = detalhe;

  // Só gestor/admin veem o controle de reatribuição; corretor comum, não.
  const papelEOrg = await obterPapelEOrg();
  const podeReatribuir =
    papelEOrg?.papel === "gestor" || papelEOrg?.papel === "admin";
  const corretores = podeReatribuir ? await listarCorretoresDaOrg() : [];

  return (
    <div className="flex flex-1 flex-col items-center bg-background px-6 py-16 font-sans">
      <main className="w-full max-w-2xl">
        <Link
          href="/corretor/leads"
          className="text-sm text-muted transition-colors hover:text-brand-strong"
        >
          ← Voltar aos leads
        </Link>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {lead.clienteNome ?? "Cliente"}
          </h1>
          <ChipTermometro temperatura={lead.temperatura} />
        </div>
        <p className="mt-2 text-muted">{lead.imovelTitulo}</p>

        <section className="mt-8 rounded-2xl border border-border bg-surface-card p-6 shadow-[var(--shadow-soft)]">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Contador rotulo="Visitas" valor={lead.sinais.visitas} />
            <Contador rotulo="Simulações" valor={lead.sinais.simulacoes} />
            <Contador rotulo="Favoritos" valor={lead.sinais.favoritos} />
            <Contador
              rotulo="Cliques financiamento"
              valor={lead.sinais.cliquesFinanciamento}
            />
            <Contador rotulo="Retornos" valor={lead.sinais.retornos} />
          </dl>
          {capacidadeCliente !== null && (
            <div className="mt-6 border-t border-border pt-4">
              <dt className="text-sm text-subtle">
                Capacidade estimada (Sonhômetro)
              </dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                {formatarReais(capacidadeCliente)}
              </dd>
            </div>
          )}
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-foreground">
            Comportamento
          </h2>
          {timeline.length === 0 ? (
            <p className="mt-3 text-sm text-subtle">
              Nenhuma atividade registrada ainda.
            </p>
          ) : (
            <ol className="mt-4 flex flex-col gap-4 border-l border-border pl-5">
              {timeline.map((item) => (
                <li key={item.id} className="relative">
                  <span
                    aria-hidden
                    className="absolute -left-[27px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface-card bg-gold"
                  />
                  <p className="text-sm text-foreground">
                    {item.descricao}
                  </p>
                  <p className="text-xs text-subtle">
                    {tempoRelativo(item.criadoEm)}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>

        {podeReatribuir && (
          <ReatribuirLead
            leadId={lead.id}
            corretorAtualId={lead.corretorId}
            corretores={corretores}
          />
        )}
      </main>
    </div>
  );
}

function Contador({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div>
      <dt className="text-xs text-subtle">{rotulo}</dt>
      <dd className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">
        {valor}
      </dd>
    </div>
  );
}
