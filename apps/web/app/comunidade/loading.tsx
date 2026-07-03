// LOADING do segmento /comunidade — skeleton apresentacional (Server Component,
// sem dados) exibido pelo Next enquanto o feed force-dynamic busca no Supabase.
// Imita a coluna de posts do feed.

export default function CarregandoComunidade() {
  return (
    <div
      className="flex flex-1 flex-col items-center bg-background px-6 py-16 font-sans"
      aria-busy="true"
      aria-label="Carregando"
    >
      <main className="w-full max-w-2xl animate-pulse">
        {/* Cabeçalho */}
        <div className="h-3 w-28 rounded-full bg-surface" />
        <div className="mt-3 h-8 w-56 rounded-xl bg-surface" />

        {/* Composer */}
        <div className="mt-8 h-28 rounded-2xl border border-border bg-surface-card" />

        {/* Posts */}
        <div className="mt-6 flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-border bg-surface-card p-5"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-surface" />
                <div className="flex flex-col gap-2">
                  <div className="h-3.5 w-32 rounded-full bg-surface" />
                  <div className="h-3 w-20 rounded-full bg-surface" />
                </div>
              </div>
              <div className="mt-4 h-3.5 w-full rounded-full bg-surface" />
              <div className="mt-2 h-3.5 w-3/4 rounded-full bg-surface" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
