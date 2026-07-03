// Web app manifest (convenção app/manifest.ts) — dá nome, ícone e cor da marca
// ao atalho "adicionar à tela inicial" (uso real de quem recebe link por
// WhatsApp). Os ícones apontam para as rotas geradas por app/icon.tsx e
// app/apple-icon.tsx (ImageResponse).

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ImobIA",
    short_name: "ImobIA",
    description:
      "O primeiro aplicativo que permite ao cliente montar sua própria compra.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfaf8",
    theme_color: "#DB6414",
    icons: [
      { src: "/icon", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
