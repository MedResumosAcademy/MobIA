// LOADING do segmento /corretor — skeleton apresentacional (Server Component,
// sem dados) exibido pelo Next durante a navegação enquanto as páginas
// force-dynamic buscam no Supabase. Imita a grade do painel (cabeçalho + KPIs).

export default function CarregandoCorretor() {
  return (
    <div
      className="flex flex-1 flex-col items-center bg-background px-6 py-16 font-sans"
      aria-busy="true"
      aria-label="Carregando"
    >
      <main className="w-full max-w-5xl animate-pulse">
        {/* Cabeçalho */}
        <div className="h-3 w-24 rounded-full bg-surface" />
        <div className="mt-3 h-8 w-64 rounded-xl bg-surface" />
        <div className="mt-3 h-4 w-40 rounded-full bg-surface" />

        {/* Grade de cards no padrão dos CardKpi */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-32 rounded-2xl border border-border bg-surface-card"
            />
          ))}
        </div>

        {/* Blocos maiores (funil / listas) */}
        <div className="mt-8 h-56 rounded-2xl border border-border bg-surface-card" />
        <div className="mt-6 h-40 rounded-2xl border border-border bg-surface-card" />
      </main>
    </div>
  );
}
