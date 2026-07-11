// Camada de dados de imóveis — funções server-side. Mapeia snake_case⇄camelCase
// e valida com zod de @imobia/domain. RLS multi-tenant cuida do escopo:
// catálogo público só vê status='disponivel'; corretor/gestor só a própria org.
// Módulo de dados server-side (NÃO é um arquivo de Server Actions: exporta
// schemas/tipos além de funções). Importado só por Server Components e ações.

import {
  balaoSchema,
  categoriaImovelSchema,
  modalidadeSchema,
  parcelaMensalEsquemaSchema,
  percentualSchema,
  statusImovelSchema,
  tipoImovelSchema,
  ufSchema,
  type CategoriaImovel,
  type Database,
  type Modalidade,
  type StatusImovel,
  type TipoImovel,
} from "@imobia/domain";
import { cache } from "react";
import { z } from "zod";
import { obterPerfil, obterSessao } from "@/lib/auth/sessao";
import { criarClientePublico } from "@/lib/supabase/publico";
import { criarClienteServidor } from "@/lib/supabase/server";
import { urlPublicaMidia } from "./storage";

type LinhaImovel = Database["public"]["Tables"]["imoveis"]["Row"];
type LinhaUnidade = Database["public"]["Tables"]["unidades"]["Row"];
type InsertImovel = Database["public"]["Tables"]["imoveis"]["Insert"];
type UpdateImovel = Database["public"]["Tables"]["imoveis"]["Update"];
type Json = Database["public"]["Tables"]["imoveis"]["Row"]["esquema_pagamento"];

// --- Tipos de saída (camelCase, prontos para a UI) ---

export type CardImovel = {
  id: string;
  titulo: string;
  tipo: TipoImovel | null;
  categorias: CategoriaImovel[];
  endereco: string | null;
  cidade: string;
  uf: string;
  valor: number;
  fotoCapa: string | null;
  quartos: number | null;
  banheiros: number | null;
  vagas: number | null;
  areaUtil: number | null;
};

export type Unidade = {
  id: string;
  imovelId: string;
  identificador: string;
  andar: number | null;
  posicao: string | null;
  valor: number;
  status: StatusImovel;
};

export type ImovelDetalhe = {
  id: string;
  orgId: string;
  corretorResponsavelId: string;
  titulo: string;
  tipo: TipoImovel | null;
  categorias: CategoriaImovel[];
  status: StatusImovel;
  condicao: string | null;
  endereco: string | null;
  cidade: string;
  uf: string;
  valor: number;
  descricao: string | null;
  fotos: string[];
  plantas: string[];
  modalidadesElegiveis: Modalidade[];
  esquemaPagamento: EsquemaPagamentoArmazenado | null;
  lat: number | null;
  lng: number | null;
  quartos: number | null;
  banheiros: number | null;
  vagas: number | null;
  areaUtil: number | null;
  unidades: Unidade[];
};

// --- Filtros do catálogo ---

export type FiltrosCatalogo = {
  tipo?: TipoImovel;
  categoria?: CategoriaImovel;
  cidadeBusca?: string;
  precoMin?: number;
  precoMax?: number;
  /**
   * Teto de valor (centavos) vindo da capacidade do Sonhômetro (H-18): só
   * imóveis com valor <= capacidade. Compõe com precoMax (ambos aplicados,
   * vence o mais restritivo). Omitir = catálogo completo ("ver todos").
   */
  capacidadeMax?: number;
  /** Número mínimo de quartos: só imóveis com quartos >= quartosMin. */
  quartosMin?: number;
  /** Sigla da UF (2 letras); normalizada para maiúsculas. Filtra por estado. */
  uf?: string;
  /**
   * Máximo de linhas retornadas (`.limit()` no banco). Omitir = sem teto.
   * Use quando a tela só exibe os N primeiros (ex.: destaques da landing) —
   * evita baixar o catálogo inteiro.
   */
  limite?: number;
};

// --- Agregação por UF ---

export type AgregadoUf = {
  uf: string;
  cidadePrincipal?: string;
  /** Nº de imóveis disponíveis nessa UF. */
  quantidade: number;
  /** Menor valor (centavos) entre os disponíveis dessa UF. */
  valorMinimo: number;
};

// --- Schemas de entrada (anti-forja: org_id/corretor NUNCA vêm do form) ---

