// Landing do ImobIA — nível Airbnb/portal: hero foto-forward com busca clara,
// atalhos de categoria, imóveis em destaque e faixa de diferenciais enxuta.
// Server Component: destaques vêm do banco a cada request (RLS: só disponíveis).

import type { Metadata } from "next";
import {
  SlidersHorizontal,
  Sparkles,
  Search,
  ArrowRight,
  Building2,
  Home as HomeIcon,
  Gem,
  KeyRound,
  MapPin,
} from "lucide-react";
import Link from "next/link";
import { CardImovel } from "@/components/card-imovel";
import { NewsletterCaptura } from "@/components/NewsletterCaptura";
import { classesBotao } from "@/components/ui/Botao";
import { idsFavoritos } from "@/lib/dados/favoritos";
import { listarImoveis } from "@/lib/dados/imoveis";

export const metadata: Metadata = {
  title: "ImobIA — Monte a compra do seu imóvel do seu jeito",
};

export const dynamic = "force-dynamic";

// Atalhos que caem direto no catálogo já filtrado (mesmas chaves da URL do /imoveis).
const ATALHOS = [
  { href: "/imoveis?tipo=apartamento", icone: Building2, rotulo: "Apartamentos" },
  { href: "/imoveis?tipo=casa", icone: HomeIcon, rotulo: "Casas" },
  { href: "/imoveis?categoria=lancamento", icone: Sparkles, rotulo: "Lançamentos" },
  { href: "/imoveis?categoria=alto_padrao", icone: Gem, rotulo: "Alto padrão" },
  { href: "/imoveis?categoria=mcmv", icone: KeyRound, rotulo: "Minha Casa Minha Vida" },
];

