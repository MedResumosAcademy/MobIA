// Landing do MobIA — portal imobiliário (tema claro). Hero comercial +
// faixa de diferenciais + imóveis em destaque (Server Component).

import type { Metadata } from "next";
import { SlidersHorizontal, Sparkles, Heart, ArrowRight } from "lucide-react";
import Link from "next/link";
import { CardImovel } from "@/components/card-imovel";
import { classesBotao } from "@/components/ui/Botao";
import { idsFavoritos } from "@/lib/dados/favoritos";
import { listarImoveis } from "@/lib/dados/imoveis";

export const metadata: Metadata = { title: "MobIA — Monte a compra do seu imóvel do seu jeito" };

// Imóveis em destaque vêm do banco a cada request (RLS: só disponíveis).
export const dynamic = "force-dynamic";

const DIFERENCIAIS = [
  {
    icone: SlidersHorizontal,
    titulo: "Compre do seu jeito",
    texto: "Simule a entrada e veja a parcela mudar na hora. Você monta o plano que cabe no seu bolso.",
  },
  {
    icone: Sparkles,
    titulo: "Sonhômetro",
    texto: "Descubra em segundos quanto você pode comprar e veja só os imóveis compatíveis com sua renda.",
  },
  {
    icone: Heart,
    titulo: "Sem burocracia",
    texto: "Favorite, compare e decida no seu tempo — transparência do início ao fim, sem letras miúdas.",
  },
];

export default async function Home() {
  const [imoveis, favoritos] = await Promise.all([
    listarImoveis(),
    idsFavoritos(),
  ]);
  const destaques = imoveis.slice(0, 6);

  return (
    <div className="flex flex-1 flex-col font-sans">
      {/* HERO */}
      <section className="relative overflow-hidden bg-surface">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-soft via-surface to-surface"
        />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-6 py-20 sm:py-28">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-sm font-medium text-brand-soft-fg">
            <Sparkles size={15} aria-hidden="true" strokeWidth={2} />
            O jeito novo de comprar imóvel
          </span>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
            Monte a compra do seu imóvel{" "}
            <span className="text-brand">do seu jeito</span>
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-muted">
            Escolha o imóvel, simule a entrada e veja a parcela na hora. Com o
            MobIA, você tem o controle da sua compra do começo ao fim.
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            <Link href="/imoveis" className={classesBotao("primario", "lg")}>
              Ver imóveis
              <ArrowRight size={18} aria-hidden="true" strokeWidth={2} />
            </Link>
            <Link href="/sonhometro" className={classesBotao("secundario", "lg")}>
              Descubra quanto pode comprar
            </Link>
          </div>
        </div>
      </section>

      {/* FAIXA DE DIFERENCIAIS */}
      <section
        aria-label="Diferenciais MobIA"
        className="border-y border-border bg-surface-muted"
      >
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-16 sm:grid-cols-3">
          {DIFERENCIAIS.map(({ icone: Icone, titulo, texto }) => (
            <div
              key={titulo}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-6 shadow-sm"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand-soft-fg">
                <Icone size={22} aria-hidden="true" strokeWidth={2} />
              </span>
              <h2 className="text-lg font-semibold text-foreground">{titulo}</h2>
              <p className="text-sm leading-6 text-muted">{texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* IMÓVEIS EM DESTAQUE */}
      {destaques.length > 0 && (
        <section
          aria-label="Imóveis em destaque"
          className="bg-surface"
        >
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-16">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex flex-col gap-1">
                <h2 className="text-3xl font-semibold tracking-tight text-foreground">
                  Imóveis em destaque
                </h2>
                <p className="text-base text-muted">
                  Uma seleção para você começar a montar sua compra.
                </p>
              </div>
              <Link
                href="/imoveis"
                className="inline-flex items-center gap-1 text-sm font-medium text-brand transition-colors hover:text-brand-hover"
              >
                Ver todos
                <ArrowRight size={16} aria-hidden="true" strokeWidth={2} />
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {destaques.map((imovel) => (
                <CardImovel
                  key={imovel.id}
                  imovel={imovel}
                  favoritado={favoritos.has(imovel.id)}
                />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