// Esquema de pagamento COMO PERSISTIDO no jsonb: o mesmo formato do domínio SEM
// os campos derivados da sessão/imóvel (id/orgId/imovelId — anti-forja e nunca
// gravados). Reconstruído como ZodObject (não via .omit sobre o schema refinado,
// que quebra a inferência). É a forma usada tanto no cadastro (entrada) quanto
// no read-back da ficha (mapDetalhe).
const esquemaPagamentoArmazenadoSchema = z
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

export type EsquemaPagamentoArmazenado = z.infer<typeof esquemaPagamentoArmazenadoSchema>;

const esquemaPagamentoEntradaSchema = esquemaPagamentoArmazenadoSchema.nullable();

export const imovelEntradaSchema = z
  .object({
    tipo: tipoImovelSchema.nullable().optional(),
    categorias: z.array(categoriaImovelSchema).default([]),
    condicao: z.string().nullable().optional(),
    endereco: z.string().nullable().optional(),
    cidade: z.string().min(1),
    uf: ufSchema,
    valor: z.number().int().nonnegative(),
    descricao: z.string().nullable().optional(),
    fotos: z.array(z.string().url()).default([]),
    plantas: z.array(z.string().url()).default([]),
    modalidadesElegiveis: z.array(modalidadeSchema).default([]),
    esquemaPagamento: esquemaPagamentoEntradaSchema.optional(),
    lat: z.number().min(-90).max(90).nullable().optional(),
    lng: z.number().min(-180).max(180).nullable().optional(),
    quartos: z.number().int().nonnegative().nullable().optional(),
    banheiros: z.number().int().nonnegative().nullable().optional(),
    vagas: z.number().int().nonnegative().nullable().optional(),
    areaUtil: z.number().int().nonnegative().nullable().optional(),
  })
  .strict();

export type ImovelEntrada = z.input<typeof imovelEntradaSchema>;

// --- Helpers de coerção de enums vindos do banco (colunas text) ---

function coagirTipo(v: string | null): TipoImovel | null {
  const r = tipoImovelSchema.safeParse(v);
  return r.success ? r.data : null;
}

function coagirStatus(v: string): StatusImovel {
  const r = statusImovelSchema.safeParse(v);
  return r.success ? r.data : "disponivel";
}

function coagirCategorias(vs: string[]): CategoriaImovel[] {
  return vs
    .map((v) => categoriaImovelSchema.safeParse(v))
    .filter((r): r is { success: true; data: CategoriaImovel } => r.success)
    .map((r) => r.data);
}

function coagirModalidades(vs: string[]): Modalidade[] {
  return vs
    .map((v) => modalidadeSchema.safeParse(v))
    .filter((r): r is { success: true; data: Modalidade } => r.success)
    .map((r) => r.data);
}

/** Título derivado — o banco não tem coluna própria de título. */
function derivarTitulo(l: Pick<LinhaImovel, "tipo" | "cidade" | "uf">): string {
  const rotulos: Record<TipoImovel, string> = {
    casa: "Casa",
    apartamento: "Apartamento",
    terreno: "Terreno",
  };
  const tipo = coagirTipo(l.tipo);
  const prefixo = tipo ? rotulos[tipo] : "Imóvel";
  return `${prefixo} em ${l.cidade}/${l.uf}`;
}

/** Mapeia uma linha de imóvel para o card enxuto da UI. Reusado por favoritos.ts. */
export function mapCardImovel(l: LinhaImovel): CardImovel {
  const fotoCapa = l.fotos[0] ? urlPublicaMidia("imoveis-fotos", l.fotos[0]) : null;
  return {
    id: l.id,
    titulo: derivarTitulo(l),
    tipo: coagirTipo(l.tipo),
    categorias: coagirCategorias(l.categorias),
    endereco: l.endereco,
    cidade: l.cidade,
    uf: l.uf,
    valor: l.valor,
    fotoCapa,
    quartos: l.quartos,
    banheiros: l.banheiros,
    vagas: l.vagas,
    areaUtil: l.area_util,
  };
}

function mapUnidade(l: LinhaUnidade): Unidade {
  return {
    id: l.id,
    imovelId: l.imovel_id,
    identificador: l.identificador,
    andar: l.andar,
    posicao: l.posicao,
    valor: l.valor,
    status: coagirStatus(l.status),
  };
}