const DIFERENCIAIS = [
  {
    icone: SlidersHorizontal,
    titulo: "Compre do seu jeito",
    texto:
      "Simule a entrada e veja a parcela mudar na hora. Você monta o plano que cabe no seu bolso.",
  },
  {
    icone: Sparkles,
    titulo: "Sonhômetro",
    texto:
      "Descubra em segundos quanto pode comprar e veja só os imóveis compatíveis com a sua renda.",
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
      {/* HERO foto-forward — fundo claro quente, detalhe âmbar sutil, busca clara */}
      <section className="relative overflow-hidden bg-surface">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-soft/60 via-surface to-surface"
        />
        {/* Halo âmbar sutil no canto — detalhe premium, uso parcimonioso */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-gold/10 blur-3xl"
        />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-6 py-20 text-center sm:py-28">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold-soft px-3.5 py-1.5 text-[0.8rem] font-medium uppercase tracking-[0.14em] text-gold-strong">
            <Sparkles size={14} aria-hidden="true" strokeWidth={2} />
            O jeito novo de comprar imóvel
          </span>
          <h1 className="max-w-3xl text-balance text-4xl font-bold leading-[1.08] tracking-[-0.03em] text-foreground sm:text-5xl md:text-6xl">
            Encontre o imóvel certo e{" "}
            <span className="text-brand">monte a compra do seu jeito.</span>
          </h1>
          <p className="max-w-xl text-pretty text-lg leading-8 text-muted">
            Escolha o imóvel, simule a entrada e veja a parcela na hora. Você tem
            o controle da sua compra do começo ao fim.
          </p>

          {/* BUSCA principal — campo de cidade + botão, leva ao catálogo (?cidade=) */}
          <form
            action="/imoveis"
            method="get"
            role="search"
            className="mt-2 flex w-full max-w-xl flex-col gap-3 rounded-2xl border border-border bg-surface-card p-2.5 shadow-[var(--shadow-soft)] sm:flex-row sm:items-center sm:gap-2"
          >
            <label className="flex flex-1 items-center gap-2.5 px-3">
              <MapPin
                size={20}
                aria-hidden="true"
                strokeWidth={2}
                className="shrink-0 text-brand"
              />
              <span className="sr-only">Cidade</span>
              <input
                type="search"
                name="cidade"
                placeholder="Busque por cidade — ex.: São Paulo, Curitiba…"
                autoComplete="address-level2"
                className="w-full bg-transparent py-2.5 text-base text-foreground placeholder:text-subtle focus:outline-none"
              />
            </label>
            <button
              type="submit"
              className={classesBotao("primario", "lg", "shrink-0")}
            >
              <Search size={18} aria-hidden="true" strokeWidth={2} />
              Buscar imóveis
            </button>
          </form>

          <Link
            href="/sonhometro"
            className="group inline-flex items-center gap-1.5 text-sm font-medium text-brand-strong transition-colors hover:text-brand-hover"
          >
            Não sabe por onde começar? Descubra quanto pode comprar
            <ArrowRight
              size={16}
              aria-hidden="true"
              strokeWidth={2}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </div>
      </section>

      {/* ATALHOS DE CATEGORIA — pílulas-cartão com ícone, linkam ao catálogo filtrado */}
      <section
        aria-label="Buscar por categoria"
        className="border-y border-border bg-background"
      >
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-3 px-6 py-8">
          {ATALHOS.map(({ href, icone: Icone, rotulo }) => (
            <Link
              key={href}
              href={href}
              className="group inline-flex items-center gap-2.5 rounded-full border border-border-strong bg-surface-card px-4 py-2.5 text-sm font-medium text-foreground shadow-[var(--shadow-soft)] transition-[background-color,border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-[var(--shadow-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-brand transition-colors group-hover:bg-brand group-hover:text-brand-contrast">
                <Icone size={17} aria-hidden="true" strokeWidth={2} />
              </span>
              {rotulo}
            </Link>
          ))}
        </div>
      </section>

      {/* IMÓVEIS EM DESTAQUE — grid de CardImovel */}
      {destaques.length > 0 && (
        <section aria-label="Imóveis em destaque" className="bg-surface">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-16 sm:py-20">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex flex-col gap-2">
                <span className="inline-flex items-center gap-2 text-[0.8rem] font-medium uppercase tracking-[0.14em] text-gold-strong">
                  <span aria-hidden className="h-px w-6 bg-gold/60" />
                  Seleção ImobIA
                </span>
                <h2 className="text-3xl font-bold tracking-[-0.02em] text-foreground sm:text-4xl">
                  Imóveis em destaque
                </h2>
                <p className="max-w-md text-base leading-7 text-muted">
                  Uma curadoria para você começar a montar sua compra.
                </p>
              </div>
              <Link
                href="/imoveis"
                className="group inline-flex items-center gap-1.5 text-sm font-medium text-brand-strong transition-colors hover:text-brand-hover"
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

      {/* DIFERENCIAIS — faixa enxuta antes do rodapé (que vem do layout) */}
      <section
        aria-label="Diferenciais ImobIA"
        className="border-t border-border bg-background"
      >
        <div className="mx-auto grid w-full max-w-6xl gap-x-10 gap-y-10 px-6 py-16 sm:grid-cols-3 sm:py-20">
          {DIFERENCIAIS.map(({ icone: Icone, titulo, texto }) => (
            <div key={titulo} className="flex flex-col gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface-card text-brand shadow-[var(--shadow-soft)]">
                <Icone size={20} aria-hidden="true" strokeWidth={1.75} />
              </span>
              <h3 className="text-lg font-semibold tracking-[-0.01em] text-foreground">
                {titulo}
              </h3>
              <p className="text-[0.95rem] leading-7 text-muted">{texto}</p>
            </div>
          ))}
          <div className="sm:col-span-3">
            <div className="flex flex-wrap items-center gap-3 pt-2">
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
        </div>
      </section>

      {/* NEWSLETTER — captura pública antes do rodapé (consentimento LGPD). */}
      <section aria-label="Newsletter ImobIA" className="border-t border-border bg-surface">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 py-16 sm:py-20 lg:grid-cols-[1.1fr_1fr]">
          <div className="flex flex-col gap-3">
            <span className="inline-flex items-center gap-2 text-[0.8rem] font-medium uppercase tracking-[0.14em] text-gold-strong">
              <span aria-hidden className="h-px w-6 bg-gold/60" />
              Newsletter ImobIA
            </span>
            <h2 className="text-3xl font-bold tracking-[-0.02em] text-foreground sm:text-4xl">
              Receba as melhores oportunidades
            </h2>
            <p className="max-w-md text-base leading-7 text-muted">
              Uma curadoria de imóveis e novidades do mercado, direto no seu
              e-mail — sem spam, cancele quando quiser.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface-card p-6 shadow-[var(--shadow-soft)] sm:p-8">
            <NewsletterCaptura />
          </div>
        </div>
      </section>
    </div>
  );
}
