// NOVA EDIÇÃO da newsletter — só gestor/admin (mesmo gate da central).
// Server Component: carrega os imóveis DISPONÍVEIS da PRÓPRIA org para o
// seletor (listarImoveisDaOrg filtra por org_id explicitamente) e delega o
// formulário ao client component FormularioEdicao.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { obterPerfil, obterSessao } from "@/lib/auth/sessao";
import { listarImoveisDaOrg } from "@/lib/dados/imoveis";
import { FormularioEdicao, type ImovelSelecionavel } from "../FormularioEdicao";

export const metadata: Metadata = { title: "Nova edição — Newsletter — ImobIA" };
export const dynamic = "force-dynamic";

export default async function PaginaNovaEdicao() {
  const sessao = await obterSessao();
  if (!sessao) {
    redirect("/entrar");
  }
  const perfil = await obterPerfil(sessao.usuarioId);
  const papel = perfil?.papel ?? "cliente";
  if (papel !== "gestor" && papel !== "admin") {
    redirect("/corretor?aviso=area-restrita-gestor");
  }

  const imoveis: ImovelSelecionavel[] = (await listarImoveisDaOrg())
    .filter((i) => i.status === "disponivel")
    .map((i) => ({
      id: i.id,
      titulo: i.titulo,
      cidade: i.cidade,
      uf: i.uf,
      valor: i.valor,
      fotoCapa: i.fotos[0] ?? null,
    }));

  return (
    <div className="flex flex-1 flex-col items-center bg-background px-6 py-16 font-sans">
      <main className="w-full max-w-3xl">
        <Link
          href="/corretor/newsletter"
          className="text-sm text-muted transition-colors hover:text-brand-strong"
        >
          ← Voltar à newsletter
        </Link>

        <header className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-strong">
            Newsletter
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
            Nova edição
          </h1>
          <p className="mt-1 text-muted">
            Monte a edição e salve como rascunho — o envio é um passo separado.
          </p>
        </header>

        <FormularioEdicao imoveis={imoveis} />
      </main>
    </div>
  );
}
