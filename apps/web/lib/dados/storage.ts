// Helpers de mídia (fotos/plantas). Buckets públicos 'imoveis-fotos' e
// 'imoveis-plantas'. Convenção de path: {orgId}/{imovelId}/{arquivo}.
// Upload real fica na server action do cadastro (fase UI).

export type BucketMidia = "imoveis-fotos" | "imoveis-plantas";

/**
 * Monta a URL pública de um objeto do Storage. Se `path` já for uma URL
 * http(s) (ex.: seed com picsum.photos), retorna como está.
 */
export function urlPublicaMidia(bucket: BucketMidia, path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const limpo = path.replace(/^\/+/, "");
  return `${base}/storage/v1/object/public/${bucket}/${limpo}`;
}

/** Caminho canônico de um arquivo de mídia: {orgId}/{imovelId}/{arquivo}. */
export function caminhoMidia(orgId: string, imovelId: string, arquivo: string): string {
  return `${orgId}/${imovelId}/${arquivo}`;
}
