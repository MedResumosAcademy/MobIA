import type { Metadata } from "next";
import Link from "next/link";
import { formatarReais } from "@mobia/core";
import { listarImoveisDaOrg } from "@/lib/dados/imoveis";
import { definirStatusImovelAction } from "./acoes";
import { ROTULO_STATUS, STATUS } from "./rotulos";

export const metadata: Metadata = { title: "Meus imóveis — MobIA" };
export const dynamic = "force-dynamic";

const MENSAGENS_OK: Record<string, string> = {
  criado: "Imóvel criado com sucesso.",
  atualizado: "Imóvel atualizado com sucesso.",
};

export default async function PaginaImoveis({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  const { ok } = await searchParams;
  const mensagem = ok ? MENSAGENS_OK[ok] : null;
  const imoveis = await listarImoveisDaOrg();

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-6 py-16 font-sans dark:bg-black">
      <main className="w-full max-w-4xl">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Meus imóveis
          </h1>
          <Link
            href="/corretor/imoveis/novo"
            className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Novo imóvel
          </Link>
        </div>

        {mensagem && (
          <p
            role="status"
            className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200"
          >
            {mensagem}
          </p>
        )}

        <ul className="mt-8 flex flex-col gap-3">
          {imoveis.length === 0 && (
            <li className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              Nenhum imóvel cadastrado ainda.
            </li>
          )}
          {imoveis.map((imovel) => (
            <li
              key={imovel.id}
              className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium text-zinc-950 dark:text-zinc-50">
                  {imovel.titulo}
                </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {formatarReais(imovel.valor)} · {ROTULO_STATUS[imovel.status]}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <form action={definirStatusImovelAction} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={imovel.id} />
                  <select
                    name="status"
                    defaultValue={imovel.status}
                    className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  >
                    {STATUS.map((s) => (
                      <option key={s.valor} value={s.valor}>
                        {s.rotulo}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Aplicar
                  </button>
                </form>
                <Link
                  href={`/corretor/imoveis/${imovel.id}/editar`}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Editar
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
