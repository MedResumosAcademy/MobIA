import { redirect } from "next/navigation";
import { obterPerfil, obterSessao } from "@/lib/auth/sessao";

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

  return children;
}
