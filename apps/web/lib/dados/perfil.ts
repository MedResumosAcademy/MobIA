// Camada de dados + Server Actions do PERFIL DO CORRETOR (vitrine social /
// gamificação). Módulo server-side ("use server": só exporta funções async, que
// são apagadas na compilação — mesmo padrão de gestor.ts).
//
// ESCOPO/RLS: a sessão é usada via criarClienteServidor; a RLS multi-tenant do
// 0015 cuida do escopo. Leituras enxergam só o que a org permite (perfil de
// outra org ⇒ query vazia ⇒ retornamos null). As ESCRITAS derivam o alvo da
// SESSÃO (usuario_id = auth.uid()) e limitam explicitamente os campos gravados
// (a policy de UPDATE não restringe colunas: NUNCA repassamos creci/org_id).
//
// GAMIFICAÇÃO: a math é PURA e vive em @imobia/core (calcularGamificacao). Aqui
// só agregamos os stats do corretor e delegamos. Dinheiro em CENTAVOS. pt-BR.

"use server";

import { calcularGamificacao, type ResultadoGamificacao } from "@imobia/core";
import {
  depoimentoSchema,
  perfilPublicoCamposSchema,
  type Papel,
} from "@imobia/domain";
import { obterPerfil, obterSessao } from "@/lib/auth/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";

// --- Tipos de saída (camelCase, prontos para a UI) ---

export type StatsCorretor = {
  negociosGanhos: number;
  /** Soma dos valores dos negócios ganhos, em CENTAVOS. */
  valorVendido: number;
  /** ganhos / (ganhos + perdidos), fração 0..1 (0 se sem fechados). */
  taxaConversao: number;
  /** Imóveis sob responsabilidade (corretor_responsavel_id). */
  imoveis: number;
  /**
   * Posição no ranking da org por valor vendido (1 = maior). null quando não
   * calculável (ex.: perfil de outra org, sem acesso aos negócios da org).
   */
  rankingPosicao: number | null;
};

export type VendaHistorico = {
  negocioId: string;
  contato: string;
  imovelTitulo: string | null;
  valor: number | null;
  fechadoEm: string | null;
};

export type DepoimentoPerfil = {
  id: string;
  autorNome: string;
  autorRelacao: string | null;
  nota: number | null;
  texto: string;
  criadoEm: string;
};

export type PerfilCorretor = {
  corretorId: string;
  nome: string | null;
  papel: Papel;
  orgNome: string | null;
  creci: string | null;
  bio: string | null;
  fotoUrl: string | null;
  /** Consentimento de exibição da foto (onboarding). Sem ele, a UI mostra iniciais. */
  permitirFoto: boolean;
  /** Vendas DECLARADAS no onboarding (CENTAVOS) — separadas dos stats verificados. */
  vendasPreviasValor: number | null;
  vendasPreviasQtd: number | null;
  capaUrl: string | null;
  telefone: string | null;
  cidade: string | null;
  instagram: string | null;
  /** perfis.criado_em (ISO). */
  membroDesde: string | null;
  /** true quando o perfil é o do próprio usuário logado. */
  ehProprio: boolean;
  stats: StatsCorretor;
  gamificacao: ResultadoGamificacao;
  historicoVendas: VendaHistorico[];
  depoimentos: DepoimentoPerfil[];
};

export type ResultadoAcao = { ok: true } | { ok: false; erro: string };

// --- Helpers ---

/** Sessão + perfil de escrita (corretor/gestor). Lança se não autorizado. */
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

/** Título derivado do imóvel — espelha negocios.ts/imoveis.ts (sem coluna própria). */
function tituloImovel(
  im: { tipo: string | null; cidade: string; uf: string } | null,
): string | null {
  if (!im) {
    return null;
  }
  const rotulos: Record<string, string> = {
    casa: "Casa",
    apartamento: "Apartamento",
    terreno: "Terreno",
  };
  const prefixo = im.tipo && rotulos[im.tipo] ? rotulos[im.tipo] : "Imóvel";
  return `${prefixo} em ${im.cidade}/${im.uf}`;
}

