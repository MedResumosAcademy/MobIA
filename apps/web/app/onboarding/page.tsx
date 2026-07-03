// ONBOARDING DO CORRETOR (rota /onboarding — fora de /corretor de propósito:
// o gate do layout /corretor redireciona PARA cá, então a rota não pode viver
// lá dentro, senão loop). Server Component fino: protege a rota (anônimo ⇒
// /entrar; papel não-corretor ⇒ /; onboarding já concluído ⇒ /corretor),
// carrega os dados atuais (nome do perfil, email da sessão, creci do convite)
// e delega tudo ao <WizardOnboarding> (client).

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { obterPerfil, obterSessao } from "@/lib/auth/sessao";
import { dadosIniciaisOnboarding, statusOnboarding } from "@/lib/dados/onboarding";
import { WizardOnboarding } from "./WizardOnboarding";

export const metadata: Metadata = {
  title: "Boas-vindas à ImobIA",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function PaginaOnboarding() {
  const sessao = await obterSessao();
  if (!sessao) {
    redirect("/entrar");
  }

  const perfil = await obterPerfil(sessao.usuarioId);
  if ((perfil?.papel ?? "cliente") !== "corretor") {
    redirect("/");
  }

  const { pendente } = await statusOnboarding();
  if (!pendente) {
    redirect("/corretor");
  }

  const iniciais = await dadosIniciaisOnboarding();

  return (
    <div className="flex flex-1 flex-col items-center bg-background px-6 py-12 font-sans sm:py-16">
      <WizardOnboarding
        nomeInicial={iniciais?.nome ?? ""}
        email={sessao.email ?? ""}
        creciInicial={iniciais?.creci ?? ""}
      />
    </div>
  );
}
