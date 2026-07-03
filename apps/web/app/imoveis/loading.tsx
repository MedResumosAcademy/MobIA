// LOADING do segmento /imoveis — skeleton apresentacional (Server Component,
// sem dados) exibido pelo Next enquanto o catálogo force-dynamic busca no
// Supabase. Imita a grade de CardImovel (foto + título + preço).

export default function CarregandoImoveis() {
  return (
    <div
      className="flex flex-1 flex-col items-center bg-background px-6 py-16 font-sans"
      aria-busy="true"
      aria-label="Carregando"
    >
      <main className="w-full max-w-6xl animate-pulse">
        {/* Cabeçalho + filtros */}
        <div className="h-8 w-72 rounded-xl bg-surface" />
        <div className="mt-3 h-4 w-48 rounded-full bg-surface" />
        <div className="mt-6 flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-9 w-28 rounded-full bg-surface" />
          ))}
        </div>

        {/* Grade de cards no padrão dos CardImovel */}
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-2xl border border-border bg-surface-card"
            >
              <div className="aspect-[4/3] w-full bg-surface" />
              <div className="flex flex-col gap-2.5 p-4">
                <div className="h-4 w-3/4 rounded-full bg-surface" />
                <div className="h-3.5 w-1/2 rounded-full bg-surface" />
                <div className="h-5 w-2/5 rounded-full bg-surface" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