function coagirPapel(v: string | null): Papel {
  return v === "corretor" || v === "gestor" || v === "admin" ? v : "cliente";
}

/**
 * Posição do corretor no ranking de valor vendido da org. Reduz a linha de
 * negócios ganhos (visíveis pela RLS) a totais por corretor e ordena desc.
 * null se o corretor-alvo não aparece (sem negócios ganhos visíveis) — deixa a
 * UI decidir se exibe ranking.
 */
function calcularRanking(
  ganhosPorCorretor: Map<string, number>,
  corretorId: string,
): number | null {
  if (!ganhosPorCorretor.has(corretorId)) {
    return null;
  }
  const ordenados = [...ganhosPorCorretor.entries()].sort((a, b) => b[1] - a[1]);
  const idx = ordenados.findIndex(([id]) => id === corretorId);
  return idx >= 0 ? idx + 1 : null;
}

// --- Leitura (RLS impõe org; perfil de outra org ⇒ null) ---

/**
 * Perfil completo do corretor para a vitrine/gamificação. Se `corretorId` for
 * omitido, usa a sessão (o próprio perfil). Retorna null quando não autenticado
 * (e sem alvo), quando o alvo não é visível (outra org / não existe) ou não é
 * corretor/gestor. A RLS já limita o que cada query enxerga; aqui só agregamos.
 */
