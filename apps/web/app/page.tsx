// Landing do MobIA — revista de arquitetura / alto padrão ("Claro & Editorial").
// Hero editorial arejado + diferenciais + imóveis em destaque + faixa de confiança.
// Server Component: destaques vêm do banco a cada request (RLS: só disponíveis).

import type { Metadata } from "next";
import {
  SlidersHorizontal,
  Sparkles,
  Heart,
  ArrowRight,
  ShieldCheck,
  KeyRound,
} from "lucide-react";
import Link from "next/link";
import { CardImovel } from "@/components/card-imovel";
import { classesBotao } from "@/components/ui/Botao";
import { Divisor } from "@/components/ui/Divisor";
import { idsFavoritos } from "@/lib/dados/favoritos";
import { listarImoveis } from "@/lib/dados/imoveis";

export const metadata: Metadata = {
  title: "MobIA — Monte a compra do seu imóvel do seu jeito",
};

export const dynamic = "force-dynamic";

const DIFERENCIAIS = [
  {
    icone: SlidersHorizontal,
    titulo: "Compre do seu jeito",
    texto:
      "Simule a entrada e veja a parcela mudar na hora. Você monta o plano que cabe no seu bolso — sem surpresas.",
  },
  {
    icone: Sparkles,
    titulo: "Sonhômetro",
    texto:
      "Descubra em segundos quanto você pode comprar e veja apenas os imóveis compatíveis com a sua renda.",
  },
  {
    icone: KeyRound,
    titulo: "Sem burocracia",
    texto:
      "Favorite, compare e decida no seu tempo — transparência do início ao fim, sem letras miúdas.",
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
      {/* HERO editorial — composição arejada, marfim com verde-suave e detalhe dourado */}
      <section className="relative overflow-hidden bg-surface">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-soft/70 via-surface to-surface"
        />
        {/* Halo dourado sutil no canto — detalhe premium, uso parcimonioso */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-gold/10 blur-3xl"
        />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col items-start gap-7 px-6 py-24 sm:py-32">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold-soft px-3.5 py-1.5 text-[0.8rem] font-medium uppercase tracking-[0.14em] text-gold-strong">
            <Sparkles size={14} aria-hidden="true" strokeWidth={2} />
            O jeito novo de comprar imóvel
          </span>
          <h1 className="max-w-4xl text-balance font-serif text-[2.75rem] font-semibold leading-[1.05] tracking-[-0.025em] text-foreground sm:text-6xl md:text-7xl">
            Encontre o imóvel certo.{" "}
            <span className="text-brand">Monte a compra do seu jeito.</span>
          </h1>
          <p className="max-w-2xl text-pretty text-lg leading-8 text-muted sm:text-xl">
            Escolha o imóvel, simule a entrada e veja a parcela na hora. Com o
            MobIA, você tem o controle da sua compra do começo ao fim — com a
            elegância que uma decisão dessas merece.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Link href="/imoveis" className={classesBotao("primario", "lg")}>
              Ver imóveis
              <ArrowRight size={18} aria-hidden="true" strokeWidth={2} />
            </Link>
            <Link
              href="/sonhometro"
              className={classesBotao("secundario", "lg")}
            >
              Descubra quanto pode comprar
            </Link>
          </div>
        </div>
        {/* Hairline dourada de fechamento do hero */}
        <Divisor dourado className="opacity-60" />
      </section>

      {/* DIFERENCIAIS — 3 blocos editoriais arejados */}
      <section
        aria-label="Diferenciais MobIA"
        className="border-b border-border bg-background"
      >
        <div className="mx-auto grid w-full max-w-6xl gap-x-10 gap-y-12 px-6 py-20 sm:grid-cols-3">
          {DIFERENCIAIS.map(({ icone: Icone, titulo, texto }) => (
            <div key={titulo} className="flex flex-col gap-4">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-surface-card text-brand shadow-[var(--shadow-soft)]">
                <Icone size={22} aria-hidden="true" strokeWidth={1.75} />
              </span>
              <h2 className="font-serif text-2xl font-semibold tracking-[-0.01em] text-foreground">
                {titulo}
              </h2>
              <p className="text-[0.95rem] leading-7 text-muted">{texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* IMÓVEIS EM DESTAQUE */}
      {destaques.length > 0 && (
        <section aria-label="Imóveis em destaque" className="bg-surface">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-20">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex flex-col gap-2">
                <span className="inline-flex items-center gap-2 text-[0.8rem] font-medium uppercase tracking-[0.14em] text-gold-strong">
                  <span aria-hidden className="h-px w-6 bg-gold/60" />
                  Seleção MobIA
                </span>
                <h2 className="font-serif text-4xl font-semibold tracking-[-0.02em] text-foreground sm:text-5xl">
                  Imóveis em destaque
                </h2>
                <p className="max-w-md text-base leading-7 text-muted">
                  Uma curadoria para você começar a montar sua compra.
                </p>
              </div>
              <Link
                href="/imoveis"
                className="group inline-flex items-center gap-1.5 text-sm font-medium text-brand transition-colors hover:text-brand-hover"
              >
                Ver todos os imóveis
                <ArrowRight
                  size={16}
                  aria-hidden="true"
                  strokeWidth={2}
                  className="transition-transform group-hover:translate-x-0.5"
                />
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

      {/* FAIXA DE CONFIANÇA / FECHAMENTO — antes do rodapé (que vem do layout) */}
      <section
        aria-label="Confiança MobIA"
        className="border-t border-border bg-background"
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-6 py-20 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-gold/30 bg-gold-soft text-gold-strong">
            <ShieldCheck size={22} aria-hidden="true" strokeWidth={1.75} />
          </span>
          <h2 className="max-w-2xl font-serif text-3xl font-semibold tracking-[-0.02em] text-foreground sm:text-4xl">
            Transparência do primeiro clique à chave na mão.
          </h2>
          <p className="max-w-xl text-base leading-7 text-muted">
            Sem letras miúdas, sem pressão. Você monta a compra, entende cada
            número e decide no seu tempo — com um corretor de verdade quando
            precisar.
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <Link href="/imoveis" className={classesBotao("primario", "lg")}>
              Começar agora
              <ArrowRight size={18} aria-hidden="true" strokeWidth={2} />
            </Link>
            <Link
              href="/favoritos"
              className={classesBotao("fantasma", "lg")}
            >
              <Heart size={17} aria-hidden="true" strokeWidth={2} />
              Meus favoritos
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
