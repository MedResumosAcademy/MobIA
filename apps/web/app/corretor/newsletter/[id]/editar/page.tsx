// EDITAR uma edição da newsletter — só gestor/admin; edição ENVIADA é imutável
// (redireciona ao preview). Reusa o FormularioEdicao com os valores atuais.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { obterPerfil, obterSessao } from "@/lib/auth/sessao";
import { listarImoveisDaOrg } from "@/lib/dados/imoveis";
import { obterEdicao } from "@/lib/dados/newsletter";
import { FormularioEdicao, type ImovelSelecionavel } from "../../FormularioEdicao";

export const metadata: Metadata = { title: "Editar edição — Newsletter — ImobIA" };
export const dynamic = "force-dynamic";

export default async function PaginaEditarEdicao({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessao = await obterSessao();
  if (!sessao) {
    redirect("/entrar");
  }
  const perfil = await obterPerfil(sessao.usuarioId);
  const papel = perfil?.papel ?? "cliente";
  if (papel !== "gestor" && papel !== "admin") {
    redirect("/corretor?aviso=area-restrita-gestor");
  }

  const { id } = await params;
  const edicao = await obterEdicao(id);
  if (!edicao) {
    notFound();
  }
  if (edicao.status === "enviada") {
    redirect(`/corretor/newsletter/${id}`);
  }

  const imoveis: ImovelSelecionavel[] = (await listarImoveisDaOrg())
    .filter((i) => i.status === "disponivel" || edicao.imovelIds.includes(i.id))
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
          href={`/corretor/newsletter/${id}`}
          className="text-sm text-muted transition-colors hover:text-brand-strong"
        >
          ← Voltar ao preview
        </Link>

        <header className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-strong">
            Newsletter
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
            Editar edição
          </h1>
          <p className="mt-1 text-muted">
            Ajuste o conteúdo e os imóveis — o preview reflete na hora.
          </p>
        </header>

        <FormularioEdicao
          imoveis={imoveis}
          edicao={{
            id: edicao.id,
            titulo: edicao.titulo,
            assunto: edicao.assunto,
            introducao: edicao.introducao,
            imovelIds: edicao.imovelIds,
          }}
        />
      </main>
    </div>
  );
}
