// Painel de LEADS do corretor/gestor (ESCOPO §5.1–5.3). Lista os leads da org,
// ordenados por score (mais quentes primeiro), cada um com termômetro visual,
// contadores-chave e última atividade. A RLS (Decisão 6) já garante que só
// aparecem clientes que consentiram — aqui só apresentamos.

import type { Metadata } from "next";
import Link from "next/link";
import { listarLeads } from "@/lib/dados/leads";
import { ChipTermometro } from "./termometro";
import { tempoRelativo } from "./tempo";

export const metadata: Metadata = { title: "Leads — MobIA" };
export const dynamic = "force-dynamic";

export default async function PaginaLeads() {
  const leads = await listarLeads();

  return (
    <div className="flex flex-1 flex-col items-center bg-background px-6 py-16 font-sans">
      <main className="w-full max-w-4xl">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Leads
        </h1>
        <p className="mt-2 text-muted">
          Clientes que ativaram o atendimento e interagiram com seus imóveis,
          ordenados pelo interesse.
        </p>

        <ul className="mt-8 flex flex-col gap-3">
          {leads.length === 0 && (
            <li className="rounded-2xl border border-dashed border-border-strong bg-surface-card p-8 text-center text-subtle">
              Nenhum lead ainda — leads aparecem quando clientes que ativaram o
              atendimento interagem com seus imóveis.
            </li>
          )}
          {leads.map((lead) => (
            <li key={lead.id}>
              <Link
                href={`/corretor/leads/${lead.id}`}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-card p-4 shadow-[var(--shadow-soft)] transition-[border-color,box-shadow] hover:border-brand/30 hover:shadow-[var(--shadow-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-foreground">
                      {lead.clienteNome ?? "Cliente"}
                    </p>
                    <ChipTermometro temperatura={lead.temperatura} />
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted">
                    {lead.imovelTitulo}
                  </p>
                  <p className="mt-1 text-xs text-subtle">
                    {lead.sinais.visitas} visita(s) · {lead.sinais.simulacoes}{" "}
                    simulação(ões) · última atividade{" "}
                    {tempoRelativo(lead.ultimoEventoEm)}
                  </p>
                </div>
                <span aria-hidden className="hidden text-brand sm:block">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