function mapDetalhe(l: LinhaImovel, unidades: LinhaUnidade[]): ImovelDetalhe {
  const esquema = l.esquema_pagamento
    ? esquemaPagamentoArmazenadoSchema.safeParse(l.esquema_pagamento)
    : null;
  return {
    id: l.id,
    orgId: l.org_id,
    corretorResponsavelId: l.corretor_responsavel_id,
    titulo: derivarTitulo(l),
    tipo: coagirTipo(l.tipo),
    categorias: coagirCategorias(l.categorias),
    status: coagirStatus(l.status),
    condicao: l.condicao,
    endereco: l.endereco,
    cidade: l.cidade,
    uf: l.uf,
    valor: l.valor,
    descricao: l.descricao,
    fotos: l.fotos.map((p) => urlPublicaMidia("imoveis-fotos", p)),
    plantas: l.plantas.map((p) => urlPublicaMidia("imoveis-plantas", p)),
    modalidadesElegiveis: coagirModalidades(l.modalidades_elegiveis),
    esquemaPagamento: esquema && esquema.success ? esquema.data : null,
    lat: l.lat,
    lng: l.lng,
    quartos: l.quartos,
    banheiros: l.banheiros,
    vagas: l.vagas,
    areaUtil: l.area_util,
    unidades: unidades.map(mapUnidade),
  };
}

// --- Leitura pública ---

/**
 * Catálogo público. RLS já limita a status='disponivel'. Ordena por criado_em
 * desc. Retorna cards enxutos.
 */
export async function listarImoveis(
  filtros: FiltrosCatalogo = {},
): Promise<CardImovel[]> {
  const supabase = criarClientePublico();
  let query = supabase.from("imoveis").select("*").order("criado_em", { ascending: false });

  if (filtros.tipo) {
    query = query.eq("tipo", filtros.tipo);
  }
  if (filtros.categoria) {
    query = query.contains("categorias", [filtros.categoria]);
  }
  if (filtros.cidadeBusca) {
    query = query.ilike("cidade", `%${filtros.cidadeBusca}%`);
  }
  if (filtros.uf) {
    query = query.eq("uf", filtros.uf.toUpperCase());
  }
  if (filtros.precoMin !== undefined) {
    query = query.gte("valor", filtros.precoMin);
  }
  if (filtros.precoMax !== undefined) {
    query = query.lte("valor", filtros.precoMax);
  }
  if (filtros.capacidadeMax !== undefined) {
    // Compõe com precoMax: dois lte("valor", ...) ⇒ vence o mais restritivo.
    query = query.lte("valor", filtros.capacidadeMax);
  }
  if (filtros.quartosMin !== undefined) {
    query = query.gte("quartos", filtros.quartosMin);
  }
  if (filtros.limite !== undefined) {
    query = query.limit(filtros.limite);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`listarImoveis: ${error.message}`);
  }
  return (data ?? []).map(mapCardImovel);
}

/**
 * Agrega os imóveis DISPONÍVEIS (RLS pública via criarClientePublico) por UF.
 * Para cada UF: contagem, menor valor (centavos) e a cidade com mais imóveis
 * (cidadePrincipal, desempate alfabético). Ordena por quantidade desc (desempate
 * por UF asc). O total geral vem sob a chave especial uf="__total".
 */
export async function agregarImoveisPorUf(): Promise<AgregadoUf[]> {
  const supabase = criarClientePublico();
  const { data, error } = await supabase.from("imoveis").select("uf, cidade, valor");
  if (error) {
    throw new Error(`agregarImoveisPorUf: ${error.message}`);
  }
  const linhas = data ?? [];

  const porUf = new Map<
    string,
    { quantidade: number; valorMinimo: number; cidades: Map<string, number> }
  >();

  for (const l of linhas) {
    const uf = l.uf.toUpperCase();
    const atual = porUf.get(uf) ?? {
      quantidade: 0,
      valorMinimo: Number.POSITIVE_INFINITY,
      cidades: new Map<string, number>(),
    };
    atual.quantidade += 1;
    atual.valorMinimo = Math.min(atual.valorMinimo, l.valor);
    atual.cidades.set(l.cidade, (atual.cidades.get(l.cidade) ?? 0) + 1);
    porUf.set(uf, atual);
  }

  const agregados: AgregadoUf[] = [...porUf.entries()]
    .map(([uf, v]) => {
      const cidadePrincipal = [...v.cidades.entries()].sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
      )[0]?.[0];
      return {
        uf,
        cidadePrincipal,
        quantidade: v.quantidade,
        valorMinimo: v.valorMinimo,
      };
    })
    .sort((a, b) => b.quantidade - a.quantidade || a.uf.localeCompare(b.uf));

  const total: AgregadoUf = {
    uf: "__total",
    quantidade: linhas.length,
    valorMinimo: agregados.reduce(
      (min, a) => Math.min(min, a.valorMinimo),
      Number.POSITIVE_INFINITY,
    ),
  };

  return [...agregados, total];
}

