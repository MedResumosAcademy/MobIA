// PERFIL DO PRÓPRIO CORRETOR (rota /corretor/perfil, protegida). Server Component:
// resolve o perfil da SESSÃO via obterPerfilCorretor() (sem arg) e delega a
// apresentação à VitrinePerfil. Sessão anônima é redirecionada ao login; quem
// não tem vitrine (papel não operacional / sem dados) volta ao painel.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { obterSessao } from "@/lib/auth/sessao";
import { desempenhoCarteira } from "@/lib/dados/carteira";
import { obterPerfilCorretor } from "@/lib/dados/perfil";
import { VitrinePerfil } from "./VitrinePerfil";

export const metadata: Metadata = { title: "Meu perfil" };
export const dynamic = "force-dynamic";

export default async function PaginaMeuPerfil({
  searchParams,
}: {
  searchParams: Promise<{ visao?: string }>;
}) {
  const sessao = await obterSessao();
  if (!sessao) {
    redirect("/entrar");
  }

  const perfil = await obterPerfilCorretor();
  if (!perfil) {
    redirect("/corretor?aviso=perfil-indisponivel");
  }

  // ?visao=publica ⇒ o dono vê a própria vitrine como um colega a vê.
  const { visao } = await searchParams;
  const visaoPublica = visao === "publica";

  // Carteira é ferramenta de gestão do dono — não aparece na visão pública.
  const carteira = visaoPublica
    ? null
    : await desempenhoCarteira(perfil.corretorId);

  return (
    <div className="flex flex-1 flex-col items-center bg-background px-6 py-16 font-sans">
      <main className="w-full max-w-5xl">
        <VitrinePerfil
          perfil={perfil}
          visaoPublica={visaoPublica}
          carteira={carteira}
        />
      </main>
    </div>
  );
}
