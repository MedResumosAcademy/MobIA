import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { obterPerfil, obterSessao } from "@/lib/auth/sessao";
import { statusOnboarding } from "@/lib/dados/onboarding";

// Área autenticada: noindex para toda a subárvore /corretor/* (o metadata de
// layout faz merge com o dos pages filhos sem sobrescrever os titles).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function LayoutCorretor({ children }: { children: React.ReactNode }) {
  const sessao = await obterSessao();
  if (!sessao) {
    redirect("/entrar");
  }

  // Perfil ausente (ou tabela ainda inexistente) ⇒ papel 'cliente' ⇒ sem acesso.
  const perfil = await obterPerfil(sessao.usuarioId);
  const papel = perfil?.papel ?? "cliente";
  if (papel !== "corretor" && papel !== "gestor" && papel !== "admin") {
    redirect("/");
  }

  // Corretor sem onboarding concluído ⇒ wizard (/onboarding vive FORA de
  // /corretor, então não há loop de redirect).
  const { pendente } = await statusOnboarding();
  if (pendente) {
    redirect("/onboarding");
  }

  return children;
}
