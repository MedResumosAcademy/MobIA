// Localização da ficha (H-10). Endereço + mapa. Sem chave de API: usa embed
// estático do OpenStreetMap (iframe) quando há lat/lng; caso contrário mostra
// só o endereço + link para o Google Maps a partir de cidade/uf.

type Props = {
  endereco: string | null;
  cidade: string;
  uf: string;
  lat: number | null;
  lng: number | null;
};

export function FichaLocalizacao({ endereco, cidade, uf, lat, lng }: Props) {
  const enderecoLegivel = endereco ?? `${cidade}/${uf}`;
  const consultaMaps = encodeURIComponent(endereco ?? `${cidade}, ${uf}, Brasil`);

  const temCoords = lat !== null && lng !== null;
  // Bounding box pequena ao redor do ponto para o embed do OSM.
  const delta = 0.01;
  const bbox = temCoords
    ? `${(lng! - delta).toFixed(5)},${(lat! - delta).toFixed(5)},${(lng! + delta).toFixed(5)},${(lat! + delta).toFixed(5)}`
    : null;
  const osmEmbed = temCoords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`
    : null;
  const linkMaps = temCoords
    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    : `https://www.google.com/maps/search/?api=1&query=${consultaMaps}`;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-zinc-700 dark:text-zinc-300">{enderecoLegivel}</p>
      {osmEmbed ? (
        <iframe
          title={`Mapa — ${enderecoLegivel}`}
          src={osmEmbed}
          loading="lazy"
          className="aspect-[16/9] w-full rounded-2xl border border-zinc-200 dark:border-zinc-800"
        />
      ) : (
        <div className="flex aspect-[16/9] w-full items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 text-sm text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900">
          Localização aproximada — {cidade}/{uf}
        </div>
      )}
      <a
        href={linkMaps}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-fit items-center gap-1 text-sm font-medium text-sky-700 hover:underline dark:text-sky-400"
      >
        Abrir no Google Maps →
      </a>
    </div>
  );
}
