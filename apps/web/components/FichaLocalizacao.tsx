// Localização da ficha (H-10). Endereço + mapa. Sem chave de API: usa embed
// estático do OpenStreetMap (iframe) quando há lat/lng; caso contrário mostra
// só o endereço + link para o Google Maps a partir de cidade/uf.
// Visual alinhado à paleta quente (tokens): sem cores cruas do Tailwind.

import { MapPin } from "lucide-react";

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
    <div className="flex flex-col gap-4">
      <p className="flex items-start gap-2 text-base text-muted">
        <MapPin
          size={18}
          className="mt-0.5 shrink-0 text-gold"
          strokeWidth={1.8}
          aria-hidden="true"
        />
        <span>{enderecoLegivel}</span>
      </p>
      {osmEmbed ? (
        <iframe
          title={`Mapa — ${enderecoLegivel}`}
          src={osmEmbed}
          loading="lazy"
          className="aspect-[16/9] w-full rounded-2xl border border-border bg-surface-card shadow-[var(--shadow-soft)]"
        />
      ) : (
        <div className="flex aspect-[16/9] w-full items-center justify-center rounded-2xl border border-dashed border-border-strong bg-surface text-sm text-subtle">
          Localização aproximada — {cidade}/{uf}
        </div>
      )}
      <a
        href={linkMaps}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-fit items-center gap-1.5 rounded text-sm font-medium text-brand-strong transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-muted"
      >
        Abrir no Google Maps
        <span aria-hidden="true">→</span>
      </a>
    </div>
  );
}
