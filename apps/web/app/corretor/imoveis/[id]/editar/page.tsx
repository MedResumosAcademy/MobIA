import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  listarImoveisDaOrg,
  type ImovelDetalhe,
  type Unidade,
} from "@/lib/dados/imoveis";
import { statusImovelSchema } from "@imobia/domain";
import { criarClienteServidor } from "@/lib/supabase/server";
import { atualizarImovelAction } from "../../acoes";
import { FormularioImovel } from "../../FormularioImovel";
import { Unidades } from "../../Unidades";

export const metadata: Metadata = { title: "Editar imóvel" };
export const dynamic = "force-dynamic";

const MENSAGENS_ERRO: Record<string, string> = {
  invalido: "Dados inválidos. Revise os campos e tente novamente.",
  upload: "Falha ao enviar as mídias. Verifique os arquivos e tente novamente.",
  permissao: "Você não tem permissão para editar este imóvel.",
};

// Carrega as unidades do imóvel pela sessão (RLS org-scoped). O corretor precisa
// enxergar unidades de imóveis reservados/vendidos, então usa o cliente servidor.
async function carregarUnidades(imovelId: string): Promise<Unidade[]> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("unidades")
    .select("*")
    .eq("imovel_id", imovelId)
    .order("identificador", { ascending: true });
  return (data ?? []).map((u) => ({
    id: u.id,
    imovelId: u.imovel_id,
    identificador: u.identificador,
    andar: u.andar,
    posicao: u.posicao,
    valor: u.valor,
    status: statusImovelSchema.safeParse(u.status).success
      ? (u.status as Unidade["status"])
      : "disponivel",
  }));
}

export default async function PaginaEditarImovel({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { id } = await params;
  const { erro } = await searchParams;
  const mensagemErro = erro ? (MENSAGENS_ERRO[erro] ?? MENSAGENS_ERRO.invalido) : null;

  const imoveis = await listarImoveisDaOrg();
  const imovel: ImovelDetalhe | undefined = imoveis.find((i) => i.id === id);
  if (!imovel) {
    notFound();
  }

  const unidades = await carregarUnidades(id);
  const atualizar = atualizarImovelAction.bind(null, id);

  return (
    <div className="flex flex-1 flex-col items-center bg-background px-6 py-16 font-sans">
      <main className="w-full max-w-3xl">
        <Link
          href="/corretor/imoveis"
          className="text-sm text-muted transition-colors hover:text-brand-strong"
        >
          ← Voltar
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
          {imovel.titulo}
        </h1>

        {mensagemErro && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800"
          >
            {mensagemErro}
          </p>
        )}

        <div className="mt-8">
          <FormularioImovel action={atualizar} imovel={imovel} />
        </div>

        <Unidades imovelId={id} unidades={unidades} />
      </main>
    </div>
  );
}
