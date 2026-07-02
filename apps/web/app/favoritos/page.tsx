// Rota /favoritos (E6 / H-19). Server Component: exige cliente logado (senão
// CTA para /entrar). Lista os imóveis favoritados como cards com coração já
// marcado e permite selecionar 2–3 para comparar (/comparar).

import type { Metadata } from "next";
import Link from "next/link";
import { BannerConsentimento } from "@/components/BannerConsentimento";
import { FavoritosLista } from "@/components/FavoritosLista";
import { classesBotao } from "@/components/ui/Botao";
import { obterSessao } from "@/lib/auth/sessao";
import { obterConsentimento } from "@/lib/dados/consentimento";
import { listarFavoritos } from "@/lib/dados/favoritos";

export const metadata: Metadata = { title: "Favoritos — MobIA" };

// Depende da sessão/RLS a cada request.
export const dynamic = "force-dynamic";

export default async function PaginaFavoritos() {
  const sessao = await obterSessao();

  return (
    <div className="flex flex-1 flex-col bg-background px-6 py-12 font-sans">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground">
            Meus favoritos
          </h1>
          <p className="text-base leading-relaxed text-muted">
            Os imóveis que você salvou para decidir com calma.
          </p>
        </header>

        {!sessao ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-strong bg-surface-card px-6 py-20 text-center shadow-soft">
            <p className="text-lg font-semibold text-foreground">
              Entre para ver seus favoritos
            </p>
            <p className="max-w-md text-sm text-muted">
              Faça login para salvar imóveis e compará-los quando quiser.
            </p>
            <Link href="/entrar" className={classesBotao("primario", "md", "mt-2")}>
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
  const [imoveis, consentimento] = await Promise.all([
    listarFavoritos(),
    obterConsentimento(),
  ]);

  // Banner discreto de intenção (LGPD): só para quem ainda não decidiu.
  const bannerConsentimento = consentimento === null ? <BannerConsentimento /> : null;

  if (imoveis.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-strong bg-surface-card px-6 py-20 text-center shadow-soft">
        <p className="text-lg font-semibold text-foreground">
          Você ainda não favoritou nenhum imóvel
        </p>
        <p className="max-w-md text-sm text-muted">
          Toque no coração de um imóvel para guardá-lo aqui.
        </p>
        <Link href="/imoveis" className={classesBotao("primario", "md", "mt-2")}>
          Ver catálogo
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {bannerConsentimento}
      <FavoritosLista imoveis={imoveis} />
    </div>
  );
}
