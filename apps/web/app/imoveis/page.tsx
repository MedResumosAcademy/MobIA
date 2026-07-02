import {
  categoriaImovelSchema,
  tipoImovelSchema,
  type CategoriaImovel,
  type TipoImovel,
} from "@mobia/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { BannerCapacidade } from "@/components/BannerCapacidade";
import { CardImovel } from "@/components/card-imovel";
import { FiltrosCatalogo } from "@/components/filtros-catalogo";
import { obterCapacidadeAtual } from "@/lib/capacidade";
import { idsFavoritos } from "@/lib/dados/favoritos";
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
  quartosMin?: string;
  /** ?todos=1 desliga o filtro de capacidade do Sonhômetro nesta visita (H-18). */
  todos?: string;
};

/** Reais (string da URL) → centavos inteiros, ou undefined se inválido. */
function reaisParaCentavos(valor?: string): number | undefined {
  if (!valor) return undefined;
  const n = Number(valor.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n * 100);
}

/** String da URL → inteiro positivo, ou undefined se inválido. */
function inteiroPositivo(valor?: string): number | undefined {
  if (!valor) return undefined;
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 1) return undefined;
  return n;
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
    quartosMin: inteiroPositivo(params.quartosMin),
  };
}

export default async function PaginaCatalogo({
  searchParams,
}: {
  searchParams: Promise<ParametrosBusca>;
}) {
  const params = await searchParams;
  const filtros = derivarFiltros(params);

  // H-18: por padrão, filtra pela capacidade do Sonhômetro (cookie/perfil). O
  // usuário pode desligar via ?todos=1 ("Ver todos") sem perder o cálculo.
  const verTodos = params.todos === "1";
  const capacidade = verTodos ? null : await obterCapacidadeAtual();
  if (capacidade !== null) {
    filtros.capacidadeMax = capacidade;
  }

  const [imoveis, favoritos] = await Promise.all([
    listarImoveis(filtros),
    idsFavoritos(), // vazio se anônimo — marca os corações já favoritados
  ]);

  const total = imoveis.length;
  const rotuloContagem =
    total === 1 ? "1 imóvel encontrado" : `${total} imóveis encontrados`;

  return (
    <div className="flex flex-1 flex-col bg-background px-6 py-14 font-sans sm:py-16">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <header className="flex flex-col gap-3">
          <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-gold-strong">
            <span aria-hidden className="h-px w-8 bg-gold" />
            Catálogo
          </span>
          <h1 className="font-serif text-4xl tracking-tight text-foreground sm:text-5xl">
            Encontre onde sua história vai morar
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-muted">
            Imóveis selecionados para você explorar com calma e montar a compra do seu jeito.
          </p>
        </header>

        <section
          aria-label="Filtros"
          className="sticky top-16 z-20 rounded-3xl border border-border bg-surface-card/95 p-5 shadow-[var(--shadow-soft)] backdrop-blur-sm"
        >
          <FiltrosCatalogo />
        </section>

        {capacidade !== null ? (
          <BannerCapacidade capacidade={capacidade} />
        ) : (
          <Link
            href="/sonhometro"
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-border-strong bg-surface px-4 py-3 text-sm transition-colors hover:border-brand"
          >
            <span className="text-muted">
              Descubra quanto você pode comprar e veja só os imóveis compatíveis com sua renda.
            </span>
            <span className="font-medium text-brand">
              Abrir o Sonhômetro →
            </span>
          </Link>
        )}

        {total > 0 ? (
          <>
            <div className="flex items-center gap-4">
              <p
                aria-live="polite"
                className="font-serif text-lg text-foreground"
              >
                {rotuloContagem}
              </p>
              <span aria-hidden className="h-px flex-1 bg-border" />
            </div>
            <section
              aria-label="Resultados"
              className="grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-3"
            >
              {imoveis.map((imovel) => (
                <CardImovel
                  key={imovel.id}
                  imovel={imovel}
                  favoritado={favoritos.has(imovel.id)}
                />
              ))}
            </section>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border-strong bg-surface-card px-6 py-24 text-center shadow-[var(--shadow-soft)]">
            <p className="font-serif text-2xl text-foreground">
              Nenhum imóvel encontrado
            </p>
            <p className="max-w-sm text-sm leading-relaxed text-subtle">
              Tente ajustar ou limpar os filtros para ver mais opções.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
