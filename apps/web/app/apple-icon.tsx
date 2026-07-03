// Ícone apple-touch (atalho na tela inicial do iOS — uso real de quem recebe
// link por WhatsApp). Monograma "IA" branco sobre o laranja da marca, com
// detalhe dourado; 180x180 conforme a convenção app/apple-icon.tsx.

import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          background: "#DB6414",
          color: "#fff",
          fontSize: 92,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          fontFamily: "sans-serif",
        }}
      >
        IA
        <div
          style={{
            marginTop: 10,
            width: 56,
            height: 8,
            borderRadius: 4,
            background: "#F2A93B",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
