import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import { Search } from "lucide-react";
import { sair } from "@/lib/auth/acoes";
import { obterPerfil, obterSessao } from "@/lib/auth/sessao";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Fraunces — serifada display editorial (optical sizing variável) para
// títulos, wordmark e preços. Exposta como --font-serif (via globals.css @theme).
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MobIA",
  description: "O primeiro aplicativo que permite ao cliente montar sua própria compra.",
};

// Wordmark reutilizável — "Mob" grafite, "IA" laranja marca. SANS (Geist) por
// padrão para um traço limpo e moderno (estilo portal/Airbnb).
function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-semibold tracking-tight ${className}`}>
      Mob<span className="text-brand">IA</span>
    </span>
  );
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const sessao = await obterSessao();
  // "Favoritos" é feature de cliente. Perfil ausente ⇒ tratado como cliente
  // (mesma degradação de obterPerfil). Corretor/gestor não veem o link.
  const perfil = sessao ? await obterPerfil(sessao.usuarioId) : null;
  const ehCliente = sessao !== null && (perfil === null || perfil.papel === "cliente");

  const linkNav =
    "rounded-full px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-foreground";
  const linkRodape =
    "text-sm text-muted transition-colors hover:text-foreground";

  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <header className="header-sticky sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
            <div className="flex items-center gap-8">
              <Link
                href="/"
                className="text-2xl text-foreground"
                aria-label="MobIA — página inicial"
              >
                <Wordmark />
              </Link>
              <nav
                className="hidden items-center gap-1 md:flex"
                aria-label="Navegação principal"
              >
                <Link href="/imoveis" className={linkNav}>
                  Comprar
                </Link>
                <Link href="/sonhometro" className={linkNav}>
                  Sonhômetro
                </Link>
                {ehCliente && (
                  <Link href="/favoritos" className={linkNav}>
                    Favoritos
                  </Link>
                )}
              </nav>
            </div>

            {/* Busca clean estilo portal — atalho para o catálogo (some no mobile). */}
            <Link
              href="/imoveis"
              className="group hidden max-w-xs flex-1 items-center gap-2 rounded-full border border-border bg-surface-card px-4 py-2 text-sm text-subtle shadow-[var(--shadow-soft)] transition-colors hover:border-border-strong lg:flex"
            >
              <Search size={16} strokeWidth={2} className="text-brand" aria-hidden="true" />
              <span className="truncate">Buscar imóveis por cidade, bairro…</span>
            </Link>

            {sessao ? (
              <div className="flex items-center gap-2 sm:gap-3">
                {ehCliente && (
                  <Link href="/conta" className={`hidden sm:inline ${linkNav}`}>
                    Minha conta
                  </Link>
                )}
                <span className="hidden max-w-[16ch] truncate text-sm text-subtle lg:inline">
                  {sessao.email}
                </span>
                <form action={sair}>
                  <button
                    type="submit"
                    className="rounded-full border border-border-strong bg-surface-card px-4 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-surface"
                  >
                    Sair
                  </button>
                </form>
              </div>
            ) : (
              <Link
                href="/entrar"
                className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-brand-contrast shadow-[var(--shadow-soft)] transition-colors hover:bg-brand-hover"
              >
                Entrar
              </Link>
            )}
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-border bg-surface">
          {/* Filete dourado editorial no topo do rodapé */}
          <div className="h-px w-full bg-gold/60" aria-hidden="true" />
          <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
            <div className="max-w-sm">
              <p className="text-xl font-semibold text-foreground">
                <Wordmark />
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                O primeiro portal que deixa você montar a compra do seu jeito —
                simule, compare e realize o sonho da casa própria com sofisticação.
              </p>
            </div>

            <nav aria-label="Explorar" className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-subtle">
                Explorar
              </p>
              <Link href="/imoveis" className={linkRodape}>
                Comprar
              </Link>
              <Link href="/sonhometro" className={linkRodape}>
                Sonhômetro
              </Link>
              {ehCliente && (
                <Link href="/favoritos" className={linkRodape}>
                  Favoritos
                </Link>
              )}
            </nav>

            <nav aria-label="Conta" className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-subtle">
                Conta
              </p>
              {sessao ? (
                ehCliente && (
                  <Link href="/conta" className={linkRodape}>
                    Minha conta
                  </Link>
                )
              ) : (
                <Link href="/entrar" className={linkRodape}>
                  Entrar
                </Link>
              )}
            </nav>
          </div>
          <div className="border-t border-border">
            <p className="mx-auto w-full max-w-7xl px-4 py-5 text-xs text-subtle sm:px-6">
              © {new Date().getFullYear()} MobIA. Todos os direitos reservados.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
