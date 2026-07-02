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
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-6 py-16 font-sans dark:bg-black">
      <main className="w-full max-w-4xl">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Leads
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Clientes que ativaram o atendimento e interagiram com seus imóveis,
          ordenados pelo interesse.
        </p>

        <ul className="mt-8 flex flex-col gap-3">
          {leads.length === 0 && (
            <li className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              Nenhum lead ainda — leads aparecem quando clientes que ativaram o
              atendimento interagem com seus imóveis.
            </li>
          )}
          {leads.map((lead) => (
            <li key={lead.id}>
              <Link
                href={`/corretor/leads/${lead.id}`}
                className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700 dark:hover:bg-zinc-900 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-zinc-950 dark:text-zinc-50">
                      {lead.clienteNome ?? "Cliente"}
                    </p>
                    <ChipTermometro temperatura={lead.temperatura} />
                  </div>
                  <p className="mt-0.5 truncate text-sm text-zinc-600 dark:text-zinc-400">
                    {lead.imovelTitulo}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                    {lead.sinais.visitas} visita(s) · {lead.sinais.simulacoes}{" "}
                    simulação(ões) · última atividade{" "}
                    {tempoRelativo(lead.ultimoEventoEm)}
                  </p>
                </div>
                <span
                  aria-hidden
                  className="hidden text-zinc-400 dark:text-zinc-600 sm:block"
                >
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
