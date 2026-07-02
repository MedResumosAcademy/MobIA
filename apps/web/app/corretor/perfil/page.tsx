// PERFIL DO PRÓPRIO CORRETOR (rota /corretor/perfil, protegida). Server Component:
// resolve o perfil da SESSÃO via obterPerfilCorretor() (sem arg) e delega a
// apresentação à VitrinePerfil. Sessão anônima é redirecionada ao login; quem
// não tem vitrine (papel não operacional / sem dados) volta ao painel.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { obterSessao } from "@/lib/auth/sessao";
import { obterPerfilCorretor } from "@/lib/dados/perfil";
import { VitrinePerfil } from "./VitrinePerfil";

export const metadata: Metadata = { title: "Meu perfil — ImobIA" };
export const dynamic = "force-dynamic";

export default async function PaginaMeuPerfil() {
  const sessao = await obterSessao();
  if (!sessao) {
    redirect("/entrar");
  }

  const perfil = await obterPerfilCorretor();
  if (!perfil) {
    redirect("/corretor?aviso=perfil-indisponivel");
  }

  return (
    <div className="flex flex-1 flex-col items-center bg-background px-6 py-16 font-sans">
      <main className="w-full max-w-5xl">
        <VitrinePerfil perfil={perfil} />
      </main>
    </div>
  );
}