/**
 * Imóvel + unidades. Retorna null se não visível (RLS) ou inexistente.
 * Envolto em React cache(): generateMetadata e a Page da ficha chamam com o
 * mesmo id no mesmo request — só a primeira paga a query. As duas leituras
 * internas (imóvel e unidades) dependem apenas do id ⇒ rodam em paralelo;
 * se o imóvel não existir, o resultado de unidades é descartado.
 */
export const obterImovel = cache(
  async (id: string): Promise<ImovelDetalhe | null> => {
    const supabase = criarClientePublico();
    const [{ data: imovel, error }, { data: unidades }] = await Promise.all([
      supabase.from("imoveis").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("unidades")
        .select("*")
        .eq("imovel_id", id)
        .order("identificador", { ascending: true }),
    ]);
    // Erro REAL de banco (transitório/permissão) NÃO pode virar 404: lança e o
    // error boundary pt-BR assume. PGRST116 (0 ou 2+ linhas no maybeSingle) e
    // ausência continuam null — "não existe/não visível".
    if (error && error.code !== "PGRST116") {
      throw new Error(`obterImovel: ${error.message}`);
    }
    if (!imovel) {
      return null;
    }
    return mapDetalhe(imovel, unidades ?? []);
  },
);

// --- Leitura da org (corretor logado) ---

/**
 * org_id do perfil logado — null quando não logado ou sem org. Necessário
 * porque a RLS SOZINHA não escopa a leitura por org: a policy do catálogo
 * público deixa QUALQUER autenticado ver 'disponivel' de todas as orgs.
 */
async function orgDoUsuario(): Promise<string | null> {
  const sessao = await obterSessao();
  if (!sessao) {
    return null;
  }
  const perfil = await obterPerfil(sessao.usuarioId);
  return perfil?.orgId ?? null;
}

/** Carteira da própria org — todos os status. Filtro EXPLÍCITO por org_id
 *  (a RLS do catálogo exporia 'disponivel' de outras orgs); sem org ⇒ []. */
export async function listarImoveisDaOrg(): Promise<ImovelDetalhe[]> {
  const orgId = await orgDoUsuario();
  if (!orgId) {
    return [];
  }
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("imoveis")
    .select("*")
    .eq("org_id", orgId)
    .order("criado_em", { ascending: false });
  if (error) {
    throw new Error(`listarImoveisDaOrg: ${error.message}`);
  }
  return (data ?? []).map((l) => mapDetalhe(l, []));
}

/**
 * Imóvel + unidades da própria org — TODOS os status, filtro explícito por
 * org_id (id vem do cliente; sem o filtro, 'disponivel' de outra org passaria
 * pela policy pública). Gêmeo org-scoped de obterImovel: use este quando a
 * origem já é a lista autorizada da org (ex.: Coringa), para que um imóvel
 * reservado/vendido visível no SELECT não falhe na ação. Retorna null se
 * fora do escopo (org/RLS) ou inexistente.
 */
export async function obterImovelDaOrg(id: string): Promise<ImovelDetalhe | null> {
  const orgId = await orgDoUsuario();
  if (!orgId) {
    return null;
  }
  const supabase = await criarClienteServidor();
  const { data: imovel, error } = await supabase
    .from("imoveis")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error || !imovel) {
    return null;
  }
  const { data: unidades } = await supabase
    .from("unidades")
    .select("*")
    .eq("imovel_id", id)
    .order("identificador", { ascending: true });
  return mapDetalhe(imovel, unidades ?? []);
}

// --- Escrita (escopo org via sessão) ---

async function exigirCorretor(): Promise<{ usuarioId: string; orgId: string }> {
  const sessao = await obterSessao();
  if (!sessao) {
    throw new Error("não autenticado");
  }
  const perfil = await obterPerfil(sessao.usuarioId);
  if (!perfil || (perfil.papel !== "corretor" && perfil.papel !== "gestor") || !perfil.orgId) {
    throw new Error("sem permissão de escrita na org");
  }
  return { usuarioId: sessao.usuarioId, orgId: perfil.orgId };
}

