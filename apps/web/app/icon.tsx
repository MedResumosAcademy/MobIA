// Favicon da ImobIA (convenção app/icon.tsx — substitui o favicon.ico default
// do create-next-app). Monograma "IA" branco sobre o laranja da marca.

import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#DB6414",
          borderRadius: 7,
          color: "#fff",
          fontSize: 17,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          fontFamily: "sans-serif",
        }}
      >
        IA
      </div>
    ),
    { ...size },
  );
}
