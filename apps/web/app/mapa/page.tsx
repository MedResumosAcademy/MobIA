import { formatarReais } from "@imobia/core";
import type { Metadata } from "next";
import Link from "next/link";
import MapaBrasil, { type DadoUf } from "@/components/MapaBrasil";
import { agregarImoveisPorUf } from "@/lib/dados/imoveis";

export const metadata: Metadata = {
  title: "Imóveis pelo Brasil",
  description:
    "Explore imóveis à venda pelo mapa do Brasil: navegue por estado e cidade e encontre oportunidades perto de onde você quer morar.",
};

// Página 100% pública (sem cookies/sessão): o agregado por UF é cacheado e
// revalidado a cada 5 min — evita render + query no banco a cada hit.
export const revalidate = 300;

/** Nomes por extenso das 27 UFs — só para exibição no ranking. */
const NOMES_UF: Record<string, string> = {
  AC: "Acre",
  AL: "Alagoas",
  AP: "Amapá",
  AM: "Amazonas",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MT: "Mato Grosso",
  MS: "Mato Grosso do Sul",
  MG: "Minas Gerais",
  PA: "Pará",
  PB: "Paraíba",
  PR: "Paraná",
  PE: "Pernambuco",
  PI: "Piauí",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul",
  RO: "Rondônia",
  RR: "Roraima",
  SC: "Santa Catarina",
  SP: "São Paulo",
  SE: "Sergipe",
  TO: "Tocantins",
};

export default async function PaginaMapa() {
  const agregados = await agregarImoveisPorUf();
  // O total geral vem sob a chave sentinela "__total"; separa da lista de UFs.
  const total = agregados.find((a) => a.uf === "__total");
  const estados = agregados.filter((a) => a.uf !== "__total");
  const dadosMapa: DadoUf[] = estados.map((e) => ({
    uf: e.uf,
    quantidade: e.quantidade,
  }));
  const temImoveis = estados.length > 0;

  return (
    <div className="flex flex-1 flex-col bg-background px-6 py-14 font-sans sm:py-16">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <header className="flex flex-col gap-3">
          <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-gold-strong">
            <span aria-hidden className="h-px w-8 bg-gold" />
            Explorar por estado
          </span>
          <h1 className="font-serif text-4xl tracking-tight text-foreground sm:text-5xl">
            Imóveis pelo Brasil
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-muted">
            Toque em um estado no mapa ou na lista para ver os imóveis disponíveis
            naquela região.
          </p>
        </header>

        {temImoveis ? (
          <section className="grid grid-cols-1 gap-10 lg:grid-cols-[1.2fr_1fr]">
            {/* Choropleth clicável em destaque. */}
            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border border-border bg-surface-card p-4 shadow-[var(--shadow-soft)] sm:p-6">
                <MapaBrasil dados={dadosMapa} />
              </div>
              {/* Legenda da escala de cor. */}
              <div className="flex items-center gap-3 px-1 text-xs text-subtle">
                <span>Menos imóveis</span>
                <span
                  aria-hidden
                  className="h-2.5 flex-1 rounded-full"
                  style={{
                    background:
                      "linear-gradient(to right, #f0ebe3, #db6414)",
                  }}
                />
                <span>Mais imóveis</span>
              </div>
            </div>

            {/* Ranking de UFs — também clicável. */}
            <div className="flex flex-col gap-4">
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-semibold tracking-tight text-foreground">
                  Estados com imóveis
                </h2>
                {total ? (
                  <span className="text-sm text-subtle">
                    <span className="tabular-nums font-semibold text-brand-strong">
                      {total.quantidade}
                    </span>{" "}
                    no total
                  </span>
                ) : null}
              </div>
              <ul className="flex flex-col gap-2">
                {estados.map((e) => (
                  <li key={e.uf}>
                    <Link
                      href={`/imoveis?uf=${e.uf}`}
                      className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-card px-4 py-3 shadow-[var(--shadow-soft)] transition-colors hover:border-brand hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25"
                    >
                      <span className="flex items-center gap-3">
                        <span className="inline-flex h-8 w-9 shrink-0 items-center justify-center rounded-md bg-surface-strong text-sm font-bold tracking-tight text-brand-strong">
                          {e.uf}
                        </span>
                        <span className="flex flex-col">
                          <span className="text-sm font-medium text-foreground">
                            {NOMES_UF[e.uf] ?? e.uf}
                          </span>
                          <span className="text-xs text-subtle">
                            a partir de {formatarReais(e.valorMinimo)}
                          </span>
                        </span>
                      </span>
                      <span className="flex items-center gap-2 text-sm text-muted">
                        <span className="tabular-nums font-semibold text-foreground">
                          {e.quantidade}
                        </span>
                        <span aria-hidden className="text-brand transition-transform group-hover:translate-x-0.5">
                          →
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-strong bg-surface-card px-6 py-24 text-center shadow-[var(--shadow-soft)]">
            <p className="text-xl font-semibold tracking-tight text-foreground">
              Nenhum imóvel no mapa ainda
            </p>
            <p className="max-w-sm text-sm leading-relaxed text-subtle">
              Assim que houver imóveis disponíveis, eles aparecerão aqui por estado.
            </p>
            <Link
              href="/imoveis"
              className="mt-2 inline-flex items-center rounded-full border border-border-strong bg-surface-card px-4 py-2 text-sm font-medium text-brand-strong transition-colors hover:border-brand hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25"
            >
              Ver catálogo
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
