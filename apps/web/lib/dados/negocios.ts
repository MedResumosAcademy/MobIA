// Camada de dados do FUNIL DE NEGÓCIOS (CRM) do corretor/gestor. Módulo
// server-side (NÃO é "use server": exporta tipos/schemas além de funções
// async). Usado por Server Components e ações da área /corretor.
//
// ESCOPO/RLS: a RLS de 0011 cuida de tudo — corretor vê/edita só os SEUS
// negócios; gestor/admin, qualquer da própria org. Aqui NÃO reforçamos escopo
// por conta própria nas leituras: o que a query enxerga já está autorizado.
// As ESCRITAS derivam org_id/corretor_id da SESSÃO (nunca do input) e exigem
// papel corretor/gestor (exigirCorretor).
//
// TERMÔMETRO: quando um negócio está ligado a um lead, a temperatura vem SEMPRE
// do motor puro (@imobia/core) a partir dos contadores da linha do lead —
// NUNCA da coluna `temperatura`. Dinheiro em CENTAVOS. pt-BR.

import { calcularTemperatura, resumoFunil, type ResumoFunil } from "@imobia/core";
import {
  etapaNegocioSchema,
  resultadoNegocioSchema,
  tipoAtividadeSchema,
  type Database,
  type EtapaNegocio,
  type ResultadoNegocio,
  type Temperatura,
  type TipoAtividade,
} from "@imobia/domain";
import { z } from "zod";
import { obterPerfil, obterSessao } from "@/lib/auth/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";

type LinhaNegocio = Database["public"]["Tables"]["negocios"]["Row"];
type LinhaAtividade = Database["public"]["Tables"]["negocio_atividades"]["Row"];
type LinhaLead = Database["public"]["Tables"]["leads"]["Row"];
type InsertNegocio = Database["public"]["Tables"]["negocios"]["Insert"];

// --- Tipos de saída (camelCase, prontos para a UI) ---

/** Uma linha do funil: negócio + título do imóvel + temperatura do lead. */
export type NegocioResumo = {
  id: string;
  corretorId: string;
  clienteId: string | null;
  leadId: string | null;
  imovelId: string | null;
  nomeContato: string;
  telefoneContato: string | null;
  emailContato: string | null;
  etapa: EtapaNegocio;
  resultado: ResultadoNegocio | null;
  motivoPerda: string | null;
  valor: number | null;
  origem: string | null;
  /** Título derivado do imóvel vinculado (o banco não tem coluna de título). */
  imovelTitulo: string | null;
  /** Temperatura calculada do lead vinculado (@imobia/core); null se sem lead. */
  temperatura: Temperatura | null;
  criadoEm: string;
  atualizadoEm: string | null;
  fechadoEm: string | null;
};

/** Um item da timeline de um negócio. */
export type AtividadeNegocio = {
  id: string;
  tipo: TipoAtividade;
  descricao: string;
  autorId: string | null;
  criadoEm: string;
};

/** Negócio + timeline (cronológica) + dados enriquecidos do imóvel/cliente. */
export type NegocioDetalhe = {
  negocio: NegocioResumo;
  timeline: AtividadeNegocio[];
  clienteNome: string | null;
};

// --- Schemas de entrada (anti-forja: org_id/corretor NUNCA vêm do form) ---

// Entrada de criação: derivada do domínio (negocioSchema), mas expondo os
// campos de contato como estão no banco (nome/telefone/email separados) e SEM
// os campos derivados da sessão/servidor (id/orgId/corretorId/timestamps).
export const negocioEntradaSchema = z
  .object({
    etapa: etapaNegocioSchema.default("novo"),
    nomeContato: z.string().min(1),
    telefoneContato: z.string().min(1).nullable().optional(),
    emailContato: z.string().email().nullable().optional(),
    clienteId: z.string().uuid().nullable().optional(),
    leadId: z.string().uuid().nullable().optional(),
    imovelId: z.string().uuid().nullable().optional(),
    unidadeId: z.string().uuid().nullable().optional(),
    valor: z.number().int().nonnegative().nullable().optional(),
    origem: z.string().min(1).nullable().optional(),
  })
  .strict();