export async function obterPerfilCorretor(
  corretorId?: string,
): Promise<PerfilCorretor | null> {
  const sessao = await obterSessao();
  const alvo = corretorId ?? sessao?.usuarioId;
  if (!alvo) {
    return null;
  }

  const supabase = await criarClienteServidor();

  // Perfil base (RLS de perfis: mesma org do logado; próprio sempre visível).
  const { data: perfil, error: erroPerfil } = await supabase
    .from("perfis")
    .select("id, nome, papel, org_id, criado_em")
    .eq("id", alvo)
    .maybeSingle();
  if (erroPerfil) {
    throw new Error(`obterPerfilCorretor(perfil): ${erroPerfil.message}`);
  }
  if (!perfil) {
    return null; // fora do escopo (outra org) ou inexistente
  }
  const papel = coagirPapel(perfil.papel);
  if (papel !== "corretor" && papel !== "gestor") {
    return null; // só perfis operacionais têm vitrine
  }

  // Dados públicos do corretor + nome da org + negócios + imóveis + depoimentos.
  const [
    { data: corretorProfile, error: erroCp },
    { data: negocios, error: erroNeg },
    { data: imoveis, error: erroImo },
    { data: depoimentos, error: erroDep },
    { data: org },
  ] = await Promise.all([
    supabase
      .from("corretor_profiles")
      .select(
        "creci, bio, foto_url, capa_url, telefone, cidade, instagram, permitir_foto, vendas_previas_valor, vendas_previas_qtd",
      )
      .eq("usuario_id", alvo)
      .maybeSingle(),
    // Negócios da org visíveis (RLS): usados p/ stats do alvo + ranking da org.
    supabase
      .from("negocios")
      .select(
        "id, corretor_id, resultado, valor, fechado_em, nome_contato, imovel:imoveis(tipo, cidade, uf)",
      ),
    supabase.from("imoveis").select("id").eq("corretor_responsavel_id", alvo),
    supabase
      .from("depoimentos")
      .select("id, autor_nome, autor_relacao, nota, texto, criado_em")
      .eq("corretor_id", alvo)
      .order("criado_em", { ascending: false }),
    perfil.org_id
      ? supabase.from("organizacoes").select("nome").eq("id", perfil.org_id).maybeSingle()
      : Promise.resolve({ data: null as { nome: string } | null }),
  ]);

  if (erroCp) {
    throw new Error(`obterPerfilCorretor(corretor_profiles): ${erroCp.message}`);
  }
  if (erroNeg) {
    throw new Error(`obterPerfilCorretor(negocios): ${erroNeg.message}`);
  }
  if (erroImo) {
    throw new Error(`obterPerfilCorretor(imoveis): ${erroImo.message}`);
  }
  if (erroDep) {
    throw new Error(`obterPerfilCorretor(depoimentos): ${erroDep.message}`);
  }

  // Agrega stats do alvo e o ranking da org a partir dos negócios visíveis.
  const ganhosPorCorretor = new Map<string, number>(); // valor vendido por corretor
  let negociosGanhos = 0;
  let valorVendido = 0;
  let fechados = 0; // ganho + perdido do alvo
  const historicoVendas: VendaHistorico[] = [];

  for (const n of negocios ?? []) {
    if (n.resultado === "ganho") {
      const atual = ganhosPorCorretor.get(n.corretor_id) ?? 0;
      ganhosPorCorretor.set(n.corretor_id, atual + (n.valor ?? 0));
    }
    if (n.corretor_id !== alvo) {
      continue;
    }
    if (n.resultado === "ganho" || n.resultado === "perdido") {
      fechados += 1;
    }
    if (n.resultado === "ganho") {
      negociosGanhos += 1;
      valorVendido += n.valor ?? 0;
      const imovel = n.imovel as { tipo: string | null; cidade: string; uf: string } | null;
      historicoVendas.push({
        negocioId: n.id,
        contato: n.nome_contato,
        imovelTitulo: tituloImovel(imovel),
        valor: n.valor,
        fechadoEm: n.fechado_em,
      });
    }
  }

  historicoVendas.sort((a, b) => {
    const av = a.fechadoEm ?? "";
    const bv = b.fechadoEm ?? "";
    return bv.localeCompare(av); // desc por fechado_em
  });

  const taxaConversao = fechados > 0 ? negociosGanhos / fechados : 0;
  const stats: StatsCorretor = {
    negociosGanhos,
    valorVendido,
    taxaConversao,
    imoveis: (imoveis ?? []).length,
    rankingPosicao: calcularRanking(ganhosPorCorretor, alvo),
  };

  const gamificacao = calcularGamificacao({
    negociosGanhos,
    valorVendido,
    taxaConversao,
  });

  return {
    corretorId: alvo,
    nome: perfil.nome ?? null,
    papel,
    orgNome: org?.nome ?? null,
    creci: corretorProfile?.creci ?? null,
    bio: corretorProfile?.bio ?? null,
    // Consentimento: sem permitir_foto, a URL da foto NÃO sai da camada de
    // dados (nem no payload RSC) — exceto para o dono, que precisa dela para
    // pré-preencher a edição do próprio perfil.
    fotoUrl:
      (corretorProfile?.permitir_foto ?? false) || alvo === sessao?.usuarioId
        ? (corretorProfile?.foto_url ?? null)
        : null,
    permitirFoto: corretorProfile?.permitir_foto ?? false,
    vendasPreviasValor: corretorProfile?.vendas_previas_valor ?? null,
    vendasPreviasQtd: corretorProfile?.vendas_previas_qtd ?? null,
    capaUrl: corretorProfile?.capa_url ?? null,
    telefone: corretorProfile?.telefone ?? null,
    cidade: corretorProfile?.cidade ?? null,
    instagram: corretorProfile?.instagram ?? null,
    membroDesde: perfil.criado_em ?? null,
    ehProprio: alvo === sessao?.usuarioId,
    stats,
    gamificacao,
    historicoVendas,
    depoimentos: (depoimentos ?? []).map((d) => ({
      id: d.id,
      autorNome: d.autor_nome,
      autorRelacao: d.autor_relacao ?? null,
      nota: d.nota ?? null,
      texto: d.texto,
      criadoEm: d.criado_em,
    })),
  };
}

// --- Escrita (Server Actions) ---

/**
 * Atualiza os campos PÚBLICOS do próprio perfil (usuario_id = auth.uid()). Só
 * corretor/gestor. Limita explicitamente os campos gravados (a policy de UPDATE
 * não restringe colunas: creci/org_id NUNCA são repassados). Valida o formato
 * com perfilPublicoCamposSchema (@imobia/domain). Retorna resultado tipado.
 */
