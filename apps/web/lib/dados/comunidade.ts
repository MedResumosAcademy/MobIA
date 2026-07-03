// Camada de dados + Server Actions da COMUNIDADE — feed NACIONAL e CROSS-ORG de
// profissionais (corretor/gestor/admin). Módulo server-side (NÃO é "use server"
// no topo: exporta TIPOS além de funções async, como negocios.ts/gestor.ts). As
// Server Actions de ESCRITA carregam a diretiva inline "use server" no corpo.
//
// ESCOPO/RLS: a RLS de 0018 cuida de tudo — as três tabelas (publicacoes,
// publicacao_curtidas, seguidores) são CROSS-ORG e exigem papel profissional; os
// INSERTs amarram autor/perfil/seguidor = auth.uid(). Aqui NÃO reforçamos escopo
// nas leituras: o que a query enxerga já está autorizado. Nas ESCRITAS o ator é
// SEMPRE a sessão (auth.uid()); nunca vem do input.
//
// IDENTIDADE DENORMALIZADA: nome/org/foto do autor vivem NA LINHA da publicação
// (preenchidos por trigger) e o ranking nacional sai da VIEW ranking_comunidade
// (owner-postgres, bypassa RLS). NUNCA joinamos perfis cross-org em runtime.
//
// PONTOS DO RANKING: calculados SEM streak (streakAtual=0) — o streak é uma
// métrica pessoal/temporal que exigiria varrer datas de todos; deixá-lo fora
// mantém o ranking justo e estável entre requisições. O streak entra apenas no
// MEU resumo (meuResumoComunidade).

import {
  calcularPontosComunidade,
  calcularStreak,
  faixaComunidade,
} from "@imobia/core";
import {
  publicarPostSchema,
  type Database,
  type TipoPublicacao,
  TIPOS_PUBLICACAO,
} from "@imobia/domain";
import { revalidatePath } from "next/cache";
import { obterSessao } from "@/lib/auth/sessao";
import { obterPapelEOrg } from "@/lib/dados/gestor";
import { criarClienteServidor } from "@/lib/supabase/server";

type LinhaPublicacao = Database["public"]["Tables"]["publicacoes"]["Row"];
type LinhaRanking = Database["public"]["Views"]["ranking_comunidade"]["Row"];

// --- Tipos de saída (camelCase, prontos para a UI) ---

/** Um post do feed, com identidade denormalizada do autor e flags do leitor. */
export type PostFeed = {
  id: string;
  autorId: string;
  autorNome: string;
  autorOrg: string | null;
  autorFotoUrl: string | null;
  conteudo: string;
  tipo: TipoPublicacao;
  /** Imóvel destacado (título derivado); null se sem imóvel ou fora do RLS. */
  imovel: { id: string; titulo: string } | null;
  curtidas: number;
  curtidoPorMim: boolean;
  souAutor: boolean;
  /** Eu (leitor) já sigo o autor deste post? (false quando sou o autor.) */
  seguindoAutor: boolean;
  criadoEm: string;
};

/** Uma linha do ranking NACIONAL (cross-org), já pontuada e posicionada. */
export type MembroRanking = {
  autorId: string;
  nome: string;
  org: string | null;
  fotoUrl: string | null;
  publicacoes: number;
  curtidasRecebidas: number;
  seguidores: number;
  pontos: number;
  posicao: number;
  souEu: boolean;
  seguindo: boolean;
};

/** Meu panorama na comunidade: pontos, faixa, streak e contadores. */
export type ResumoComunidade = {
  pontos: number;
  faixa: { nivel: number; titulo: string; proxima: number | null };
  streakAtual: number;
  streakRecorde: number;
  publicacoes: number;
  curtidasRecebidas: number;
  seguidores: number;
  seguindo: number;
};

/** Retorno padrão das Server Actions de escrita. */
export type ResultadoAcao = { ok: true } | { ok: false; erro: string };

// --- Helpers ---

/** Coage o `tipo` (coluna text no banco) para o enum de domínio. */
function coagirTipo(v: string): TipoPublicacao {
  return (TIPOS_PUBLICACAO as readonly string[]).includes(v)
    ? (v as TipoPublicacao)
    : "geral";
}

/** Título derivado do imóvel — espelha negocios.ts (imoveis não tem coluna). */
function tituloImovel(im: { tipo: string | null; cidade: string; uf: string }): string {
  const rotulos: Record<string, string> = {
    casa: "Casa",
    apartamento: "Apartamento",
    terreno: "Terreno",
  };
  const prefixo = im.tipo && rotulos[im.tipo] ? rotulos[im.tipo] : "Imóvel";
  return `${prefixo} em ${im.cidade}/${im.uf}`;
}