export type NegocioEntrada = z.input<typeof negocioEntradaSchema>;

// --- Helpers de coerção de enums vindos do banco (colunas text) ---

function coagirEtapa(v: string): EtapaNegocio {
  const r = etapaNegocioSchema.safeParse(v);
  return r.success ? r.data : "novo";
}

function coagirResultado(v: string | null): ResultadoNegocio | null {
  if (v === null) {
    return null;
  }
  const r = resultadoNegocioSchema.safeParse(v);
  return r.success ? r.data : null;
}

function coagirTipoAtividade(v: string): TipoAtividade {
  const r = tipoAtividadeSchema.safeParse(v);
  return r.success ? r.data : "nota";
}

/** Título derivado do imóvel — espelha leads.ts/imoveis.ts (sem coluna própria). */
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

/** Contadores da linha do lead → temperatura calculada no motor puro. */
function temperaturaDoLead(l: {
  visitas: number;
  simulacoes: number;
  favoritos: number;
  cliques_financiamento: number;
  retornos: number;
}): Temperatura {
  return calcularTemperatura({
    visitas: l.visitas,
    simulacoes: l.simulacoes,
    favoritos: l.favoritos,
    cliquesFinanciamento: l.cliques_financiamento,
    retornos: l.retornos,
  }).temperatura;
}

type LeadTermometro = Pick<
  LinhaLead,
  "visitas" | "simulacoes" | "favoritos" | "cliques_financiamento" | "retornos"
>;

function mapNegocioResumo(
  n: LinhaNegocio,
  imovel: { tipo: string | null; cidade: string; uf: string } | null,
  lead: LeadTermometro | null,
): NegocioResumo {
  return {
    id: n.id,
    corretorId: n.corretor_id,
    clienteId: n.cliente_id,
    leadId: n.lead_id,
    imovelId: n.imovel_id,
    nomeContato: n.nome_contato,
    telefoneContato: n.telefone_contato,
    emailContato: n.email_contato,
    etapa: coagirEtapa(n.etapa),
    resultado: coagirResultado(n.resultado),
    motivoPerda: n.motivo_perda,
    valor: n.valor,
    origem: n.origem,
    imovelTitulo: tituloImovel(imovel),
    temperatura: lead ? temperaturaDoLead(lead) : null,
    criadoEm: n.criado_em,
    atualizadoEm: n.atualizado_em,
    fechadoEm: n.fechado_em,
  };
}

function mapAtividade(a: LinhaAtividade): AtividadeNegocio {
  return {
    id: a.id,
    tipo: coagirTipoAtividade(a.tipo),
    descricao: a.descricao,
    autorId: a.autor_id,
    criadoEm: a.criado_em,
  };
}

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

// Colunas do join usadas para enriquecer negócios (imóvel + lead p/ termômetro).
const SELECT_ENRIQUECIDO =
  "*, imovel:imoveis(tipo, cidade, uf), lead:leads(visitas, simulacoes, favoritos, cliques_financiamento, retornos)";

type LinhaEnriquecida = LinhaNegocio & {
  imovel: { tipo: string | null; cidade: string; uf: string } | null;
  lead: LeadTermometro | null;
};

function separarEnriquecida(linha: LinhaEnriquecida): NegocioResumo {
  const { imovel, lead, ...n } = linha;
  return mapNegocioResumo(n, imovel, lead);
}

// --- Leitura (corretor/gestor logado; RLS impõe escopo) ---

/**
 * Negócios visíveis ao usuário logado (corretor: os seus; gestor/admin: da org),
 * enriquecidos com título do imóvel vinculado e temperatura do lead vinculado.
 * Ordenados por atualizado_em/criado_em desc. Anônimo/cliente recebe [] (guard).
 */
