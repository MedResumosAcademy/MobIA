// Camada de dados das METAS da CENTRAL DE COMANDO. Módulo server-side (NÃO é
// "use server": exporta tipos além de funções async).
//
// ESCOPO/RLS: a sessão é usada via criarClienteServidor; a RLS multi-tenant de
// 0017 cuida do escopo (metas da própria org; escrita só gestor/admin). Aqui
// traduzimos um `escopo` de negócio ("org" = toda a org; "meu" = os negócios do
// corretor logado) num filtro explícito por corretor_id quando "meu". Para
// "org", a query vê o que a RLS permite (o gestor vê a org; o corretor só os
// seus — então "org" degrada com segurança para os seus dados).
//
// PROGRESSO é PURO: o ATUAL de cada tipo é agregado aqui a partir dos dados
// visíveis, e a fração/atingida vem de calcularProgressoMeta(@imobia/core).
// `hoje` (mês corrente) é derivado do relógio do servidor e passado ao filtro.
// Dinheiro em CENTAVOS; datas ISO; pt-BR.

import { calcularProgressoMeta } from "@imobia/core";
import {
  metaSchema,
  TIPOS_META,
  type Database,
  type MetaProgresso,
  type TipoMeta,
} from "@imobia/domain";
import { obterPerfil, obterSessao } from "@/lib/auth/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";

type LinhaMeta = Database["public"]["Tables"]["metas"]["Row"];

/** Escopo da central: toda a org (gestor) ou só os dados do corretor. */
export type EscopoMetas = "org" | "meu";

/** MetaProgresso + rótulo pt-BR pronto para a UI (ordem estável = TIPOS_META). */
export type MetaComProgresso = MetaProgresso & {
  /** Rótulo curto em pt-BR para exibição (a UI não conhece os tipos crus). */
  rotulo: string;
  /** `true` se o alvo é monetário (CENTAVOS) — a UI formata como R$. */
  monetaria: boolean;
};

/** Retorno tipado da Server Action de definição de meta. */
export type ResultadoDefinirMeta =
  | { ok: true; meta: MetaComProgresso }
  | { ok: false; erro: string };

/** Rótulos pt-BR de cada tipo de meta (vocabulário de exibição — vive na web). */
const ROTULOS_META: Record<TipoMeta, string> = {
  negocios_ganhos_mes: "Negócios ganhos no mês",
  valor_vendido_mes: "Valor vendido no mês",
  novos_negocios_mes: "Novos negócios no mês",
  leads_consentidos: "Leads consentidos",
};

/** Só `valor_vendido_mes` é monetária (CENTAVOS). */
const TIPOS_MONETARIOS: ReadonlySet<TipoMeta> = new Set(["valor_vendido_mes"]);

/** Início (inclusivo) do mês corrente em ISO — para filtrar `>= inicioMes`. */
function inicioDoMesIso(agora: Date = new Date()): string {
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1)).toISOString();
}

/** Coage o `tipo` cru do banco para TipoMeta; null se desconhecido. */
function coagirTipo(v: string): TipoMeta | null {
  return (TIPOS_META as readonly string[]).includes(v) ? (v as TipoMeta) : null;
}

/** Sessão + perfil de escrita de meta (gestor/admin). Lança se não autorizado. */
async function exigirGestor(): Promise<{ usuarioId: string; orgId: string }> {
  const sessao = await obterSessao();
  if (!sessao) {
    throw new Error("não autenticado");
  }
  const perfil = await obterPerfil(sessao.usuarioId);
  if (!perfil || (perfil.papel !== "gestor" && perfil.papel !== "admin") || !perfil.orgId) {
    throw new Error("sem permissão de gestor");
  }
  return { usuarioId: sessao.usuarioId, orgId: perfil.orgId };
}

/** Monta o MetaComProgresso a partir do alvo (meta) e do atual (agregado). */
function montarProgresso(tipo: TipoMeta, alvo: number, atual: number): MetaComProgresso {
  const { progresso, atingida } = calcularProgressoMeta(alvo, atual);
  return {
    tipo,
    alvo,
    atual,
    progresso,
    atingida,
    rotulo: ROTULOS_META[tipo],
    monetaria: TIPOS_MONETARIOS.has(tipo),
  };
}

/**
 * Agrega o valor ATUAL de cada tipo de meta a partir dos dados visíveis ao
 * usuário (a RLS já impôs o escopo; "meu" filtra por corretor da sessão):
 *   - negocios_ganhos_mes: negócios resultado='ganho' com fechado_em no mês;
 *   - valor_vendido_mes:   soma (CENTAVOS) do valor desses ganhos do mês;
 *   - novos_negocios_mes:  negócios criados no mês corrente;
 *   - leads_consentidos:   leads visíveis (já gateados por consentimento na RLS).
 */
