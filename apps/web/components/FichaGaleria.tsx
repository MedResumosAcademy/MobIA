// Galeria de fotos da ficha (H-10). Server Component sem JS: capa grande +
// miniaturas em grid. Sem fotos → placeholder discreto.

/* eslint-disable @next/next/no-img-element */

export function FichaGaleria({ fotos, titulo }: { fotos: string[]; titulo: string }) {
  if (fotos.length === 0) {
    return (
      <div className="flex aspect-[16/10] w-full items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 text-sm text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900">
        Sem fotos disponíveis
      </div>
    );
  }

  const [capa, ...resto] = fotos;

  return (
    <div className="flex flex-col gap-3">
      <img
        src={capa}
        alt={`Foto principal — ${titulo}`}
        className="aspect-[16/10] w-full rounded-2xl object-cover"
      />
      {resto.length > 0 && (
        <ul className="grid grid-cols-4 gap-3 sm:grid-cols-6">
          {resto.map((url, i) => (
            <li key={url}>
              <img
                src={url}
                alt={`Foto ${i + 2} — ${titulo}`}
                className="aspect-square w-full rounded-xl object-cover"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
