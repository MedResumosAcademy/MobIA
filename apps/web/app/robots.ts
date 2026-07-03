// robots.txt gerado pela convenção app/robots.ts. Libera o conteúdo público e
// bloqueia áreas autenticadas/de estado pessoal (reforço do noindex por página).

import type { MetadataRoute } from "next";

const BASE_URL = "https://mob-ia.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/corretor/",
        "/corretor",
        "/conta",
        "/onboarding",
        "/entrar",
        "/cadastro",
        "/favoritos",
        "/comparar",
        "/api/",
      ],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
