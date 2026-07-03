// Landing do ImobIA — hero IMERSIVO full-bleed (foto de imóvel + overlay quente,
// Ken Burns sutil, entrada escalonada, cards flutuantes com imóveis reais e
// barra de prova social), atalhos de categoria, destaques e diferenciais.
// Server Component: dados vêm do banco a cada request (RLS: só disponíveis);
// animações 100% CSS (keyframes em globals.css), sem dependências novas.

import { formatarReais } from "@imobia/core";
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
import type { CSSProperties } from "react";
import { preload } from "react-dom";
import { CardImovel } from "@/components/card-imovel";
import { NewsletterCaptura } from "@/components/NewsletterCaptura";
import { RevelarAoRolar } from "@/components/RevelarAoRolar";
import { classesBotao } from "@/components/ui/Botao";
import { Selo } from "@/components/ui/Selo";
import { idsFavoritos } from "@/lib/dados/favoritos";
import { agregarImoveisPorUf, listarImoveis } from "@/lib/dados/imoveis";

export const metadata: Metadata = {
  // Home foge do template "%s — ImobIA" do root (o wordmark já abre o título).
  title: { absolute: "ImobIA — Monte a compra do seu imóvel do seu jeito" },
  description:
    "ImobIA: o primeiro aplicativo que permite ao cliente montar sua própria compra de imóvel — catálogo, simulador e comparador em um só lugar.",
};

export const dynamic = "force-dynamic";

// Foto do hero — casa moderna de alto padrão ao entardecer (Unsplash, validada
// com HTTP 200). Tons quentes conversam com a paleta laranja/âmbar da marca.
// Variantes responsivas via API do Unsplash (w=): o navegador escolhe pelo
// srcset/sizes e evita baixar 2400px em telas pequenas (LCP mobile).
const FOTO_HERO_BASE =
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9";
const FOTO_HERO = `${FOTO_HERO_BASE}?w=2400&q=80`;
const FOTO_HERO_SRCSET = [800, 1600, 2400]
  .map((w) => `${FOTO_HERO_BASE}?w=${w}&q=80 ${w}w`)
  .join(", ");
const FOTO_HERO_SIZES = "100vw";

