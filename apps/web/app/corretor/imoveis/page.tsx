import type { Metadata } from "next";
import Link from "next/link";
import { formatarReais } from "@imobia/core";
import { listarImoveisDaOrg } from "@/lib/dados/imoveis";
import { Botao, classesBotao } from "@/components/ui/Botao";
import { CampoSelect } from "@/components/ui/Campo";
import { definirStatusImovelAction } from "./acoes";
import { ROTULO_STATUS, STATUS } from "./rotulos";

export const metadata: Metadata = { title: "Meus imóveis — ImobIA" };
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
    <div className="flex flex-1 flex-col items-center bg-background px-6 py-16 font-sans">
      <main className="w-full max-w-4xl">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Meus imóveis
          </h1>
          <Link href="/corretor/imoveis/novo" className={classesBotao("primario", "md")}>
            Novo imóvel
          </Link>
        </div>

        {mensagem && (
          <p
            role="status"
            className="mt-4 rounded-xl border border-gold/40 bg-gold-soft px-3.5 py-2.5 text-sm text-gold-strong"
          >
            {mensagem}
          </p>
        )}

        <ul className="mt-8 flex flex-col gap-3">
          {imoveis.length === 0 && (
            <li className="rounded-2xl border border-dashed border-border-strong bg-surface-card p-8 text-center text-subtle">
              Nenhum imóvel cadastrado ainda.
            </li>
          )}
          {imoveis.map((imovel) => (
            <li
              key={imovel.id}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-card p-4 shadow-[var(--shadow-soft)] transition-colors hover:border-brand/30 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold text-foreground">
                  {imovel.titulo}
                </p>
                <p className="mt-0.5 text-sm text-muted">
                  <span className="font-semibold tabular-nums text-foreground">
                    {formatarReais(imovel.valor)}
                  </span>{" "}
                  · {ROTULO_STATUS[imovel.status]}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <form action={definirStatusImovelAction} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={imovel.id} />
                  <CampoSelect
                    name="status"
                    defaultValue={imovel.status}
                    className="w-auto py-2"
                  >
                    {STATUS.map((s) => (
                      <option key={s.valor} value={s.valor}>
                        {s.rotulo}
                      </option>
                    ))}
                  </CampoSelect>
                  <Botao type="submit" variante="secundario" tamanho="sm">
                    Aplicar
                  </Botao>
                </form>
                <Link
                  href={`/corretor/imoveis/${imovel.id}/editar`}
                  className={classesBotao("secundario", "sm")}
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
