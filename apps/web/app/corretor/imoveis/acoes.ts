"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  balaoSchema,
  categoriaImovelSchema,
  modalidadeSchema,
  parcelaMensalEsquemaSchema,
  percentualSchema,
  statusImovelSchema,
  tipoImovelSchema,
  ufSchema,
} from "@mobia/domain";
import { obterPerfil, obterSessao } from "@/lib/auth/sessao";
import {
  atualizarImovel,
  atualizarUnidade,
  criarImovel,
  criarUnidade,
  definirStatusImovel,
  removerUnidade,
  type ImovelEntrada,
} from "@/lib/dados/imoveis";
import { caminhoMidia, urlPublicaMidia, type BucketMidia } from "@/lib/dados/storage";
import { criarClienteServidor } from "@/lib/supabase/server";

// org_id vem SEMPRE da sessão — nunca do formulário (anti-forja).
async function exigirOrg(): Promise<string> {
  const sessao = await obterSessao();
  if (!sessao) {
    redirect("/entrar");
  }
  const perfil = await obterPerfil(sessao.usuarioId);
  if (
    !perfil ||
    (perfil.papel !== "corretor" && perfil.papel !== "gestor") ||
    !perfil.orgId
  ) {
    redirect("/");
  }
  return perfil.orgId;
}

// --- Parsing do formulário → ImovelEntrada ---

// O esquema de pagamento e as fotos/plantas por URL chegam como JSON em
// campos ocultos preenchidos pelo componente cliente (evita FormData ambíguo).
const esquemaFormSchema = z
  .object({
    modalidade: modalidadeSchema,
    percentualMinimoAto: percentualSchema,
    numeroParcelasMensais: z.number().int().nonnegative(),
    parcelaMensal: parcelaMensalEsquemaSchema.optional(),
    baloes: z.array(balaoSchema),
  })
  .strict()
  .refine(
    (e) => e.numeroParcelasMensais === 0 || e.parcelaMensal !== undefined,
    { message: "esquema com parcelas mensais exige parcelaMensal" },
  );

function jsonArrayString(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string" || raw.trim() === "") {
    return [];
  }
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed.map(String) : [];
}

function reaisParaCentavos(raw: FormDataEntryValue | null): number {
  const texto = String(raw ?? "").trim();
  if (texto === "") {
    return 0;
  }
  // Aceita "1.280.000,00" ou "1280000.00" ou "1280000".
  const normalizado = texto.replace(/\./g, "").replace(",", ".");
  const numero = Number(normalizado);
  if (!Number.isFinite(numero) || numero < 0) {
    throw new Error("valor inválido");
  }
  return Math.round(numero * 100);
}

function opcional(raw: FormDataEntryValue | null): string | null {
  const texto = String(raw ?? "").trim();
  return texto === "" ? null : texto;
}

