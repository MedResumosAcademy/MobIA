// Rota /favoritos (E6 / H-19). Server Component: exige cliente logado (senão
// CTA para /entrar). Lista os imóveis favoritados como cards com coração já
// marcado e permite selecionar 2–3 para comparar (/comparar).

import type { Metadata } from "next";
import Link from "next/link";
import { FavoritosLista } from "@/components/FavoritosLista";
import { obterSessao } from "@/lib/auth/sessao";
import { listarFavoritos } from "@/lib/dados/favoritos";

export const metadata: Metadata = { title: "Favoritos — MobIA" };

// Depende da sessão/RLS a cada request.
export const dynamic = "force-dynamic";

export default async function PaginaFavoritos() {
  const sessao = await obterSessao();

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 px-6 py-10 font-sans dark:bg-black">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Meus favoritos
          </h1>
          <p className="text-base text-zinc-600 dark:text-zinc-400">
            Os imóveis que você salvou para decidir com calma.
          </p>
        </header>

        {!sessao ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-20 text-center dark:border-zinc-700 dark:bg-zinc-950">
            <p className="text-lg font-medium text-zinc-700 dark:text-zinc-300">
              Entre para ver seus favoritos
            </p>
            <p className="max-w-md text-sm text-zinc-500 dark:text-zinc-400">
              Faça login para salvar imóveis e compará-los quando quiser.
            </p>
            <Link
              href="/entrar"
              className="mt-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Entrar
            </Link>
          </div>
        ) : (
          <FavoritosConteudo />
        )}
      </main>
    </div>
  );
}

async function FavoritosConteudo() {
  const imoveis = await listarFavoritos();

  if (imoveis.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-20 text-center dark:border-zinc-700 dark:bg-zinc-950">
        <p className="text-lg font-medium text-zinc-700 dark:text-zinc-300">
          Você ainda não favoritou nenhum imóvel
        </p>
        <p className="max-w-md text-sm text-zinc-500 dark:text-zinc-400">
          Toque no coração de um imóvel para guardá-lo aqui.
        </p>
        <Link
          href="/imoveis"
          className="mt-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Ver catálogo
        </Link>
      </div>
    );
  }

  return <FavoritosLista imoveis={imoveis} />;
}
