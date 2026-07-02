import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { sair } from "@/lib/auth/acoes";
import { obterSessao } from "@/lib/auth/sessao";
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

  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 font-sans dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50"
            >
              MobIA
            </Link>
            <Link
              href="/imoveis"
              className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              Ver catálogo
            </Link>
          </div>
          {sessao ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">{sessao.email}</span>
              <form action={sair}>
                <button
                  type="submit"
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  Sair
                </button>
              </form>
            </div>
          ) : (
            <Link
              href="/entrar"
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Entrar
            </Link>
          )}
        </header>
        {children}
      </body>
    </html>
  );
}