function numeroOpcional(raw: FormDataEntryValue | null): number | null {
  const texto = String(raw ?? "").trim();
  if (texto === "") {
    return null;
  }
  const n = Number(texto.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function lerEsquema(raw: FormDataEntryValue | null): ImovelEntrada["esquemaPagamento"] {
  if (typeof raw !== "string" || raw.trim() === "") {
    return null;
  }
  const parsed = esquemaFormSchema.parse(JSON.parse(raw));
  return parsed;
}

function montarEntrada(formData: FormData): ImovelEntrada {
  const tipoRaw = opcional(formData.get("tipo"));
  const tipo = tipoRaw ? tipoImovelSchema.parse(tipoRaw) : null;

  const categorias = formData
    .getAll("categorias")
    .map(String)
    .map((c) => categoriaImovelSchema.parse(c));

  const modalidadesElegiveis = formData
    .getAll("modalidadesElegiveis")
    .map(String)
    .map((m) => modalidadeSchema.parse(m));

  const condicaoRaw = opcional(formData.get("condicao"));
  const condicao =
    condicaoRaw === "novo" || condicaoRaw === "usado" ? condicaoRaw : null;

  return {
    tipo,
    categorias,
    condicao,
    endereco: opcional(formData.get("endereco")),
    cidade: String(formData.get("cidade") ?? "").trim(),
    uf: ufSchema.parse(String(formData.get("uf") ?? "").trim().toUpperCase()),
    valor: reaisParaCentavos(formData.get("valor")),
    descricao: opcional(formData.get("descricao")),
    fotos: jsonArrayString(formData.get("fotosUrls")),
    plantas: jsonArrayString(formData.get("plantasUrls")),
    modalidadesElegiveis,
    esquemaPagamento: lerEsquema(formData.get("esquemaPagamento")),
    lat: numeroOpcional(formData.get("lat")),
    lng: numeroOpcional(formData.get("lng")),
    quartos: numeroOpcionalInteiro(formData.get("quartos")),
    banheiros: numeroOpcionalInteiro(formData.get("banheiros")),
    vagas: numeroOpcionalInteiro(formData.get("vagas")),
    areaUtil: numeroOpcionalInteiro(formData.get("areaUtil")),
  };
}

// --- Upload de mídia ---

function nomeSeguro(nome: string): string {
  const limpo = nome.normalize("NFKD").replace(/[^\w.\-]+/g, "_");
  return `${Date.now()}-${limpo}`;
}

async function enviarArquivos(
  bucket: BucketMidia,
  orgId: string,
  imovelId: string,
  arquivos: File[],
): Promise<string[]> {
  const paths: string[] = [];
  const validos = arquivos.filter((a) => a && a.size > 0);
  if (validos.length === 0) {
    return paths;
  }
  const supabase = await criarClienteServidor();
  for (const arquivo of validos) {
    const path = caminhoMidia(orgId, imovelId, nomeSeguro(arquivo.name));
    const { error } = await supabase.storage.from(bucket).upload(path, arquivo, {
      contentType: arquivo.type || undefined,
      upsert: false,
    });
    if (error) {
      throw new Error(`upload de mídia falhou: ${error.message}`);
    }
    // Buckets são públicos: guardamos a URL pública (passa no .url() do schema
    // de entrada e renderiza direto via passthrough de urlPublicaMidia).
    paths.push(urlPublicaMidia(bucket, path));
  }
  return paths;
}

// --- Ações de imóvel ---

export async function criarImovelAction(formData: FormData) {
  const orgId = await exigirOrg();
  let destino = "/corretor/imoveis?ok=criado";
  try {
    const entrada = montarEntrada(formData);
    // Cria primeiro (obtém id) e depois anexa mídias no path {org}/{id}/...
    const imovel = await criarImovel(entrada);
    const fotos = await enviarArquivos(
      "imoveis-fotos",
      orgId,
      imovel.id,
      formData.getAll("fotosArquivos") as File[],
    );
    const plantas = await enviarArquivos(
      "imoveis-plantas",
      orgId,
      imovel.id,
      formData.getAll("plantasArquivos") as File[],
    );
    if (fotos.length > 0 || plantas.length > 0) {
      await atualizarImovel(imovel.id, {
        ...entrada,
        fotos: [...(entrada.fotos ?? []), ...fotos],
        plantas: [...(entrada.plantas ?? []), ...plantas],
      });
    }
  } catch (e) {
    destino = `/corretor/imoveis/novo?erro=${codigoErro(e)}`;
    redirect(destino);
  }
  revalidatePath("/corretor/imoveis");
  redirect(destino);
}

export async function atualizarImovelAction(id: string, formData: FormData) {
  const orgId = await exigirOrg();
  let destino = "/corretor/imoveis?ok=atualizado";
  try {
    const entrada = montarEntrada(formData);
    const fotos = await enviarArquivos(
      "imoveis-fotos",
      orgId,
      id,
      formData.getAll("fotosArquivos") as File[],
    );
    const plantas = await enviarArquivos(
      "imoveis-plantas",
      orgId,
      id,
      formData.getAll("plantasArquivos") as File[],
    );
    await atualizarImovel(id, {
      ...entrada,
      fotos: [...(entrada.fotos ?? []), ...fotos],
      plantas: [...(entrada.plantas ?? []), ...plantas],
    });
  } catch (e) {
    destino = `/corretor/imoveis/${id}/editar?erro=${codigoErro(e)}`;
    redirect(destino);
  }
  revalidatePath("/corretor/imoveis");
  revalidatePath(`/corretor/imoveis/${id}/editar`);
  redirect(destino);
}

export async function definirStatusImovelAction(formData: FormData) {
  await exigirOrg();
  const id = String(formData.get("id") ?? "");
  const status = statusImovelSchema.parse(String(formData.get("status") ?? ""));
  await definirStatusImovel(id, status);
  revalidatePath("/corretor/imoveis");
}

// --- Ações de unidade (H-24) ---

function montarUnidade(formData: FormData) {
  return {
    identificador: String(formData.get("identificador") ?? "").trim(),
    andar: numeroOpcionalInteiro(formData.get("andar")),
    posicao: opcional(formData.get("posicao")),
    valor: reaisParaCentavos(formData.get("valor")),
    status: statusImovelSchema.parse(
      String(formData.get("status") ?? "disponivel"),
    ),
  };
}

function numeroOpcionalInteiro(raw: FormDataEntryValue | null): number | null {
  const texto = String(raw ?? "").trim();
  if (texto === "") {
    return null;
  }
  const n = Number.parseInt(texto, 10);
  return Number.isFinite(n) ? n : null;
}

export async function criarUnidadeAction(imovelId: string, formData: FormData) {
  await exigirOrg();
  await criarUnidade(imovelId, montarUnidade(formData));
  revalidatePath(`/corretor/imoveis/${imovelId}/editar`);
}

export async function atualizarUnidadeAction(
  imovelId: string,
  unidadeId: string,
  formData: FormData,
) {
  await exigirOrg();
  await atualizarUnidade(unidadeId, montarUnidade(formData));
  revalidatePath(`/corretor/imoveis/${imovelId}/editar`);
}

export async function removerUnidadeAction(formData: FormData) {
  await exigirOrg();
  const imovelId = String(formData.get("imovelId") ?? "");
  const unidadeId = String(formData.get("unidadeId") ?? "");
  await removerUnidade(unidadeId);
  revalidatePath(`/corretor/imoveis/${imovelId}/editar`);
}

function codigoErro(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("upload")) return "upload";
  if (msg.includes("permissão") || msg.includes("autenticado")) return "permissao";
  return "invalido";
}
