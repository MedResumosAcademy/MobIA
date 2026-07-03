// Detalhe de um LEAD (ESCOPO §5.2–5.3): termômetro, TIMELINE cronológica do
// comportamento do cliente e a capacidade do Sonhômetro (se a RLS a expõe).
// A visibilidade é governada pela RLS + consentimento (Decisão 6).

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Phone, MessageCircle } from "lucide-react";
import { formatarReais } from "@imobia/core";
import { obterLead } from "@/lib/dados/leads";
import { listarCorretoresDaOrg, obterPapelEOrg } from "@/lib/dados/gestor";
import { Botao } from "@/components/ui/Botao";
import { converterLeadEmNegocioAction } from "../../negocios/acoes";
import { ChipTermometro } from "../termometro";
import { tempoRelativo } from "../tempo";
import { ReatribuirLead } from "./reatribuir";

export const metadata: Metadata = { title: "Lead" };
export const dynamic = "force-dynamic";

// Id fora do formato UUID nunca existe no banco — 404 direto, sem estourar
// o cast de uuid do Postgres (que viraria 500).
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaLead({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    notFound();
  }
  const detalhe = await obterLead(id);
  if (!detalhe) {
    notFound();
  }
  const { lead, timeline, capacidadeCliente, clienteTelefone } = detalhe;

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

        {clienteTelefone && <ContatoCliente telefone={clienteTelefone} />}

        <form action={converterLeadEmNegocioAction} className="mt-4">
          <input type="hidden" name="leadId" value={lead.id} />
          <Botao type="submit" variante="primario" tamanho="sm">
            Converter em negócio
          </Botao>
        </form>

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

// Formata dígitos BR ("5511988887777" / "11988887777") para exibição.
// Aceita 10–11 dígitos nacionais, com ou sem o 55 na frente.
function formatarTelefone(digitos: string): string {
  const nacional = digitos.startsWith("55") && digitos.length > 11
    ? digitos.slice(2)
    : digitos;
  if (nacional.length === 11) {
    return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 7)}-${nacional.slice(7)}`;
  }
  if (nacional.length === 10) {
    return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 6)}-${nacional.slice(6)}`;
  }
  return digitos;
}

// Telefone do cliente + ações Ligar (tel:) e WhatsApp (wa.me). Só aparece quando
// o cliente consentiu e cadastrou um número (a RLS/dados já gateiam a exibição).
// wa.me exige DDI: prefixa 55 se o número não vier com código de país.
function ContatoCliente({ telefone }: { telefone: string }) {
  const so = telefone.replace(/\D/g, "");
  const comDdi = so.length <= 11 ? `55${so}` : so;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <span className="text-sm font-medium tabular-nums text-foreground">
        {formatarTelefone(so)}
      </span>
      <div className="flex items-center gap-2">
        <a
          href={`tel:+${comDdi}`}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border-strong bg-surface-card px-3.5 py-1.5 text-sm font-semibold text-foreground shadow-[var(--shadow-soft)] transition-colors hover:border-brand/40 hover:bg-surface"
        >
          <Phone aria-hidden className="h-4 w-4" />
          Ligar
        </a>
        <a
          href={`https://wa.me/${comDdi}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-1.5 text-sm font-semibold text-brand-contrast shadow-[var(--shadow-soft)] transition-colors hover:bg-brand-hover"
        >
          <MessageCircle aria-hidden className="h-4 w-4" />
          WhatsApp
        </a>
      </div>
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