/** Papel + org do usuário logado, exigindo perfil PROFISSIONAL. null se não. */
async function contextoProfissional(): Promise<{ usuarioId: string } | null> {
  const contexto = await obterPapelEOrg();
  if (!contexto) {
    return null;
  }
  if (contexto.papel === "cliente") {
    return null;
  }
  const sessao = await obterSessao();
  if (!sessao) {
    return null;
  }
  return { usuarioId: sessao.usuarioId };
}

/** IDs dos perfis que EU sigo (seguidor_id = eu). Vazio se anônimo/erro. */
async function meusSeguidos(
  supabase: Awaited<ReturnType<typeof criarClienteServidor>>,
  usuarioId: string,
): Promise<Set<string>> {
  const { data } = await supabase
    .from("seguidores")
    .select("seguido_id")
    .eq("seguidor_id", usuarioId);
  return new Set((data ?? []).map((s) => s.seguido_id));
}

// --- Leitura (profissional logado; RLS impõe o escopo cross-org) ---

/**
 * Feed cross-org ordenado por criado_em desc (limite ~50). Marca `curtidoPorMim`
 * (cruzando com as MINHAS curtidas) e `souAutor` (autor_id === sessão). Resolve o
 * título do imóvel destacado por lookup em imoveis (pode falhar por RLS → null).
 * Anônimo/cliente ⇒ [].
 *
 * FILTROS (opcionais):
 *   - `apenasSeguindo`: só posts de quem eu sigo (autor_id in meus seguidos);
 *   - `autorId`: só posts de um autor específico.
 */
export async function listarFeed(opts?: {
  apenasSeguindo?: boolean;
  autorId?: string;
}): Promise<PostFeed[]> {
  const ctx = await contextoProfissional();
  if (!ctx) {
    return [];
  }
  const supabase = await criarClienteServidor();

  // Meus seguidos: sempre resolvidos (marcam `seguindoAutor` em cada card) e,
  // quando apenasSeguindo, também filtram o feed por autor.
  const seguidos = await meusSeguidos(supabase, ctx.usuarioId);
  if (opts?.apenasSeguindo && seguidos.size === 0) {
    return [];
  }

  let query = supabase
    .from("publicacoes")
    .select("*")
    .order("criado_em", { ascending: false })
    .limit(50);

  if (opts?.autorId) {
    query = query.eq("autor_id", opts.autorId);
  }
  if (opts?.apenasSeguindo) {
    query = query.in("autor_id", [...seguidos]);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`listarFeed: ${error.message}`);
  }
  const posts = (data ?? []) as LinhaPublicacao[];
  if (posts.length === 0) {
    return [];
  }

  // Minhas curtidas entre os posts carregados → flag curtidoPorMim.
  const ids = posts.map((p) => p.id);
  const { data: minhas } = await supabase
    .from("publicacao_curtidas")
    .select("publicacao_id")
    .eq("perfil_id", ctx.usuarioId)
    .in("publicacao_id", ids);
  const curtidos = new Set((minhas ?? []).map((c) => c.publicacao_id));

  // Títulos dos imóveis destacados (lookup em lote; RLS pode ocultar alguns).
  const imovelIds = [...new Set(posts.map((p) => p.imovel_id).filter((v): v is string => !!v))];
  const titulos = new Map<string, string>();
  if (imovelIds.length > 0) {
    const { data: imoveis } = await supabase
      .from("imoveis")
      .select("id, tipo, cidade, uf")
      .in("id", imovelIds);
    for (const im of imoveis ?? []) {
      titulos.set(im.id, tituloImovel(im));
    }
  }

  return posts.map((p) => {
    const titulo = p.imovel_id ? titulos.get(p.imovel_id) : undefined;
    return {
      id: p.id,
      autorId: p.autor_id,
      autorNome: p.autor_nome,
      autorOrg: p.autor_org,
      autorFotoUrl: p.autor_foto_url,
      conteudo: p.conteudo,
      tipo: coagirTipo(p.tipo),
      imovel: p.imovel_id && titulo ? { id: p.imovel_id, titulo } : null,
      curtidas: p.curtidas_count,
      curtidoPorMim: curtidos.has(p.id),
      souAutor: p.autor_id === ctx.usuarioId,
      seguindoAutor: seguidos.has(p.autor_id),
      criadoEm: p.criado_em,
    };
  });
}

/**
 * Ranking NACIONAL (cross-org) a partir da VIEW ranking_comunidade (owner-
 * postgres, bypassa RLS). Pontua via calcularPontosComunidade SEM streak
 * (streakAtual=0 — justo/estável), ordena por pontos desc, atribui posição
 * (1..n) e marca `souEu`/`seguindo`. Anônimo/cliente ⇒ [].
 */
