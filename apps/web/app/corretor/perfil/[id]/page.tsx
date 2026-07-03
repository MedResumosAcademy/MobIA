// PERFIL DE UM COLEGA DA ORG (rota /corretor/perfil/[id], protegida). Server
// Component: resolve o perfil-alvo via obterPerfilCorretor(id). A RLS multi-tenant
// (0015) limita a visibilidade — alvo fora da org / inexistente ⇒ null ⇒ notFound.
// Sessão anônima é redirecionada ao login. Se o id for o próprio usuário, a
// VitrinePerfil ainda exibe as ações do dono (ehProprio vem do data layer).

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { obterPerfil, obterSessao } from "@/lib/auth/sessao";
import { desempenhoCarteira } from "@/lib/dados/carteira";
import { obterPerfilCorretor } from "@/lib/dados/perfil";
import { VitrinePerfil } from "../VitrinePerfil";

export const metadata: Metadata = { title: "Perfil do corretor — ImobIA" };
export const dynamic = "force-dynamic";

export default async function PaginaPerfilCorretor({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessao = await obterSessao();
  if (!sessao) {
    redirect("/entrar");
  }

  const { id } = await params;
  const perfil = await obterPerfilCorretor(id);
  if (!perfil) {
    notFound();
  }

  // Carteira é ferramenta de gestão: só o próprio corretor ou gestor/admin
  // da org enxergam os números de desempenho do colega.
  const perfilViewer = await obterPerfil(sessao.usuarioId);
  const podeVerCarteira =
    perfil.ehProprio ||
    perfilViewer?.papel === "gestor" ||
    perfilViewer?.papel === "admin";
  const carteira = podeVerCarteira
    ? await desempenhoCarteira(perfil.corretorId)
    : null;

  return (
    <div className="flex flex-1 flex-col items-center bg-background px-6 py-16 font-sans">
      <main className="w-full max-w-5xl">
        <VitrinePerfil perfil={perfil} carteira={carteira} />
      </main>
    </div>
  );
}