export async function atualizarMeuPerfil(campos: {
  bio?: string;
  telefone?: string;
  cidade?: string;
  instagram?: string;
  fotoUrl?: string;
  capaUrl?: string;
}): Promise<ResultadoAcao> {
  let usuarioId: string;
  try {
    ({ usuarioId } = await exigirCorretor());
  } catch {
    return { ok: false, erro: "Sem permissão para editar o perfil." };
  }

  const parsed = perfilPublicoCamposSchema.safeParse(campos);
  if (!parsed.success) {
    return { ok: false, erro: "Dados do perfil inválidos." };
  }
  const c = parsed.data;

  // Só as colunas públicas — anti-forja de creci/org_id (a policy não filtra).
  const patch: {
    bio?: string;
    telefone?: string;
    cidade?: string;
    instagram?: string;
    foto_url?: string;
    capa_url?: string;
  } = {};
  if (c.bio !== undefined) patch.bio = c.bio;
  if (c.telefone !== undefined) patch.telefone = c.telefone;
  if (c.cidade !== undefined) patch.cidade = c.cidade;
  if (c.instagram !== undefined) patch.instagram = c.instagram;
  if (c.fotoUrl !== undefined) patch.foto_url = c.fotoUrl;
  if (c.capaUrl !== undefined) patch.capa_url = c.capaUrl;

  if (Object.keys(patch).length === 0) {
    return { ok: true };
  }

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("corretor_profiles")
    .update(patch)
    .eq("usuario_id", usuarioId)
    .select("usuario_id")
    .maybeSingle();

  if (error) {
    return { ok: false, erro: "Não foi possível salvar o perfil." };
  }
  if (!data) {
    return { ok: false, erro: "Perfil não encontrado." };
  }
  return { ok: true };
}

/**
 * Adiciona um depoimento a um corretor. O org_id é preenchido pelo trigger
 * (anti-forja); aqui NÃO o enviamos. Só corretor/gestor. Valida com
 * depoimentoSchema (@imobia/domain). A RLS de insert garante mesma org.
 */
export async function adicionarDepoimento(
  corretorId: string,
  dados: { autorNome: string; autorRelacao?: string; nota?: number; texto: string },
): Promise<ResultadoAcao> {
  try {
    await exigirCorretor();
  } catch {
    return { ok: false, erro: "Sem permissão para adicionar depoimentos." };
  }

  const parsed = depoimentoSchema.safeParse({ corretorId, ...dados });
  if (!parsed.success) {
    return { ok: false, erro: "Depoimento inválido." };
  }
  const d = parsed.data;

  const supabase = await criarClienteServidor();
  // NÃO enviamos org_id: o trigger BEFORE INSERT (depoimentos_preencher_org)
  // o preenche a partir de perfis.org_id do corretor-alvo (anti-forja). Enviar
  // "" quebraria o bind do PostgREST (22P02) ANTES do trigger. O Insert type
  // exige org_id, mas a coluna é populada pelo trigger — omitimos via cast.
  const linha = {
    corretor_id: d.corretorId,
    autor_nome: d.autorNome,
    autor_relacao: d.autorRelacao ?? null,
    nota: d.nota ?? null,
    texto: d.texto,
  };
  const { error } = await supabase
    .from("depoimentos")
    .insert(linha as typeof linha & { org_id: string });

  if (error) {
    return { ok: false, erro: "Não foi possível adicionar o depoimento." };
  }
  return { ok: true };
}

/**
 * Remove um depoimento por id. A RLS (policy delete) garante que só quem tem
 * acesso (mesma org / próprio corretor) consegue apagar. Só corretor/gestor.
 */
export async function removerDepoimento(id: string): Promise<ResultadoAcao> {
  try {
    await exigirCorretor();
  } catch {
    return { ok: false, erro: "Sem permissão para remover depoimentos." };
  }

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("depoimentos")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false, erro: "Não foi possível remover o depoimento." };
  }
  if (!data) {
    return { ok: false, erro: "Depoimento não encontrado ou fora do seu acesso." };
  }
  return { ok: true };
}
