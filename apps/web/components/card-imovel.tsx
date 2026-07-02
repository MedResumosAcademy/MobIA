import { formatarReais } from "@mobia/core";
import type { CategoriaImovel, TipoImovel } from "@mobia/domain";
import { MapPin } from "lucide-react";
import Link from "next/link";
import { BotaoFavoritar } from "@/components/BotaoFavoritar";
import { AtributosImovel } from "@/components/ui/AtributosImovel";
import { Badge, type VarianteBadge } from "@/components/ui/Badge";
import { Selo } from "@/components/ui/Selo";
import type { CardImovel as DadosCardImovel } from "@/lib/dados/imoveis";

const ROTULOS_TIPO: Record<TipoImovel, string> = {
  casa: "Casa",
  apartamento: "Apartamento",
  terreno: "Terreno",
};

const ROTULOS_CATEGORIA: Record<CategoriaImovel, string> = {
  lancamento: "Lançamento",
  alto_padrao: "Alto padrão",
  mcmv: "Minha Casa Minha Vida",
};

const VARIANTE_CATEGORIA: Record<CategoriaImovel, VarianteBadge> = {
  lancamento: "lancamento",
  alto_padrao: "alto_padrao",
  mcmv: "mcmv",
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
  // Selo no topo-esquerdo: prioriza a categoria. Alto padrão e lançamento
  // ganham o selo âmbar "Destaque" (premium, uso parcimonioso); as demais
  // categorias usam a pílula editorial própria; sem categoria, cai no tipo.
  const categoria = imovel.categorias[0] ?? null;
  const ehDestaque = categoria === "alto_padrao" || categoria === "lancamento";

  return (
    // O coração é irmão do Link (não filho): botão dentro de <a> é HTML inválido
    // e o clique navegaria. O wrapper relativo ancora o overlay do coração.
    // Card foto-forward (Airbnb/portal): foto arredondada com zoom no hover,
    // elevação suave (translate + shadow-card), sombra-soft em repouso.
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface-card shadow-[var(--shadow-soft)] transition-all duration-300 ease-out hover:-translate-y-1 hover:border-border-strong/60 hover:shadow-[var(--shadow-card)]">
      <BotaoFavoritar
        imovelId={imovel.id}
        inicialFavoritado={favoritado}
        variante="card"
        atualizarAoAlternar={aoAlternar}
      />
      <Link
        href={`/imoveis/${imovel.id}`}
        className="flex flex-1 flex-col rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card"
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-muted">
          {imovel.fotoCapa ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imovel.fotoCapa}
              alt={imovel.titulo}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
            />
          ) : (
            <div
              aria-hidden
              className="flex h-full w-full items-center justify-center text-subtle"
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
          {/* Gradiente sutil no topo p/ ancorar o selo e dar contraste sobre a foto. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/20 to-transparent"
          />
          <div className="absolute left-3.5 top-3.5">
            {ehDestaque ? (
              <Selo variante="destaque">
                {ROTULOS_CATEGORIA[categoria as CategoriaImovel]}
              </Selo>
            ) : categoria ? (
              <Badge variante={VARIANTE_CATEGORIA[categoria]}>
                {ROTULOS_CATEGORIA[categoria]}
              </Badge>
            ) : (
              <Badge variante="neutro">{rotuloTipo}</Badge>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col p-4">
          {/* Preço: destaque máximo em SANS bold (como as referências), tabular-nums. */}
          <p className="text-2xl font-bold leading-none tracking-[-0.02em] tabular-nums text-foreground">
            {formatarReais(imovel.valor)}
          </p>
          <h3 className="mt-2 line-clamp-1 text-[0.95rem] font-medium leading-snug text-foreground">
            {imovel.titulo}
          </h3>
          <p className="mt-1 flex items-start gap-1.5 text-sm text-muted">
            <MapPin
              size={15}
              className="mt-0.5 shrink-0 text-gold"
              aria-hidden="true"
              strokeWidth={1.8}
            />
            <span className="line-clamp-1">
              {imovel.endereco ? `${imovel.endereco} · ` : ""}
              {imovel.cidade}/{imovel.uf}
            </span>
          </p>
          <AtributosImovel
            areaUtil={imovel.areaUtil}
            quartos={imovel.quartos}
            banheiros={imovel.banheiros}
            vagas={imovel.vagas}
            variante="card"
            className="mt-auto border-t border-border pt-3.5"
          />
        </div>
      </Link>
    </div>
  );
}
