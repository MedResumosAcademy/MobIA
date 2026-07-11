import type { Metadata } from "next";
import Link from "next/link";
import { criarImovelAction } from "../acoes";
import { FormularioImovel } from "../FormularioImovel";

export const metadata: Metadata = { title: "Novo imóvel" };

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
    <div className="flex flex-1 flex-col items-center bg-background px-6 py-16 font-sans">
      <main className="w-full max-w-3xl">
        <Link
          href="/corretor/imoveis"
          className="text-sm text-muted transition-colors hover:text-brand-strong"
        >
          ← Voltar
        </Link>
        <header className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-strong">
            Minha carteira
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
            Novo imóvel
          </h1>
        </header>

        {mensagemErro && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800"
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