export async function listarNegocios(): Promise<NegocioResumo[]> {
  const sessao = await obterSessao();
  if (!sessao) {
    return [];
  }
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("negocios")
    .select(SELECT_ENRIQUECIDO)
    .order("atualizado_em", { ascending: false, nullsFirst: false })
    .order("criado_em", { ascending: false });
  if (error) {
    throw new Error(`listarNegocios: ${error.message}`);
  }
  return (data ?? []).map((linha) => separarEnriquecida(linha as LinhaEnriquecida));
}

/**
 * Um negócio + sua TIMELINE (cronológica) + nome do cliente vinculado. Retorna
 * null se o negócio não é visível (RLS) ou não existe.
 */
export async function obterNegocio(id: string): Promise<NegocioDetalhe | null> {
  const sessao = await obterSessao();
  if (!sessao) {
    return null;
  }
  const supabase = await criarClienteServidor();

  const { data: linha, error } = await supabase
    .from("negocios")
    .select(`${SELECT_ENRIQUECIDO}, cliente:perfis!negocios_cliente_id_fkey(nome)`)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw new Error(`obterNegocio: ${error.message}`);
  }
  if (!linha) {
    return null;
  }
  const { cliente, ...resto } = linha as LinhaEnriquecida & {
    cliente: { nome: string | null } | null;
  };
  const negocio = separarEnriquecida(resto);

  const { data: atividades, error: erroAtividades } = await supabase
    .from("negocio_atividades")
    .select("*")
    .eq("negocio_id", id)
    .order("criado_em", { ascending: true });
  if (erroAtividades) {
    throw new Error(`obterNegocio(timeline): ${erroAtividades.message}`);
  }

  return {
    negocio,
    timeline: (atividades ?? []).map(mapAtividade),
    clienteNome: cliente?.nome ?? null,
  };
}

// --- Escrita (org_id/corretor_id da SESSÃO; exige corretor/gestor) ---

/**
 * Insere uma atividade na timeline de um negócio (autor = usuário da sessão).
 * A org_id é derivada pelo trigger do 0011 (anti-forja). Exige corretor/gestor.
 */
export async function adicionarAtividade(
  negocioId: string,
  tipo: TipoAtividade,
  descricao: string,
): Promise<AtividadeNegocio> {
  const { usuarioId, orgId } = await exigirCorretor();
  const t = tipoAtividadeSchema.parse(tipo);
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("negocio_atividades")
    // org_id é sobrescrita pelo trigger; enviamos a da sessão p/ satisfazer o
    // NOT NULL e a policy de INSERT (with check org_id = org_atual()).
    .insert({ negocio_id: negocioId, org_id: orgId, autor_id: usuarioId, tipo: t, descricao })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`adicionarAtividade: ${error?.message ?? "sem retorno"}`);
  }
  return mapAtividade(data);
}

// Insert base a partir da entrada validada (sem tocar org/corretor — derivados).
function entradaParaInsert(
  input: z.infer<typeof negocioEntradaSchema>,
  orgId: string,
  corretorId: string,
): InsertNegocio {
  return {
    org_id: orgId,
    corretor_id: corretorId,
    etapa: input.etapa,
    nome_contato: input.nomeContato,
    telefone_contato: input.telefoneContato ?? null,
    email_contato: input.emailContato ?? null,
    cliente_id: input.clienteId ?? null,
    lead_id: input.leadId ?? null,
    imovel_id: input.imovelId ?? null,
    unidade_id: input.unidadeId ?? null,
    valor: input.valor ?? null,
    origem: input.origem ?? null,
  };
}

