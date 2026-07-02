import { formatarReais } from "@mobia/core";
import type { TipoImovel } from "@mobia/domain";
import Link from "next/link";
import { BotaoFavoritar } from "@/components/BotaoFavoritar";
import type { CardImovel as DadosCardImovel } from "@/lib/dados/imoveis";

const ROTULOS_TIPO: Record<TipoImovel, string> = {
  casa: "Casa",
  apartamento: "Apartamento",
  terreno: "Terreno",
};

export function CardImovel({
  imovel,
  favoritado = false,
  aoAlternar = false,
}: {
  imovel: DadosCardImovel;
  /** Se o cliente logado já favoritou (marca o coração). */
  favoritado?: boolean;
  /** Em /favoritos: ao desfavoritar, recarrega para o card sumir. */
  aoAlternar?: boolean;
}) {
  const rotuloTipo = imovel.tipo ? ROTULOS_TIPO[imovel.tipo] : "Imóvel";

  return (
    // O coração é irmão do Link (não filho): botão dentro de <a> é HTML inválido
    // e o clique navegaria. O wrapper relativo ancora o overlay do coração.
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950">
      <BotaoFavoritar
        imovelId={imovel.id}
        inicialFavoritado={favoritado}
        variante="card"
        atualizarAoAlternar={aoAlternar}
      />
      <Link href={`/imoveis/${imovel.id}`} className="flex flex-1 flex-col">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-900">
        {imovel.fotoCapa ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imovel.fotoCapa}
            alt={imovel.titulo}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div
            aria-hidden
            className="flex h-full w-full items-center justify-center text-zinc-300 dark:text-zinc-700"
          >
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 10.5 12 3l9 7.5" />
              <path d="M5 9.5V21h14V9.5" />
              <path d="M9 21v-6h6v6" />
            </svg>
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-zinc-700 backdrop-blur dark:bg-zinc-900/90 dark:text-zinc-300">
          {rotuloTipo}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
          {imovel.titulo}
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {imovel.cidade}/{imovel.uf}
        </p>
        <p className="mt-2 text-lg font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
          {formatarReais(imovel.valor)}
        </p>
      </div>
      </Link>
    </div>
  );
}
