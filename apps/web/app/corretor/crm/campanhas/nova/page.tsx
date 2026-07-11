// NOVA CAMPANHA (gestor/admin — mesmo gate das áreas de gestão). As tags
// disponíveis para segmentar vêm dos contatos visíveis (listarContatos).

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { obterPerfil, obterSessao } from "@/lib/auth/sessao";
import { listarContatos } from "@/lib/dados/contatos";
import { FormularioCampanha } from "../FormularioCampanha";

export const metadata: Metadata = { title: "Nova campanha" };
export const dynamic = "force-dynamic";

export default async function PaginaNovaCampanha() {
  const sessao = await obterSessao();
  if (!sessao) {
    redirect("/entrar");
  }
  const perfil = await obterPerfil(sessao.usuarioId);
  const papel = perfil?.papel ?? "cliente";
  if (papel !== "gestor" && papel !== "admin") {
    redirect("/corretor?aviso=area-restrita-gestor");
  }

  const contatos = await listarContatos();
  const tagsDisponiveis = [...new Set(contatos.flatMap((c) => c.tags))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link
        href="/corretor/crm/campanhas"
        className="text-sm text-muted transition-colors hover:text-brand-strong"
      >
        ← Voltar às campanhas
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
        Nova campanha
      </h1>
      <p className="mt-1 text-muted">
        Segmente os contatos consentidos, preveja o alcance e salve o rascunho —
        o disparo é sempre por template aprovado na Meta.
      </p>
      <FormularioCampanha tagsDisponiveis={tagsDisponiveis} />
    </div>
  );
}
