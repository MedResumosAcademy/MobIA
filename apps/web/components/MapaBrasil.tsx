"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { geoMercator, geoPath, type GeoPermissibleObjects } from "d3-geo";

/**
 * Choropleth do Brasil por UF.
 *
 * Fonte do GeoJSON: /geo/br-uf.json
 *   (codeforamerica/click_that_hood — brazil-states.geojson)
 * Chave da sigla nas properties: "sigla" (2 letras).
 */

export type DadoUf = { uf: string; quantidade: number };

type MapaBrasilProps = {
  dados: DadoUf[];
  /** Constrói o href de cada UF. Padrão: /imoveis?uf=SIGLA */
  hrefUf?: (uf: string) => string;
  largura?: number;
  altura?: number;
};

type FeatureUf = {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: GeoPermissibleObjects;
};

type ColecaoUf = {
  type: "FeatureCollection";
  features: FeatureUf[];
};

// Paleta QUENTE: de areia forte (--surface-strong) até laranja (--brand).
const COR_MIN = { r: 0xf0, g: 0xeb, b: 0xe3 }; // #f0ebe3
const COR_MAX = { r: 0xdb, g: 0x64, b: 0x14 }; // #db6414
const COR_ZERO = "#eae6df"; // --border (UF sem imóvel)

function corEscala(t: number): string {
  const c = Math.max(0, Math.min(1, t));
  const r = Math.round(COR_MIN.r + (COR_MAX.r - COR_MIN.r) * c);
  const g = Math.round(COR_MIN.g + (COR_MAX.g - COR_MIN.g) * c);
  const b = Math.round(COR_MIN.b + (COR_MAX.b - COR_MIN.b) * c);
  return `rgb(${r} ${g} ${b})`;
}

/** Descobre a sigla da UF nas properties, tolerante a variações de chave. */
function extrairSigla(props: Record<string, unknown>): string | null {
  const candidatas = ["sigla", "SIGLA", "uf", "UF", "SIGLA_UF", "abbrev", "id"];
  for (const chave of candidatas) {
    const valor = props[chave];
    if (typeof valor === "string" && /^[A-Za-z]{2}$/.test(valor.trim())) {
      return valor.trim().toUpperCase();
    }
  }
  return null;
}

export default function MapaBrasil({
  dados,
  hrefUf = (uf) => `/imoveis?uf=${uf}`,
  largura = 640,
  altura = 640,
}: MapaBrasilProps) {
  const router = useRouter();
  const [geo, setGeo] = useState<ColecaoUf | null>(null);
  const [erro, setErro] = useState(false);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    fetch("/geo/br-uf.json")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: ColecaoUf) => {
        if (!ativo) return;
        if (!json?.features?.length) throw new Error("GeoJSON vazio");
        setGeo(json);
      })
      .catch(() => {
        if (ativo) setErro(true);
      });
    return () => {
      ativo = false;
    };
  }, []);

  const mapaQuantidade = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of dados) {
      if (d?.uf) m.set(d.uf.trim().toUpperCase(), d.quantidade ?? 0);
    }
    return m;
  }, [dados]);

  const maxQuantidade = useMemo(() => {
    let max = 0;
    for (const q of mapaQuantidade.values()) if (q > max) max = q;
    return max;
  }, [mapaQuantidade]);

  const estados = useMemo(() => {
    if (!geo) return null;
    const projecao = geoMercator().fitSize([largura, altura], geo as unknown as GeoPermissibleObjects);
    const path = geoPath(projecao);
    return geo.features
      .map((feature, i) => {
        const sigla = extrairSigla(feature.properties);
        const d = path(feature.geometry) ?? "";
        const centro = path.centroid(feature.geometry);
        return { key: sigla ?? `f-${i}`, sigla, d, centro };
      })
      .filter((e) => e.d.length > 0);
  }, [geo, largura, altura]);

  if (erro) {
    return (
      <div
        role="status"
        className="flex items-center justify-center rounded-2xl border border-border bg-surface-strong p-8 text-center text-sm text-brand-strong"
        style={{ minHeight: 240 }}
      >
        Mapa indisponível
      </div>
    );
  }

  if (!estados) {
    return (
      <div
        role="status"
        aria-label="Carregando mapa"
        className="animate-pulse rounded-2xl border border-border bg-surface-strong"
        style={{ minHeight: 240, aspectRatio: `${largura} / ${altura}` }}
      />
    );
  }

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${largura} ${altura}`}
        className="h-auto w-full"
        role="img"
        aria-label="Mapa de imóveis por estado do Brasil"
      >
        {estados.map((e) => {
          const q = e.sigla ? mapaQuantidade.get(e.sigla) ?? 0 : 0;
          const fill = q > 0 && maxQuantidade > 0 ? corEscala(q / maxQuantidade) : COR_ZERO;
          const ativo = hover === e.key;
          const clicavel = Boolean(e.sigla);
          return (
            <path
              key={e.key}
              d={e.d}
              fill={fill}
              stroke={ativo ? "#9c4310" : "#ffffff"}
              strokeWidth={ativo ? 1.6 : 0.6}
              style={{ cursor: clicavel ? "pointer" : "default", transition: "fill 120ms, stroke 120ms" }}
              onMouseEnter={() => setHover(e.key)}
              onMouseLeave={() => setHover((h) => (h === e.key ? null : h))}
              onClick={() => clicavel && router.push(hrefUf(e.sigla!))}
              role={clicavel ? "link" : undefined}
              aria-label={e.sigla ? `${e.sigla}: ${q} imóveis` : undefined}
            >
              {e.sigla ? <title>{`${e.sigla} — ${q} imóveis`}</title> : null}
            </path>
          );
        })}
        {estados.map((e) => {
          if (!e.sigla || !Number.isFinite(e.centro[0]) || !Number.isFinite(e.centro[1])) return null;
          const q = mapaQuantidade.get(e.sigla) ?? 0;
          return (
            <g key={`rot-${e.key}`} pointerEvents="none" textAnchor="middle">
              <text
                x={e.centro[0]}
                y={e.centro[1]}
                fontSize={10}
                fontWeight={700}
                fill="#26241f"
              >
                {e.sigla}
              </text>
              <text x={e.centro[0]} y={e.centro[1] + 10} fontSize={8} fill="#6b6459">
                {q}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