// Insere um negócio + registra atividade 'criacao'. Não valida/escopa aqui:
// quem chama já resolveu orgId/corretorId e validou a entrada. A atividade
// falha silenciosamente NÃO é aceitável → propaga erro.
async function inserirNegocioComCriacao(
  supabase: Awaited<ReturnType<typeof criarClienteServidor>>,
  insert: InsertNegocio,
  usuarioId: string,
  orgId: string,
  descricaoCriacao: string,
): Promise<NegocioResumo> {
  const { data, error } = await supabase
    .from("negocios")
    .insert(insert)
    .select(SELECT_ENRIQUECIDO)
    .single();
  if (error || !data) {
    throw new Error(`criarNegocio: ${error?.message ?? "sem retorno"}`);
  }
  const negocio = separarEnriquecida(data as LinhaEnriquecida);

  const { error: erroAtividade } = await supabase
    .from("negocio_atividades")
    .insert({
      negocio_id: negocio.id,
      org_id: orgId,
      autor_id: usuarioId,
      tipo: "criacao",
      descricao: descricaoCriacao,
    });
  if (erroAtividade) {
    throw new Error(`criarNegocio(atividade): ${erroAtividade.message}`);
  }
  return negocio;
}

/**
 * Cria um negócio a partir de uma entrada (form). org_id e corretor_id vêm da
 * SESSÃO (nunca do input). Registra atividade 'criacao'. Exige corretor/gestor.
 */
export async function criarNegocio(input: NegocioEntrada): Promise<NegocioResumo> {
  const { usuarioId, orgId } = await exigirCorretor();
  const dados = negocioEntradaSchema.parse(input);
  const supabase = await criarClienteServidor();
  return inserirNegocioComCriacao(
    supabase,
    entradaParaInsert(dados, orgId, usuarioId),
    usuarioId,
    orgId,
    "Negócio criado.",
  );
}

/**
 * Cria um negócio a partir de um LEAD: prefill de cliente_id, imovel_id, nome do
 * cliente e valor do imóvel. Evita duplicar — se já existe negócio ABERTO
 * (resultado is null) para esse lead visível ao usuário, retorna o existente.
 * Exige corretor/gestor. Lança se o lead não é visível (RLS) ou não existe.
 */
export async function criarNegocioDeLead(leadId: string): Promise<NegocioResumo> {
  const { usuarioId, orgId } = await exigirCorretor();
  const supabase = await criarClienteServidor();

  // Dedup: negócio aberto já existente para o lead (RLS já restringe a visão).
  const { data: existente, error: erroExistente } = await supabase
    .from("negocios")
    .select(SELECT_ENRIQUECIDO)
    .eq("lead_id", leadId)
    .is("resultado", null)
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (erroExistente) {
    throw new Error(`criarNegocioDeLead(dedup): ${erroExistente.message}`);
  }
  if (existente) {
    return separarEnriquecida(existente as LinhaEnriquecida);
  }

  // Carrega o lead + cliente + imóvel para o prefill. RLS já limita a visão.
  const { data: lead, error: erroLead } = await supabase
    .from("leads")
    .select(
      "cliente_id, imovel_id, cliente:perfis!leads_cliente_id_fkey(nome), imovel:imoveis(valor)",
    )
    .eq("id", leadId)
    .maybeSingle();
  if (erroLead) {
    throw new Error(`criarNegocioDeLead(lead): ${erroLead.message}`);
  }
  if (!lead) {
    throw new Error("criarNegocioDeLead: lead não encontrado ou fora do acesso.");
  }
  const dadosLead = lead as {
    cliente_id: string;
    imovel_id: string;
    cliente: { nome: string | null } | null;
    imovel: { valor: number } | null;
  };

  const insert: InsertNegocio = {
    org_id: orgId,
    corretor_id: usuarioId,
    etapa: "novo",
    nome_contato: dadosLead.cliente?.nome ?? "Cliente",
    cliente_id: dadosLead.cliente_id,
    lead_id: leadId,
    imovel_id: dadosLead.imovel_id,
    valor: dadosLead.imovel?.valor ?? null,
    origem: "lead",
  };

  return inserirNegocioComCriacao(
    supabase,
    insert,
    usuarioId,
    orgId,
    "Negócio criado a partir do lead.",
  );
}

/**
 * Move o negócio para outra etapa e registra atividade 'mudanca_etapa'
 * descrevendo a transição (de→para). Exige corretor/gestor. Lança se o negócio
 * não é visível (RLS) ou não existe.
 */
