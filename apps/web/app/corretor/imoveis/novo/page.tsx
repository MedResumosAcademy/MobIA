import type { Metadata } from "next";
import Link from "next/link";
import { criarImovelAction } from "../acoes";
import { FormularioImovel } from "../FormularioImovel";

export const metadata: Metadata = { title: "Novo imóvel — MobIA" };

const MENSAGENS_ERRO: Record<string, string> = {
  invalido: "Dados inválidos. Revise os campos e tente novamente.",
  upload: "Falha ao enviar as mídias. Verifique os arquivos e tente novamente.",
  permissao: "Você não tem permissão para cadastrar imóveis.",
};

export default async function PaginaNovoImovel({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const mensagemErro = erro ? (MENSAGENS_ERRO[erro] ?? MENSAGENS_ERRO.invalido) : null;

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-6 py-16 font-sans dark:bg-black">
      <main className="w-full max-w-3xl">
        <Link
          href="/corretor/imoveis"
          className="text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          ← Voltar
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Novo imóvel
        </h1>

        {mensagemErro && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          >
            {mensagemErro}
          </p>
        )}

        <div className="mt-8">
          <FormularioImovel action={criarImovelAction} />
        </div>
      </main>
    </div>
  );
}
