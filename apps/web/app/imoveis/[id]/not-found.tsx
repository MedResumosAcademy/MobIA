import Link from "next/link";

export default function ImovelNaoEncontrado() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-20 font-sans">
      <main className="flex max-w-md flex-col items-center gap-4 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-subtle">
          Erro 404
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Imóvel não encontrado
        </h1>
        <p className="text-muted">
          Este imóvel não existe, foi removido ou não está mais disponível.
        </p>
        <Link
          href="/imoveis"
          className="mt-2 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-brand-contrast transition-colors hover:bg-brand-hover"
        >
          Ver catálogo de imóveis
        </Link>
      </main>
    </div>
  );
}
