import Link from "next/link";

export default function ImovelNaoEncontrado() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-20 font-sans dark:bg-black">
      <main className="flex max-w-md flex-col items-center gap-4 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Erro 404
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Imóvel não encontrado
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Este imóvel não existe, foi removido ou não está mais disponível.
        </p>
        <Link
          href="/imoveis"
          className="mt-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Ver catálogo de imóveis
        </Link>
      </main>
    </div>
  );
}