function entradaParaInsert(
  input: z.infer<typeof imovelEntradaSchema>,
  orgId: string,
  corretorId: string,
): InsertImovel {
  return {
    org_id: orgId,
    corretor_responsavel_id: corretorId,
    tipo: input.tipo ?? null,
    categorias: input.categorias,
    condicao: input.condicao ?? null,
    endereco: input.endereco ?? null,
    cidade: input.cidade,
    uf: input.uf,
    valor: input.valor,
    descricao: input.descricao ?? null,
    fotos: input.fotos,
    plantas: input.plantas,
    modalidades_elegiveis: input.modalidadesElegiveis,
    esquema_pagamento: (input.esquemaPagamento ?? null) as Json,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    quartos: input.quartos ?? null,
    banheiros: input.banheiros ?? null,
    vagas: input.vagas ?? null,
    area_util: input.areaUtil ?? null,
  };
}

export async function criarImovel(input: ImovelEntrada): Promise<ImovelDetalhe> {
  const { usuarioId, orgId } = await exigirCorretor();
  const dados = imovelEntradaSchema.parse(input);
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("imoveis")
    .insert(entradaParaInsert(dados, orgId, usuarioId))
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`criarImovel: ${error?.message ?? "sem retorno"}`);
  }
  return mapDetalhe(data, []);
}

export async function atualizarImovel(
  id: string,
  input: ImovelEntrada,
): Promise<ImovelDetalhe> {
  await exigirCorretor();
  const dados = imovelEntradaSchema.parse(input);
  const supabase = await criarClienteServidor();
  // org_id/corretor NÃO são atualizados (anti-forja); RLS garante escopo.
  const alteracoes: UpdateImovel = {
    tipo: dados.tipo ?? null,
    categorias: dados.categorias,
    condicao: dados.condicao ?? null,
    endereco: dados.endereco ?? null,
    cidade: dados.cidade,
    uf: dados.uf,
    valor: dados.valor,
    descricao: dados.descricao ?? null,
    fotos: dados.fotos,
    plantas: dados.plantas,
    modalidades_elegiveis: dados.modalidadesElegiveis,
    esquema_pagamento: (dados.esquemaPagamento ?? null) as Json,
    lat: dados.lat ?? null,
    lng: dados.lng ?? null,
    quartos: dados.quartos ?? null,
    banheiros: dados.banheiros ?? null,
    vagas: dados.vagas ?? null,
    area_util: dados.areaUtil ?? null,
    atualizado_em: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("imoveis")
    .update(alteracoes)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`atualizarImovel: ${error?.message ?? "sem retorno"}`);
  }
  return mapDetalhe(data, []);
}

export async function definirStatusImovel(
  id: string,
  status: StatusImovel,
): Promise<void> {
  await exigirCorretor();
  const s = statusImovelSchema.parse(status);
  const supabase = await criarClienteServidor();
  const { error } = await supabase
    .from("imoveis")
    .update({ status: s, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    throw new Error(`definirStatusImovel: ${error.message}`);
  }
}

// --- Unidades (H-24) ---

export const unidadeEntradaSchema = z
  .object({
    identificador: z.string().min(1),
    andar: z.number().int().nullable().optional(),
    posicao: z.string().nullable().optional(),
    valor: z.number().int().nonnegative(),
    status: statusImovelSchema.default("disponivel"),
  })
  .strict();

export type UnidadeEntrada = z.input<typeof unidadeEntradaSchema>;

export async function criarUnidade(
  imovelId: string,
  input: UnidadeEntrada,
): Promise<Unidade> {
  const { orgId } = await exigirCorretor();
  const dados = unidadeEntradaSchema.parse(input);
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("unidades")
    .insert({
      org_id: orgId,
      imovel_id: imovelId,
      identificador: dados.identificador,
      andar: dados.andar ?? null,
      posicao: dados.posicao ?? null,
      valor: dados.valor,
      status: dados.status,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`criarUnidade: ${error?.message ?? "sem retorno"}`);
  }
  return mapUnidade(data);
}

export async function atualizarUnidade(
  id: string,
  input: UnidadeEntrada,
): Promise<Unidade> {
  await exigirCorretor();
  const dados = unidadeEntradaSchema.parse(input);
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("unidades")
    .update({
      identificador: dados.identificador,
      andar: dados.andar ?? null,
      posicao: dados.posicao ?? null,
      valor: dados.valor,
      status: dados.status,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`atualizarUnidade: ${error?.message ?? "sem retorno"}`);
  }
  return mapUnidade(data);
}

export async function removerUnidade(id: string): Promise<void> {
  await exigirCorretor();
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("unidades").delete().eq("id", id);
  if (error) {
    throw new Error(`removerUnidade: ${error.message}`);
  }
}