/** Delay de animação via custom property lida por .animar-entrada/.animar-flutuar. */
function atraso(ms: number): CSSProperties {
  return { "--atraso": `${ms}ms` } as CSSProperties;
}

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
  // Preload responsivo da imagem LCP — imageSrcSet/imageSizes fazem o
  // navegador pré-carregar SÓ a variante adequada ao viewport.
  preload(FOTO_HERO, {
    as: "image",
    imageSrcSet: FOTO_HERO_SRCSET,
    imageSizes: FOTO_HERO_SIZES,
    fetchPriority: "high",
  });

  // limite: 8 — a landing só exibe 6 destaques + 2 cards do hero; sem o teto a
  // query baixava a tabela inteira (select * sem limit) a cada request.
  const [imoveis, favoritos, agregados] = await Promise.all([
    listarImoveis({ limite: 8 }),
    idsFavoritos(),
    agregarImoveisPorUf(),
  ]);
  const destaques = imoveis.slice(0, 6);

  // Cards flutuantes do hero: 2 imóveis reais COM foto; sem foto ⇒ degrade
  // para cards estáticos (cidade/preço, sem thumb).
  const comFoto = imoveis.filter((i) => i.fotoCapa !== null).slice(0, 2);
  const cardsHero = comFoto.length > 0 ? comFoto : imoveis.slice(0, 2);

  // Prova social com números REAIS (agregado público por UF).
  const totalImoveis =
    agregados.find((a) => a.uf === "__total")?.quantidade ?? 0;
  const totalEstados = agregados.filter(
    (a) => a.uf !== "__total" && a.quantidade > 0,
  ).length;
  const provas = [
    totalImoveis > 0
      ? `${totalImoveis} ${totalImoveis === 1 ? "imóvel disponível" : "imóveis disponíveis"}`
      : null,
    totalEstados > 0
      ? `${totalEstados} ${totalEstados === 1 ? "estado" : "estados"}`
      : null,
    "Simulação de parcela na hora",
    "Corretores em todo o Brasil",
  ].filter((p): p is string => p !== null);

  return (
    <div className="flex flex-1 flex-col font-sans">
      {/* HERO IMERSIVO — foto full-bleed com overlay quente, Ken Burns sutil,
          entrada escalonada, cards flutuantes e prova social na base. */}
      <section className="relative flex min-h-[85vh] flex-col overflow-hidden bg-foreground">
        {/* Foto de fundo (LCP) — decorativa; Ken Burns desligado em reduced-motion */}
        <img
          src={FOTO_HERO}
          srcSet={FOTO_HERO_SRCSET}
          sizes={FOTO_HERO_SIZES}
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          className="animar-kenburns absolute inset-0 h-full w-full object-cover"
        />
        {/* Overlay em gradiente quente — garante contraste AA do texto branco */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-black/75 via-black/45 to-black/10"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand-strong/30 via-transparent to-transparent"
        />

        <div className="relative mx-auto grid w-full max-w-7xl flex-1 items-center gap-12 px-6 py-16 sm:py-20 lg:grid-cols-[1.05fr_0.95fr]">
          {/* Coluna esquerda — mensagem + busca (entrada escalonada 0→400ms) */}
          <div className="flex flex-col items-start gap-6 text-left">
            <span
              className="animar-entrada inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-[0.8rem] font-medium uppercase tracking-[0.14em] text-white backdrop-blur-md"
              style={atraso(0)}
            >
              <Sparkles
                size={14}
                aria-hidden="true"
                strokeWidth={2}
                className="text-gold"
              />
              O jeito novo de comprar imóvel
            </span>
            <h1
              className="animar-entrada max-w-2xl text-balance font-serif text-4xl font-semibold leading-[1.08] tracking-[-0.02em] text-white sm:text-5xl md:text-6xl"
              style={atraso(100)}
            >
              Encontre o imóvel certo e{" "}
              <span className="bg-gradient-to-r from-gold to-brand bg-clip-text text-transparent">
                monte a compra do seu jeito.
              </span>
            </h1>
            <p
              className="animar-entrada max-w-xl text-pretty text-lg leading-8 text-white/80"
              style={atraso(200)}
            >
              Escolha o imóvel, simule a entrada e veja a parcela na hora. Você
              tem o controle da sua compra do começo ao fim.
            </p>

            {/* BUSCA em glassmorphism — mesmo form/action de sempre (GET /imoveis?cidade=) */}
            <form
              action="/imoveis"
              method="get"
              role="search"
              className="animar-entrada mt-2 flex w-full max-w-xl flex-col gap-3 rounded-3xl bg-white/95 p-2.5 shadow-xl backdrop-blur-md transition-shadow focus-within:ring-2 focus-within:ring-[var(--focus-ring)] sm:flex-row sm:items-center sm:gap-2 sm:rounded-full"
              style={atraso(300)}
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
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-brand px-6 py-3 text-base font-semibold text-brand-contrast transition-colors duration-200 hover:bg-brand-hover active:translate-y-px"
              >
                <Search size={18} aria-hidden="true" strokeWidth={2} />
                Buscar imóveis
              </button>
            </form>

            <Link
              href="/sonhometro"
              className="animar-entrada group inline-flex items-center gap-1.5 text-sm font-medium text-gold transition-colors hover:text-gold/80"
              style={atraso(400)}
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

          {/* Coluna direita — cards flutuantes com imóveis reais (só em lg+) */}
          <div className="hidden lg:flex lg:flex-col lg:gap-6 lg:pl-8">
            {cardsHero.map((imovel, i) => (
              <div
                key={imovel.id}
                className={`animar-flutuar w-72 ${i % 2 === 0 ? "self-start" : "self-end"}`}
                style={atraso(i * -2000)}
              >
                <Link
                  href={`/imoveis/${imovel.id}`}
                  className="block overflow-hidden rounded-2xl bg-white/90 p-3 shadow-2xl backdrop-blur-md transition-transform duration-300 hover:scale-[1.03]"
                >
                  {imovel.fotoCapa !== null && (
                    <span className="relative mb-3 block overflow-hidden rounded-xl">
                      <img
                        src={imovel.fotoCapa}
                        alt=""
                        loading="lazy"
                        className="h-36 w-full object-cover"
                      />
                      <Selo variante="marca" className="absolute left-2 top-2">
                        Disponível
                      </Selo>
                    </span>
                  )}
                  <span className="flex items-end justify-between gap-2 px-1 pb-1">
                    <span className="block">
                      <span className="block text-sm font-medium text-muted">
                        {imovel.cidade}/{imovel.uf}
                      </span>
                      <span className="block text-lg font-bold text-foreground">
                        {formatarReais(imovel.valor)}
                      </span>
                    </span>
                    {imovel.fotoCapa === null && (
                      <Selo variante="marca">Disponível</Selo>
                    )}
                  </span>
                </Link>
              </div>
            ))}
            <div className="animar-flutuar self-center" style={atraso(-4000)}>
              <div className="flex items-center gap-2.5 rounded-2xl bg-white/90 px-4 py-3 shadow-2xl backdrop-blur-md">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gold-soft text-gold-strong">
                  <Sparkles size={17} aria-hidden="true" strokeWidth={2} />
                </span>
                <p className="text-sm font-semibold text-foreground">
                  Simule a parcela na hora
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Prova social — números reais na base do hero */}
        <div className="relative border-t border-white/15">
          <ul className="animar-entrada mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-6 py-5 text-sm text-white/70" style={atraso(500)}>
            {provas.map((prova, i) => (
              <li key={prova} className="flex items-center gap-3">
                {i > 0 && (
                  <span aria-hidden="true" className="text-white/30">
                    ·
                  </span>
                )}
                {prova}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ATALHOS DE CATEGORIA — pílulas-cartão com ícone, linkam ao catálogo filtrado */}
      <section
        aria-label="Buscar por categoria"
        className="border-y border-border bg-background"
      >
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-3 px-6 py-8">
          {ATALHOS.map(({ href, icone: Icone, rotulo }, i) => (
            <RevelarAoRolar key={href} atraso={i * 60}>
              <Link
                href={href}
                className="group inline-flex items-center gap-2.5 rounded-full border border-border-strong bg-surface-card px-4 py-2.5 text-sm font-medium text-foreground shadow-[var(--shadow-soft)] transition-[background-color,border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-[var(--shadow-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-brand transition-colors group-hover:bg-brand group-hover:text-brand-contrast">
                  <Icone size={17} aria-hidden="true" strokeWidth={2} />
                </span>
                {rotulo}
              </Link>
            </RevelarAoRolar>
          ))}
        </div>
      </section>

      {/* IMÓVEIS EM DESTAQUE — grid de CardImovel */}
      {destaques.length > 0 && (
        <section aria-label="Imóveis em destaque" className="bg-surface">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-20 sm:py-24">
            <RevelarAoRolar className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex flex-col gap-2">
                <span className="inline-flex items-center gap-2 text-[0.8rem] font-medium uppercase tracking-[0.14em] text-gold-strong">
                  <span aria-hidden className="h-px w-6 bg-gold/60" />
                  Seleção ImobIA
                </span>
                <h2 className="font-serif text-3xl font-semibold tracking-[-0.02em] text-foreground sm:text-4xl">
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
            </RevelarAoRolar>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {destaques.map((imovel, i) => (
                <RevelarAoRolar
                  key={imovel.id}
                  atraso={(i % 3) * 100}
                  className="grid h-full"
                >
                  <CardImovel
                    imovel={imovel}
                    favoritado={favoritos.has(imovel.id)}
                  />
                </RevelarAoRolar>
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
        <div className="mx-auto grid w-full max-w-6xl gap-x-8 gap-y-8 px-6 py-20 sm:grid-cols-3 sm:py-24">
          {DIFERENCIAIS.map(({ icone: Icone, titulo, texto }, i) => (
            <RevelarAoRolar key={titulo} atraso={i * 100} className="grid h-full">
              <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-card p-6 shadow-[var(--shadow-soft)] transition-[box-shadow,transform,border-color] duration-300 ease-out hover:-translate-y-1 hover:border-border-strong/60 hover:shadow-[var(--shadow-card)]">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
                  <Icone size={20} aria-hidden="true" strokeWidth={1.75} />
                </span>
                <h3 className="text-lg font-semibold tracking-[-0.01em] text-foreground">
                  {titulo}
                </h3>
                <p className="text-[0.95rem] leading-7 text-muted">{texto}</p>
              </div>
            </RevelarAoRolar>
          ))}
          <RevelarAoRolar atraso={300} className="sm:col-span-3">
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
          </RevelarAoRolar>
        </div>
      </section>

      {/* NEWSLETTER — captura pública antes do rodapé (consentimento LGPD). */}
      <section aria-label="Newsletter ImobIA" className="border-t border-border bg-surface">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 py-20 sm:py-24 lg:grid-cols-[1.1fr_1fr]">
          <RevelarAoRolar className="flex flex-col gap-3">
            <span className="inline-flex items-center gap-2 text-[0.8rem] font-medium uppercase tracking-[0.14em] text-gold-strong">
              <span aria-hidden className="h-px w-6 bg-gold/60" />
              Newsletter ImobIA
            </span>
            <h2 className="font-serif text-3xl font-semibold tracking-[-0.02em] text-foreground sm:text-4xl">
              Receba as melhores oportunidades
            </h2>
            <p className="max-w-md text-base leading-7 text-muted">
              Uma curadoria de imóveis e novidades do mercado, direto no seu
              e-mail — sem spam, cancele quando quiser.
            </p>
          </RevelarAoRolar>
          <RevelarAoRolar atraso={150}>
            <div className="rounded-2xl border border-border bg-surface-card p-6 shadow-[var(--shadow-soft)] sm:p-8">
              <NewsletterCaptura />
            </div>
          </RevelarAoRolar>
        </div>
      </section>
    </div>
  );
}
