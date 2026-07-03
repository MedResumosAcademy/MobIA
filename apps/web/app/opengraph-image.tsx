// Imagem OpenGraph/Twitter padrão do site (convenção app/opengraph-image.tsx
// do App Router — o Next liga sozinho em og:image e twitter:image). Wordmark
// "Imob" grafite + "IA" laranja da marca sobre off-white quente, com filete
// dourado. Gerada em build (estática) via ImageResponse do next/og.

import { ImageResponse } from "next/og";

export const alt = "ImobIA — O primeiro aplicativo que permite ao cliente montar sua própria compra.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#fbfaf8",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 148,
            fontWeight: 700,
            letterSpacing: "-0.04em",
            color: "#26241f",
          }}
        >
          Imob
          <span style={{ color: "#DB6414" }}>IA</span>
        </div>
        <div
          style={{
            marginTop: 28,
            width: 120,
            height: 6,
            borderRadius: 3,
            background: "#F2A93B",
          }}
        />
        <div
          style={{
            marginTop: 32,
            maxWidth: 860,
            textAlign: "center",
            fontSize: 34,
            lineHeight: 1.4,
            color: "#5c574d",
          }}
        >
          O primeiro aplicativo que permite ao cliente montar sua própria compra.
        </div>
      </div>
    ),
    { ...size },
  );
}
