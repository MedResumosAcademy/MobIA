// sitemap.xml gerado pela convenção app/sitemap.ts. Rotas públicas estáticas +
// fichas de imóvel (/imoveis/[id]) via client anônimo — a RLS já limita a
// consulta a status='disponivel', então nada privado vaza. /comparar e
// /favoritos ficam FORA (estado pessoal, noindex). Em erro de banco, degrada
// para só as rotas estáticas — o build/rota nunca quebra por causa disso.

import type { MetadataRoute } from "next";
import { criarClientePublico } from "@/lib/supabase/publico";

const BASE_URL = "https://mob-ia.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const estaticas: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${BASE_URL}/imoveis`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/mapa`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE_URL}/sonhometro`, changeFrequency: "monthly", priority: 0.6 },
  ];

  try {
    const supabase = criarClientePublico();
    const { data, error } = await supabase
      .from("imoveis")
      .select("id, atualizado_em")
      .order("atualizado_em", { ascending: false, nullsFirst: false })
      .limit(5000);
    if (error || !data) {
      return estaticas;
    }
    const fichas: MetadataRoute.Sitemap = data.map((linha) => ({
      url: `${BASE_URL}/imoveis/${linha.id}`,
      lastModified: linha.atualizado_em ? new Date(linha.atualizado_em) : undefined,
      changeFrequency: "weekly",
      priority: 0.8,
    }));
    return [...estaticas, ...fichas];
  } catch {
    return estaticas;
  }
}