export async function rankingNacional(limite = 50): Promise<MembroRanking[]> {
  const ctx = await contextoProfissional();
  if (!ctx) {
    return [];
  }
  const supabase = await criarClienteServidor();

  const { data, error } = await supabase.from("ranking_comunidade").select("*");
  if (error) {
    throw new Error(`rankingNacional: ${error.message}`);
  }
  const seguidos = await meusSeguidos(supabase, ctx.usuarioId);

  const linhas = ((data ?? []) as LinhaRanking[])
    .filter((r): r is LinhaRanking & { autor_id: string } => !!r.autor_id)
    .map((r) => {
      const publicacoes = r.publicacoes ?? 0;
      const curtidasRecebidas = r.curtidas_recebidas ?? 0;
      const seguidores = r.seguidores ?? 0;
      const pontos = calcularPontosComunidade({
        publicacoes,
        curtidasRecebidas,
        seguidores,
        streakAtual: 0,
      });
      return {
        autorId: r.autor_id,
        nome: r.autor_nome ?? "Corretor",
        org: r.autor_org,
        fotoUrl: r.autor_foto_url,
        publicacoes,
        curtidasRecebidas,
        seguidores,
        pontos,
        souEu: r.autor_id === ctx.usuarioId,
        seguindo: seguidos.has(r.autor_id),
      };
    });

  linhas.sort((a, b) => b.pontos - a.pontos || a.nome.localeCompare(b.nome, "pt-BR"));

  return linhas.slice(0, limite).map((linha, i) => ({ ...linha, posicao: i + 1 }));
}

/**
 * MEU panorama na comunidade: publicações, curtidas recebidas (soma de
 * curtidas_count dos meus posts), seguidores (seguido_id=eu), seguindo
 * (seguidor_id=eu), streak (calcularStreak sobre as datas dos meus posts) e a
 * faixa (faixaComunidade). Sem sessão/não-profissional ⇒ resumo ZERADO.
 */
export async function meuResumoComunidade(): Promise<ResumoComunidade> {
  const zerado: ResumoComunidade = {
    pontos: 0,
    faixa: faixaComunidade(0),
    streakAtual: 0,
    streakRecorde: 0,
    publicacoes: 0,
    curtidasRecebidas: 0,
    seguidores: 0,
    seguindo: 0,
  };

  const ctx = await contextoProfissional();
  if (!ctx) {
    return zerado;
  }
  const supabase = await criarClienteServidor();

  const [meusPosts, seguidores, seguindo] = await Promise.all([
    supabase
      .from("publicacoes")
      .select("curtidas_count, criado_em")
      .eq("autor_id", ctx.usuarioId),
    supabase
      .from("seguidores")
      .select("seguidor_id", { count: "exact", head: true })
      .eq("seguido_id", ctx.usuarioId),
    supabase
      .from("seguidores")
      .select("seguido_id", { count: "exact", head: true })
      .eq("seguidor_id", ctx.usuarioId),
  ]);

  if (meusPosts.error) {
    throw new Error(`meuResumoComunidade(posts): ${meusPosts.error.message}`);
  }

  const posts = meusPosts.data ?? [];
  const publicacoes = posts.length;
  const curtidasRecebidas = posts.reduce((soma, p) => soma + (p.curtidas_count ?? 0), 0);
  const seguidoresTotal = seguidores.count ?? 0;
  const seguindoTotal = seguindo.count ?? 0;

  const streak = calcularStreak(
    posts.map((p) => p.criado_em),
    new Date().toISOString(),
  );
  const pontos = calcularPontosComunidade({
    publicacoes,
    curtidasRecebidas,
    seguidores: seguidoresTotal,
    streakAtual: streak.atual,
  });

  return {
    pontos,
    faixa: faixaComunidade(pontos),
    streakAtual: streak.atual,
    streakRecorde: streak.recorde,
    publicacoes,
    curtidasRecebidas,
    seguidores: seguidoresTotal,
    seguindo: seguindoTotal,
  };
}

// --- Escrita (Server Actions; ator = SESSÃO/auth.uid(); revalida /comunidade) ---

/**
 * Publica um post no feed. Valida com publicarPostSchema (@imobia/domain) e exige
 * papel profissional (obterPapelEOrg). NÃO envia autor_nome/org/foto (o trigger
 * denormaliza); envia autor_id=sessão apenas p/ satisfazer o NOT NULL/policy — o
 * trigger força auth.uid(). Revalida /comunidade. Retorno tipado.
 */