export async function moverEtapa(id: string, etapa: EtapaNegocio): Promise<NegocioResumo> {
  const { usuarioId, orgId } = await exigirCorretor();
  const destino = etapaNegocioSchema.parse(etapa);
  const supabase = await criarClienteServidor();

  // Lê a etapa atual (para descrever a transição) dentro do escopo autorizado.
  const { data: atual, error: erroAtual } = await supabase
    .from("negocios")
    .select("etapa")
    .eq("id", id)
    .maybeSingle();
  if (erroAtual) {
    throw new Error(`moverEtapa(leitura): ${erroAtual.message}`);
  }
  if (!atual) {
    throw new Error("moverEtapa: negócio não encontrado ou fora do acesso.");
  }
  const origem = coagirEtapa(atual.etapa);

  const { data, error } = await supabase
    .from("negocios")
    .update({ etapa: destino })
    .eq("id", id)
    .select(SELECT_ENRIQUECIDO)
    .single();
  if (error || !data) {
    throw new Error(`moverEtapa: ${error?.message ?? "sem retorno"}`);
  }

  const { error: erroAtividade } = await supabase.from("negocio_atividades").insert({
    negocio_id: id,
    org_id: orgId,
    autor_id: usuarioId,
    tipo: "mudanca_etapa",
    descricao: `Etapa alterada de ${origem} para ${destino}.`,
  });
  if (erroAtividade) {
    throw new Error(`moverEtapa(atividade): ${erroAtividade.message}`);
  }
  return separarEnriquecida(data as LinhaEnriquecida);
}

/**
 * Fecha o negócio: etapa='fechamento', resultado (ganho|perdido) e motivo_perda
 * opcional. O trigger do 0011 carimba fechado_em. Registra atividade
 * 'ganho'/'perdido'. Exige corretor/gestor. Lança se o negócio não é visível.
 */
export async function definirResultado(
  id: string,
  resultado: ResultadoNegocio,
  motivo?: string,
): Promise<NegocioResumo> {
  const { usuarioId, orgId } = await exigirCorretor();
  const r = resultadoNegocioSchema.parse(resultado);
  const supabase = await criarClienteServidor();

  const { data, error } = await supabase
    .from("negocios")
    .update({
      etapa: "fechamento",
      resultado: r,
      motivo_perda: r === "perdido" ? (motivo ?? null) : null,
    })
    .eq("id", id)
    .select(SELECT_ENRIQUECIDO)
    .single();
  if (error || !data) {
    throw new Error(`definirResultado: ${error?.message ?? "sem retorno"}`);
  }

  const descricao =
    r === "ganho"
      ? "Negócio marcado como ganho."
      : `Negócio marcado como perdido${motivo ? `: ${motivo}` : "."}`;
  const { error: erroAtividade } = await supabase.from("negocio_atividades").insert({
    negocio_id: id,
    org_id: orgId,
    autor_id: usuarioId,
    tipo: r,
    descricao,
  });
  if (erroAtividade) {
    throw new Error(`definirResultado(atividade): ${erroAtividade.message}`);
  }
  return separarEnriquecida(data as LinhaEnriquecida);
}

// --- Dashboard do gestor: resumo do funil (motor puro @imobia/core) ---

// Reexporta o tipo de saída do motor para conveniência da UI do dashboard.
export type { ResumoFunil };

/**
 * Resumo do funil sobre os negócios visíveis ao usuário (gestor/admin: a org;
 * corretor: os seus). Usa resumoFunil(@imobia/core) — agregação PURA. Para o
 * dashboard do gestor. Anônimo/cliente ⇒ funil vazio (listarNegocios guarda).
 */
export async function resumoFunilDaOrg(): Promise<ResumoFunil> {
  const negocios = await listarNegocios();
  return resumoFunil(
    negocios.map((n) => ({ etapa: n.etapa, resultado: n.resultado, valor: n.valor })),
  );
}