async function agregarAtuais(
  supabase: Awaited<ReturnType<typeof criarClienteServidor>>,
  escopo: EscopoMetas,
  usuarioId: string,
): Promise<Record<TipoMeta, number>> {
  const inicioMes = inicioDoMesIso();

  // Negócios do escopo no mês: criados e/ou fechados como ganhos. Buscamos os
  // criados no mês (novos) e os ganhos com fechamento no mês num só ida-e-volta
  // por dimensão, mas mantemos duas queries para não misturar os recortes.
  let novosQuery = supabase
    .from("negocios")
    .select("id", { count: "exact", head: true })
    .gte("criado_em", inicioMes);

  let ganhosQuery = supabase
    .from("negocios")
    .select("valor")
    .eq("resultado", "ganho")
    .gte("fechado_em", inicioMes);

  let leadsQuery = supabase.from("leads").select("id", { count: "exact", head: true });

  if (escopo === "meu") {
    novosQuery = novosQuery.eq("corretor_id", usuarioId);
    ganhosQuery = ganhosQuery.eq("corretor_id", usuarioId);
    leadsQuery = leadsQuery.eq("corretor_id", usuarioId);
  }

  const [novos, ganhos, leads] = await Promise.all([novosQuery, ganhosQuery, leadsQuery]);

  if (novos.error) {
    throw new Error(`agregarAtuais(novos): ${novos.error.message}`);
  }
  if (ganhos.error) {
    throw new Error(`agregarAtuais(ganhos): ${ganhos.error.message}`);
  }
  if (leads.error) {
    throw new Error(`agregarAtuais(leads): ${leads.error.message}`);
  }

  let ganhosCount = 0;
  let valorVendido = 0;
  for (const g of ganhos.data ?? []) {
    ganhosCount += 1;
    valorVendido += g.valor ?? 0;
  }

  return {
    negocios_ganhos_mes: ganhosCount,
    valor_vendido_mes: valorVendido,
    novos_negocios_mes: novos.count ?? 0,
    leads_consentidos: leads.count ?? 0,
  };
}

/**
 * Metas da org com seu progresso no `escopo`. Carrega as metas visíveis (RLS),
 * agrega o ATUAL de cada tipo a partir dos dados visíveis e calcula progresso
 * via @imobia/core. Retorna SEMPRE os quatro tipos em ordem estável (TIPOS_META):
 * tipos sem meta definida saem com alvo=0 (progresso 0), mas com o atual real —
 * assim a UI mostra o número mesmo antes de o gestor definir o alvo.
 * Anônimo/cliente ⇒ tudo zerado (guard).
 */
export async function listarMetasComProgresso(escopo: EscopoMetas): Promise<MetaComProgresso[]> {
  const sessao = await obterSessao();
  if (!sessao) {
    return TIPOS_META.map((tipo) => montarProgresso(tipo, 0, 0));
  }

  const supabase = await criarClienteServidor();

  const [{ data: metas, error: erroMetas }, atuais] = await Promise.all([
    supabase.from("metas").select("tipo, alvo"),
    agregarAtuais(supabase, escopo, sessao.usuarioId),
  ]);

  if (erroMetas) {
    throw new Error(`listarMetasComProgresso: ${erroMetas.message}`);
  }

  // Alvo por tipo (última definição vence; UNIQUE(org_id,tipo) garante 1 por org).
  const alvoPorTipo = new Map<TipoMeta, number>();
  for (const m of metas ?? []) {
    const tipo = coagirTipo((m as Pick<LinhaMeta, "tipo" | "alvo">).tipo);
    if (tipo) {
      alvoPorTipo.set(tipo, (m as Pick<LinhaMeta, "alvo">).alvo);
    }
  }

  return TIPOS_META.map((tipo) => montarProgresso(tipo, alvoPorTipo.get(tipo) ?? 0, atuais[tipo]));
}

/**
 * Define (upsert) o ALVO de uma meta da org do gestor logado. org_id vem da
 * SESSÃO (nunca do input); só gestor/admin (exigirGestor + RLS de 0017). O
 * conflito em (org_id, tipo) atualiza o alvo existente. Retorna a meta já com o
 * progresso recalculado no escopo "org". Resultado tipado (ok/erro).
 */
export async function definirMeta(tipo: TipoMeta, alvo: number): Promise<ResultadoDefinirMeta> {
  let usuarioId: string;
  let orgId: string;
  try {
    ({ usuarioId, orgId } = await exigirGestor());
  } catch {
    return { ok: false, erro: "Sem permissão para definir metas." };
  }

  const parse = metaSchema.safeParse({ tipo, alvo });
  if (!parse.success) {
    return { ok: false, erro: "Meta inválida: informe um alvo inteiro não negativo." };
  }

  const supabase = await criarClienteServidor();
  const { error } = await supabase
    .from("metas")
    .upsert(
      { org_id: orgId, tipo: parse.data.tipo, alvo: parse.data.alvo, definido_por: usuarioId },
      { onConflict: "org_id,tipo" },
    )
    .select("tipo, alvo")
    .single();

  if (error) {
    return { ok: false, erro: "Não foi possível salvar a meta." };
  }

  const atuais = await agregarAtuais(supabase, "org", usuarioId);
  return { ok: true, meta: montarProgresso(parse.data.tipo, parse.data.alvo, atuais[parse.data.tipo]) };
}