export async function publicarPostAction(input: unknown): Promise<ResultadoAcao> {
  "use server";
  const contexto = await obterPapelEOrg();
  if (!contexto || contexto.papel === "cliente") {
    return { ok: false, erro: "Apenas profissionais podem publicar na comunidade." };
  }
  const sessao = await obterSessao();
  if (!sessao) {
    return { ok: false, erro: "Sessão expirada. Faça login novamente." };
  }

  const parsed = publicarPostSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: "Conteúdo inválido. Verifique o texto e o tipo." };
  }
  const { conteudo, tipo, imovelId } = parsed.data;

  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("publicacoes").insert({
    // autor_id enviado só p/ o NOT NULL/policy; o trigger sobrescreve com auth.uid().
    autor_id: sessao.usuarioId,
    autor_nome: "", // preenchido pelo trigger publicacoes_preencher_autor.
    conteudo,
    tipo,
    imovel_id: imovelId ?? null,
  });
  if (error) {
    return { ok: false, erro: "Não foi possível publicar. Tente novamente." };
  }

  revalidatePath("/comunidade");
  return { ok: true };
}

/**
 * Curte um post (perfil_id = auth.uid()). Idempotente: duplicata é ignorada como
 * sucesso. Revalida /comunidade. Retorno tipado.
 */
export async function curtirAction(postId: string): Promise<ResultadoAcao> {
  "use server";
  const sessao = await obterSessao();
  const contexto = await obterPapelEOrg();
  if (!sessao || !contexto || contexto.papel === "cliente") {
    return { ok: false, erro: "Apenas profissionais podem curtir." };
  }

  const supabase = await criarClienteServidor();
  const { error } = await supabase
    .from("publicacao_curtidas")
    .insert({ publicacao_id: postId, perfil_id: sessao.usuarioId });
  // 23505 = unique_violation → já curtido; idempotente.
  if (error && error.code !== "23505") {
    return { ok: false, erro: "Não foi possível curtir. Tente novamente." };
  }

  revalidatePath("/comunidade");
  return { ok: true };
}

/**
 * Remove a curtida (perfil_id = auth.uid()). Idempotente: ausência é sucesso.
 * Revalida /comunidade. Retorno tipado.
 */
export async function descurtirAction(postId: string): Promise<ResultadoAcao> {
  "use server";
  const sessao = await obterSessao();
  const contexto = await obterPapelEOrg();
  if (!sessao || !contexto || contexto.papel === "cliente") {
    return { ok: false, erro: "Apenas profissionais podem descurtir." };
  }

  const supabase = await criarClienteServidor();
  const { error } = await supabase
    .from("publicacao_curtidas")
    .delete()
    .eq("publicacao_id", postId)
    .eq("perfil_id", sessao.usuarioId);
  if (error) {
    return { ok: false, erro: "Não foi possível remover a curtida." };
  }

  revalidatePath("/comunidade");
  return { ok: true };
}

/**
 * Segue um perfil (seguidor_id = auth.uid()). Rejeita seguir a si mesmo.
 * Idempotente: duplicata é sucesso. Revalida /comunidade. Retorno tipado.
 */
export async function seguirAction(perfilId: string): Promise<ResultadoAcao> {
  "use server";
  const sessao = await obterSessao();
  const contexto = await obterPapelEOrg();
  if (!sessao || !contexto || contexto.papel === "cliente") {
    return { ok: false, erro: "Apenas profissionais podem seguir." };
  }
  if (perfilId === sessao.usuarioId) {
    return { ok: false, erro: "Você não pode seguir a si mesmo." };
  }

  const supabase = await criarClienteServidor();
  const { error } = await supabase
    .from("seguidores")
    .insert({ seguido_id: perfilId, seguidor_id: sessao.usuarioId });
  if (error && error.code !== "23505") {
    return { ok: false, erro: "Não foi possível seguir. Tente novamente." };
  }

  revalidatePath("/comunidade");
  return { ok: true };
}

/**
 * Deixa de seguir um perfil (seguidor_id = auth.uid()). Idempotente: ausência é
 * sucesso. Revalida /comunidade. Retorno tipado.
 */
export async function deixarDeSeguirAction(perfilId: string): Promise<ResultadoAcao> {
  "use server";
  const sessao = await obterSessao();
  const contexto = await obterPapelEOrg();
  if (!sessao || !contexto || contexto.papel === "cliente") {
    return { ok: false, erro: "Apenas profissionais podem deixar de seguir." };
  }

  const supabase = await criarClienteServidor();
  const { error } = await supabase
    .from("seguidores")
    .delete()
    .eq("seguido_id", perfilId)
    .eq("seguidor_id", sessao.usuarioId);
  if (error) {
    return { ok: false, erro: "Não foi possível deixar de seguir." };
  }

  revalidatePath("/comunidade");
  return { ok: true };
}
