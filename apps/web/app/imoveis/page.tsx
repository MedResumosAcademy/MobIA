import {
  categoriaImovelSchema,
  tipoImovelSchema,
  type CategoriaImovel,
  type TipoImovel,
} from "@mobia/domain";
import type { Metadata } from "next";
import { CardImovel } from "@/components/card-imovel";
import { FiltrosCatalogo } from "@/components/filtros-catalogo";
import { listarImoveis, type FiltrosCatalogo as Filtros } from "@/lib/dados/imoveis";

export const metadata: Metadata = { title: "Catálogo — MobIA" };

// Catálogo lê parâmetros da URL a cada request; RLS já limita a disponível.
export const dynamic = "force-dynamic";

type ParametrosBusca = {
  tipo?: string;
  categoria?: string;
  cidade?: string;
  precoMin?: string;
  precoMax?: string;
};

/** Reais (string da URL) → centavos inteiros, ou undefined se inválido. */
function reaisParaCentavos(valor?: string): number | undefined {
  if (!valor) return undefined;
  const n = Number(valor.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n * 100);
}

function derivarFiltros(params: ParametrosBusca): Filtros {
  const tipo = tipoImovelSchema.safeParse(params.tipo);
  const categoria = categoriaImovelSchema.safeParse(params.categoria);
  const cidade = params.cidade?.trim();
  return {
    tipo: tipo.success ? (tipo.data as TipoImovel) : undefined,
    categoria: categoria.success ? (categoria.data as CategoriaImovel) : undefined,
    cidadeBusca: cidade ? cidade : undefined,
    precoMin: reaisParaCentavos(params.precoMin),
    precoMax: reaisParaCentavos(params.precoMax),
  };
}

export default async function PaginaCatalogo({
  searchParams,
}: {
  searchParams: Promise<ParametrosBusca>;
}) {
  const params = await searchParams;
  const filtros = derivarFiltros(params);
  const imoveis = await listarImoveis(filtros);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 px-6 py-10 font-sans dark:bg-black">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Catálogo de imóveis
          </h1>
          <p className="text-base text-zinc-600 dark:text-zinc-400">
            Encontre o imóvel ideal e monte sua própria compra.
          </p>
        </header>

        <section
          aria-label="Filtros"
          className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <FiltrosCatalogo />
        </section>

        {imoveis.length > 0 ? (
          <section
            aria-label="Resultados"
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {imoveis.map((imovel) => (
              <CardImovel key={imovel.id} imovel={imovel} />
            ))}
          </section>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-20 text-center dark:border-zinc-700 dark:bg-zinc-950">
            <p className="text-lg font-medium text-zinc-700 dark:text-zinc-300">
              Nenhum imóvel encontrado
            </p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Tente ajustar ou limpar os filtros para ver mais opções.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
