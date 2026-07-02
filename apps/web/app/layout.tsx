import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: "MobIA",
  description: "O primeiro aplicativo que permite ao cliente montar sua própria compra.",
};

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
    "text-sm font-medium text-muted transition-colors hover:text-foreground";

  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-surface-muted text-foreground">
        <header className="header-sticky sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
            <div className="flex items-center gap-6">
              <Link
                href="/"
                className="text-xl font-bold tracking-tight text-foreground"
                aria-label="MobIA — página inicial"
              >
                Mob<span className="text-brand">IA</span>
              </Link>
              <nav className="hidden items-center gap-6 md:flex" aria-label="Navegação principal">
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

            {sessao ? (
              <div className="flex items-center gap-3 sm:gap-4">
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
                    className="rounded-lg border border-border-strong px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
                  >
                    Sair
                  </button>
                </form>
              </div>
            ) : (
              <Link
                href="/entrar"
                className="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-brand-contrast transition-colors hover:bg-brand-hover"
              >
                Entrar
              </Link>
            )}
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-border bg-surface">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
            <div className="max-w-sm">
              <p className="text-lg font-bold tracking-tight text-foreground">
                Mob<span className="text-brand">IA</span>
              </p>
              <p className="mt-2 text-sm text-muted">
                O primeiro portal que deixa você montar a compra do seu jeito — simule,
                compare e realize o sonho da casa própria.
              </p>
            </div>
            <nav aria-label="Rodapé" className="flex flex-wrap gap-x-8 gap-y-2">
              <Link href="/imoveis" className={linkNav}>
                Comprar
              </Link>
              <Link href="/sonhometro" className={linkNav}>
                Sonhômetro
              </Link>
              <Link href="/entrar" className={linkNav}>
                Entrar
              </Link>
            </nav>
          </div>
          <div className="border-t border-border">
            <p className="mx-auto w-full max-w-7xl px-4 py-4 text-xs text-subtle sm:px-6">
              © {new Date().getFullYear()} MobIA. Todos os direitos reservados.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
