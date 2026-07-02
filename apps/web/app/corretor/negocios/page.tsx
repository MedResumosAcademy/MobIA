// BOARD do FUNIL de negócios (CRM) do corretor/gestor. Colunas por etapa aberta
// (Novo → Fechamento) com os cards de negócio; contador e valor total por coluna;
// negócios fechados (ganho/perdido) numa seção à parte. A RLS (0011) já escopa o
// que aparece: corretor vê os seus, gestor/admin os da org. PURA apresentação.

import type { Metadata } from "next";
import Link from "next/link";
import { formatarReais } from "@imobia/core";
import { listarNegocios, type NegocioResumo } from "@/lib/dados/negocios";
import { ChipTermometro } from "../leads/termometro";
import { classesBotao } from "@/components/ui/Botao";
import { ETAPAS_ORDEM, ROTULO_ETAPA, ROTULO_RESULTADO } from "./rotulos";

export const metadata: Metadata = { title: "Negócios — ImobIA" };
export const dynamic = "force-dynamic";

function somaValores(negocios: NegocioResumo[]): number {
  return negocios.reduce((total, n) => total + (n.valor ?? 0), 0);
}

export default async function PaginaNegocios() {
  const negocios = await listarNegocios();

  // Abertos = ainda sem resultado; entram no board por etapa. Fechados = com
  // resultado (ganho/perdido); vão para a seção separada, mais recentes primeiro.
  const abertos = negocios.filter((n) => n.resultado === null);
  const fechados = negocios.filter((n) => n.resultado !== null);

  const porEtapa = ETAPAS_ORDEM.map((etapa) => ({
    etapa,
    itens: abertos.filter((n) => n.etapa === etapa),
  }));

  return (
    <div className="flex flex-1 flex-col bg-background px-6 py-16 font-sans">
      <main className="mx-auto w-full max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Negócios
            </h1>
            <p className="mt-2 text-muted">
              Seu funil de vendas — arraste seus negócios pelas etapas até o
              fechamento.
            </p>
          </div>
          <Link href="/corretor/negocios/novo" className={classesBotao("primario", "md")}>
            Novo negócio
          </Link>
        </div>

        {abertos.length === 0 && fechados.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-border-strong bg-surface-card p-10 text-center text-subtle">
            Nenhum negócio ainda. Crie o primeiro ou converta um lead em negócio.
          </div>
        ) : (
          <>
            {/* Board: colunas por etapa, roláveis no mobile. */}
            <div className="mt-8 flex gap-4 overflow-x-auto pb-4">
              {porEtapa.map(({ etapa, itens }) => (
                <section
                  key={etapa}
                  className="flex w-72 shrink-0 flex-col rounded-2xl border border-border bg-surface p-3"
                >
                  <header className="flex items-baseline justify-between gap-2 px-1 pb-3">
                    <h2 className="text-sm font-semibold text-foreground">
                      {ROTULO_ETAPA[etapa]}
                    </h2>
                    <span className="text-xs text-subtle tabular-nums">
                      {itens.length} · {formatarReais(somaValores(itens))}
                    </span>
                  </header>
                  <div className="flex flex-col gap-2.5">
                    {itens.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-subtle">
                        Sem negócios
                      </p>
                    ) : (
                      itens.map((n) => <CartaoNegocio key={n.id} negocio={n} />)
                    )}
                  </div>
                </section>
              ))}
            </div>

            {/* Fechados: seção separada (ganho/perdido). */}
            {fechados.length > 0 && (
              <section className="mt-10">
                <h2 className="text-lg font-semibold text-foreground">
                  Fechados
                </h2>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {fechados.map((n) => (
                    <li key={n.id}>
                      <Link
                        href={`/corretor/negocios/${n.id}`}
                        className="flex flex-col gap-2 rounded-2xl border border-border bg-surface-card p-4 shadow-[var(--shadow-soft)] transition-[border-color,box-shadow] hover:border-brand/30 hover:shadow-[var(--shadow-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate font-semibold text-foreground">
                              {n.nomeContato}
                            </p>
                            <ChipResultado resultado={n.resultado} />
                          </div>
                          {n.imovelTitulo && (
                            <p className="mt-0.5 truncate text-sm text-muted">
                              {n.imovelTitulo}
                            </p>
                          )}
                        </div>
                        {n.valor !== null && (
                          <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                            {formatarReais(n.valor)}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function CartaoNegocio({ negocio }: { negocio: NegocioResumo }) {
  return (
    <Link
      href={`/corretor/negocios/${negocio.id}`}
      className="flex flex-col gap-2 rounded-xl border border-border bg-surface-card p-3 shadow-[var(--shadow-soft)] transition-[border-color,box-shadow] hover:border-brand/40 hover:shadow-[var(--shadow-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate font-semibold text-foreground">
          {negocio.nomeContato}
        </p>
        {negocio.temperatura && (
          <ChipTermometro temperatura={negocio.temperatura} />
        )}
      </div>
      {negocio.imovelTitulo && (
        <p className="truncate text-xs text-muted">{negocio.imovelTitulo}</p>
      )}
      {negocio.valor !== null && (
        <p className="text-sm font-semibold tabular-nums text-foreground">
          {formatarReais(negocio.valor)}
        </p>
      )}
    </Link>
  );
}

function ChipResultado({
  resultado,
}: {
  resultado: NegocioResumo["resultado"];
}) {
  if (!resultado) {
    return null;
  }
  const estilo =
    resultado === "ganho"
      ? "border-transparent bg-brand text-brand-contrast"
      : "border-border-strong bg-surface text-subtle";
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-medium ${estilo}`}
    >
      {ROTULO_RESULTADO[resultado]}
    </span>
  );
}
