"use server";

// CONTATOS (CRM 2.0, migração 0026) — agenda de contatos da org + ficha com
// TIMELINE UNIFICADA (negócios, atividades, tarefas e mensagens). Módulo
// "use server": só exporta funções async + tipos (apagados na compilação —
// mesmo padrão de newsletter.ts). A montagem pura vive em crm-nucleo.ts.
//
// ESCOPO/RLS (0026): toda a equipe da org VÊ contatos (colaboração); UPDATE só
// responsável ou gestor/admin — a RLS impõe e aqui não reforçamos leitura. As
// ESCRITAS derivam org_id/responsavel_id da SESSÃO (nunca do input; o trigger
// contatos_preencher_sessao reforça o anti-forja no banco).
//
// LGPD: consentimento de MARKETING é opt-in EXPLÍCITO com fonte registrada
// (finalidade específica — art. 8º §4º) e revogável a qualquer momento
// (revogarConsentimentoAction). Editar um contato NUNCA concede nem revoga
// consentimento silenciosamente: só o opt-in explícito do formulário (true +
// fonte) ou as ações dedicadas tocam nesses campos.

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { formatarTelefoneBR, janelaAtendimento } from "@imobia/core";
import { contatoSchema, type ContatoInput, type Database, type Papel } from "@imobia/domain";
import { obterPerfil, obterSessao } from "@/lib/auth/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import { emitirEvento } from "@/lib/webhooks/saida";
import {
  agregarPorContato,
  montarTimelineContato,
  type ItemTimelineContato,
} from "./crm-nucleo";

type LinhaContato = Database["public"]["Tables"]["contatos"]["Row"];

// --- Tipos de saída (camelCase, prontos para a UI) ---

/** Uma linha da agenda de contatos, com os agregados da listagem. */
export type ContatoResumo = {
  id: string;
  nome: string;
  /** Só dígitos com DDI 55 (como no banco) — para wa.me/envio. */
  telefone: string | null;
  /** "(11) 98888-7777" — para exibição. */
  telefoneFormatado: string | null;
  email: string | null;
  tags: string[];
  origem: string;
  responsavelId: string;
  clienteId: string | null;
  /** Carimbo do opt-in de marketing (LGPD) — null = sem consentimento. */
  consentimentoMarketingEm: string | null;
  /** Funil de RELACIONAMENTO do contato (0027) — null = fora de funil. */
  funilId: string | null;
  /** Etapa atual no funil de relacionamento (chave) — null = sem etapa. */
  etapaChave: string | null;
  /** Última interação registrada (mensagem) — base do 🔥 "a contatar". */
  ultimaInteracaoEm: string | null;
  /** Quantos negócios ABERTOS apontam para o contato (visíveis ao usuário). */
  negociosAbertos: number;
  /** Tem negócio GANHO vinculado (o 🔥 nunca acende para quem ganhou). */
  ganho: boolean;
  /** Última mensagem trocada — null se nunca conversou. */
  ultimaMensagem: { corpo: string; direcao: string; criadoEm: string } | null;
  criadoEm: string;
};

/** Um negócio do contato (para os chips da ficha). */
export type NegocioDoContato = {
  id: string;
  etapa: string;
  resultado: string | null;
  /** Valor do negócio em CENTAVOS — null quando não informado. */
  valor: number | null;
  imovelTitulo: string | null;
  criadoEm: string;
};

/** Ficha completa: dados + timeline unificada + janela de 24h do WhatsApp. */
export type ContatoDetalhe = {
  contato: ContatoResumo & {
    consentimentoFonte: string | null;
    observacao: string | null;
    responsavelNome: string | null;
    atualizadoEm: string | null;
  };
  negocios: NegocioDoContato[];
  timeline: ItemTimelineContato[];
  /** Janela de atendimento de 24h (a partir da última mensagem RECEBIDA). */
  janela: { aberta: boolean; expiraEmISO: string | null };
};

export type ResultadoContato = { ok: true; id: string } | { ok: false; erro: string };
export type ResultadoAcaoContato = { ok: true } | { ok: false; erro: string };

// --- Helpers internos ---

/** Sessão + papel profissional (corretor/gestor/admin) com org. Lança se não. */
async function exigirEquipe(): Promise<{ usuarioId: string; orgId: string; papel: Papel }> {
  const sessao = await obterSessao();
  if (!sessao) {
    throw new Error("não autenticado");
  }
  const perfil = await obterPerfil(sessao.usuarioId);
  if (!perfil || perfil.papel === "cliente" || !perfil.orgId) {
    throw new Error("sem permissão na org");
  }
  return { usuarioId: sessao.usuarioId, orgId: perfil.orgId, papel: perfil.papel };
}

/** Título derivado do imóvel — espelha leads.ts/negocios.ts (sem coluna própria). */
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

function mapContatoResumo(
  l: LinhaContato,
  agregado: {
    negociosAbertos: number;
    ganho: boolean;
    ultimaMensagem: ContatoResumo["ultimaMensagem"];
  },
): ContatoResumo {
  return {
    id: l.id,
    nome: l.nome,
    telefone: l.telefone,
    telefoneFormatado: l.telefone !== null ? formatarTelefoneBR(l.telefone) : null,
    email: l.email,
    tags: l.tags,
    origem: l.origem,
    responsavelId: l.responsavel_id,
    clienteId: l.cliente_id,
    consentimentoMarketingEm: l.consentimento_marketing_em,
    funilId: l.funil_id,
    etapaChave: l.etapa_chave,
    ultimaInteracaoEm: l.ultima_interacao_em,
    ganho: agregado.ganho,
    negociosAbertos: agregado.negociosAbertos,
    ultimaMensagem: agregado.ultimaMensagem,
    criadoEm: l.criado_em,
  };
}

// Teto de mensagens varridas para achar a "última por contato" na listagem
// (bound explícito — a listagem não precisa do histórico completo).
const LIMITE_MENSAGENS_LISTAGEM = 2000;

// --- Leitura ---

/**
 * Contatos da org (RLS escopa), enriquecidos com a contagem de negócios
 * ABERTOS e a última mensagem — SEM N+1: são 3 queries (contatos, negócios
 * abertos, mensagens recentes) + agregação pura (crm-nucleo). Filtros:
 *   - `busca`: ilike em nome/e-mail (e no telefone, quando tem dígitos);
 *   - `tag`: contato precisa ter a tag;
 *   - `apenasMeus`: só os contatos cujo responsável é o usuário logado.
 * Anônimo recebe []. Obs.: a contagem de negócios respeita a visão do usuário
 * (corretor conta só os próprios negócios — RLS de negocios).
 */
export async function listarContatos(
  filtros: { busca?: string; tag?: string; apenasMeus?: boolean } = {},
): Promise<ContatoResumo[]> {
  const sessao = await obterSessao();
  if (!sessao) {
    return [];
  }
  const supabase = await criarClienteServidor();

  let query = supabase.from("contatos").select("*");
  if (filtros.apenasMeus) {
    query = query.eq("responsavel_id", sessao.usuarioId);
  }
  const tag = filtros.tag?.trim();
  if (tag) {
    query = query.contains("tags", [tag]);
  }
  // Sanitiza o termo para o .or() do PostgREST (vírgula/parênteses quebrariam
  // a sintaxe; %/_ são curingas do ilike) — busca sempre literal.
  const termo = (filtros.busca ?? "").trim().replace(/[%_,()]/g, "");
  if (termo !== "") {
    const padrao = `%${termo}%`;
    const partes = [`nome.ilike.${padrao}`, `email.ilike.${padrao}`];
    const digitos = termo.replace(/\D/g, "");
    if (digitos.length >= 4) {
      partes.push(`telefone.ilike.%${digitos}%`);
    }
    query = query.or(partes.join(","));
  }

  const [contatosRes, negociosRes, mensagensRes] = await Promise.all([
    query.order("criado_em", { ascending: false }),
    supabase
      .from("negocios")
      .select("contato_id, resultado")
      .not("contato_id", "is", null),
    supabase
      .from("mensagens")
      .select("contato_id, corpo, direcao, criado_em")
      .order("criado_em", { ascending: false })
      .limit(LIMITE_MENSAGENS_LISTAGEM),
  ]);
  if (contatosRes.error) {
    throw new Error(`listarContatos: ${contatosRes.error.message}`);
  }
  if (negociosRes.error) {
    throw new Error(`listarContatos(negocios): ${negociosRes.error.message}`);
  }
  if (mensagensRes.error) {
    throw new Error(`listarContatos(mensagens): ${mensagensRes.error.message}`);
  }

  const agregados = agregarPorContato(
    (negociosRes.data ?? []).map((n) => ({ contatoId: n.contato_id, resultado: n.resultado })),
    (mensagensRes.data ?? []).map((m) => ({
      contatoId: m.contato_id,
      corpo: m.corpo,
      direcao: m.direcao,
      criadoEm: m.criado_em,
    })),
  );

  return (contatosRes.data ?? []).map((l) =>
    mapContatoResumo(
      l,
      agregados.get(l.id) ?? { negociosAbertos: 0, ganho: false, ultimaMensagem: null },
    ),
  );
}

/**
 * Ficha completa do contato: dados + negócios vinculados (via contato_id) +
 * TIMELINE UNIFICADA (negócios, atividades, tarefas e mensagens, ordenada do
 * mais recente ao mais antigo, tipada por origem) + janela de 24h calculada
 * da última mensagem RECEBIDA. null se fora do escopo (RLS) ou inexistente.
 * Queries: 4 em paralelo + 2 dependentes dos ids dos negócios (sem N+1).
 */
export async function obterContato(id: string): Promise<ContatoDetalhe | null> {
  const sessao = await obterSessao();
  if (!sessao) {
    return null;
  }
  const supabase = await criarClienteServidor();

  const [contatoRes, negociosRes, mensagensRes, ultimaEntradaRes] = await Promise.all([
    supabase
      .from("contatos")
      .select("*, responsavel:perfis!contatos_responsavel_id_fkey(nome)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("negocios")
      .select("id, etapa, resultado, valor, criado_em, imovel:imoveis(tipo, cidade, uf)")
      .eq("contato_id", id)
      .order("criado_em", { ascending: false }),
    supabase
      .from("mensagens")
      .select("id, direcao, corpo, criado_em")
      .eq("contato_id", id)
      .order("criado_em", { ascending: false })
      .limit(100),
    // Janela de 24h: dedicada (a última ENTRADA pode ser mais antiga que as
    // 100 mensagens acima em conversas muito movimentadas).
    supabase
      .from("mensagens")
      .select("criado_em")
      .eq("contato_id", id)
      .eq("direcao", "entrada")
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (contatoRes.error) {
    throw new Error(`obterContato: ${contatoRes.error.message}`);
  }
  if (!contatoRes.data) {
    return null;
  }
  if (negociosRes.error) {
    throw new Error(`obterContato(negocios): ${negociosRes.error.message}`);
  }
  if (mensagensRes.error) {
    throw new Error(`obterContato(mensagens): ${mensagensRes.error.message}`);
  }

  const { responsavel, ...linha } = contatoRes.data as LinhaContato & {
    responsavel: { nome: string | null } | null;
  };
  const negocios = (negociosRes.data ?? []).map((n) => ({
    id: n.id,
    etapa: n.etapa,
    resultado: n.resultado,
    valor: n.valor,
    imovelTitulo: tituloImovel(n.imovel),
    criadoEm: n.criado_em,
  }));

  // Atividades e tarefas dependem dos ids dos negócios (2ª onda, em paralelo).
  // Atividades tipo 'criacao' ficam de fora: o próprio negócio já é um item
  // da timeline com a mesma data (evita linha duplicada).
  const negocioIds = negocios.map((n) => n.id);
  const [atividadesRes, tarefasRes] =
    negocioIds.length > 0
      ? await Promise.all([
          supabase
            .from("negocio_atividades")
            .select("id, negocio_id, descricao, criado_em")
            .in("negocio_id", negocioIds)
            .neq("tipo", "criacao")
            .order("criado_em", { ascending: false })
            .limit(50),
          supabase
            .from("negocio_tarefas")
            .select("id, negocio_id, titulo, concluida, vence_em, criado_em")
            .in("negocio_id", negocioIds)
            .order("criado_em", { ascending: false })
            .limit(50),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
        ];
  if (atividadesRes.error) {
    throw new Error(`obterContato(atividades): ${atividadesRes.error.message}`);
  }
  if (tarefasRes.error) {
    throw new Error(`obterContato(tarefas): ${tarefasRes.error.message}`);
  }

  const timeline = montarTimelineContato({
    negocios: negocios.map((n) => ({
      id: n.id,
      imovelTitulo: n.imovelTitulo,
      criadoEm: n.criadoEm,
    })),
    atividades: (atividadesRes.data ?? []).map((a) => ({
      id: a.id,
      negocioId: a.negocio_id,
      descricao: a.descricao,
      criadoEm: a.criado_em,
    })),
    tarefas: (tarefasRes.data ?? []).map((t) => ({
      id: t.id,
      negocioId: t.negocio_id,
      titulo: t.titulo,
      concluida: t.concluida,
      venceEm: t.vence_em,
      criadoEm: t.criado_em,
    })),
    mensagens: (mensagensRes.data ?? []).map((m) => ({
      id: m.id,
      direcao: m.direcao,
      corpo: m.corpo,
      criadoEm: m.criado_em,
    })),
  });

  const resumoBase = mapContatoResumo(linha, {
    negociosAbertos: negocios.filter((n) => n.resultado === null).length,
    ganho: negocios.some((n) => n.resultado === "ganho"),
    ultimaMensagem: mensagensRes.data?.[0]
      ? {
          corpo: mensagensRes.data[0].corpo,
          direcao: mensagensRes.data[0].direcao,
          criadoEm: mensagensRes.data[0].criado_em,
        }
      : null,
  });

  return {
    contato: {
      ...resumoBase,
      consentimentoFonte: linha.consentimento_fonte,
      observacao: linha.observacao,
      responsavelNome: responsavel?.nome ?? null,
      atualizadoEm: linha.atualizado_em,
    },
    negocios,
    timeline,
    janela: janelaAtendimento(
      ultimaEntradaRes.data?.criado_em ?? null,
      new Date().toISOString(),
    ),
  };
}

// --- Escrita (org/responsável da SESSÃO; contrato { ok } — nunca lança) ---

/**
 * Cria um contato. Telefone é normalizado pelo contatoSchema (dígitos com DDI
 * 55). LGPD: consentimento_marketing_em = now() SÓ quando o formulário trouxe
 * consentimentoMarketing=true EXPLÍCITO — e aí a fonte é obrigatória.
 */
export async function criarContatoAction(input: ContatoInput): Promise<ResultadoContato> {
  let ctx: { usuarioId: string; orgId: string };
  try {
    ctx = await exigirEquipe();
  } catch {
    return { ok: false, erro: "Sem permissão para criar contatos. Entre novamente." };
  }
  const parsed = contatoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: "Confira os dados: nome é obrigatório e o telefone precisa de DDD + número." };
  }
  const d = parsed.data;
  const fonte = d.consentimentoFonte?.trim() ?? "";
  if (d.consentimentoMarketing && fonte === "") {
    return { ok: false, erro: "Informe a fonte do consentimento de marketing (LGPD) — ex.: formulário do site." };
  }

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("contatos")
    .insert({
      org_id: ctx.orgId,
      responsavel_id: ctx.usuarioId,
      nome: d.nome,
      telefone: d.telefone ?? null,
      email: d.email ?? null,
      tags: d.tags,
      observacao: d.observacao ?? null,
      consentimento_marketing_em: d.consentimentoMarketing ? new Date().toISOString() : null,
      consentimento_fonte: d.consentimentoMarketing ? fonte : null,
    })
    .select("id")
    .single();
  if (error || !data) {
    if (error?.code === "23505") {
      return { ok: false, erro: "Já existe um contato com este telefone na sua organização." };
    }
    return { ok: false, erro: "Não foi possível criar o contato. Tente novamente." };
  }
  // Webhook de saída (0033) DEPOIS da resposta — nunca atrasa a action.
  const contatoId = data.id;
  after(() =>
    emitirEvento(ctx.orgId, "contato.criado", {
      contatoId,
      nome: d.nome,
      telefone: d.telefone ?? null,
      email: d.email ?? null,
      origem: "manual",
    }),
  );
  revalidatePath("/corretor/crm");
  return { ok: true, id: data.id };
}

/**
 * Atualiza os dados de um contato (substituição completa dos campos do form:
 * nome, telefone, e-mail, tags, observação). LGPD: consentimentoMarketing=true
 * explícito REGISTRA o opt-in (exigindo fonte) se ainda não havia; false/ausente
 * NÃO revoga — revogação é só pela ação dedicada (nunca por efeito colateral).
 */
export async function atualizarContatoAction(
  id: string,
  input: ContatoInput,
): Promise<ResultadoContato> {
  try {
    await exigirEquipe();
  } catch {
    return { ok: false, erro: "Sem permissão para editar contatos. Entre novamente." };
  }
  const parsed = contatoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: "Confira os dados: nome é obrigatório e o telefone precisa de DDD + número." };
  }
  const d = parsed.data;
  const fonte = d.consentimentoFonte?.trim() ?? "";
  if (d.consentimentoMarketing && fonte === "") {
    return { ok: false, erro: "Informe a fonte do consentimento de marketing (LGPD) — ex.: formulário do site." };
  }

  const supabase = await criarClienteServidor();
  // Lê o estado atual do consentimento: opt-in já registrado NUNCA tem o
  // carimbo sobrescrito (a data original do consentimento é o registro LGPD).
  const { data: atual, error: erroAtual } = await supabase
    .from("contatos")
    .select("consentimento_marketing_em")
    .eq("id", id)
    .maybeSingle();
  if (erroAtual || !atual) {
    return { ok: false, erro: "Contato não encontrado ou fora do seu acesso." };
  }

  const patch: Database["public"]["Tables"]["contatos"]["Update"] = {
    nome: d.nome,
    telefone: d.telefone ?? null,
    email: d.email ?? null,
    tags: d.tags,
    observacao: d.observacao ?? null,
  };
  if (d.consentimentoMarketing && atual.consentimento_marketing_em === null) {
    patch.consentimento_marketing_em = new Date().toISOString();
    patch.consentimento_fonte = fonte;
  }

  const { data, error } = await supabase
    .from("contatos")
    .update(patch)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    if (error?.code === "23505") {
      return { ok: false, erro: "Já existe um contato com este telefone na sua organização." };
    }
    return { ok: false, erro: "Não foi possível atualizar (só o responsável ou o gestor editam)." };
  }
  revalidatePath("/corretor/crm");
  revalidatePath(`/corretor/crm/contatos/${id}`);
  return { ok: true, id: data.id };
}

/**
 * Registra o OPT-IN de marketing do contato (LGPD): carimba
 * consentimento_marketing_em = now() e a fonte informada (obrigatória —
 * ex.: "formulário do site", "pediu por WhatsApp em 10/07/2026").
 */
export async function registrarConsentimentoAction(
  id: string,
  fonte: string,
): Promise<ResultadoAcaoContato> {
  try {
    await exigirEquipe();
  } catch {
    return { ok: false, erro: "Sem permissão. Entre novamente." };
  }
  const fonteLimpa = fonte.trim();
  if (fonteLimpa === "" || fonteLimpa.length > 200) {
    return { ok: false, erro: "Informe a fonte do consentimento (até 200 caracteres)." };
  }
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("contatos")
    .update({
      consentimento_marketing_em: new Date().toISOString(),
      consentimento_fonte: fonteLimpa,
    })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { ok: false, erro: "Não foi possível registrar (só o responsável ou o gestor editam)." };
  }
  revalidatePath(`/corretor/crm/contatos/${id}`);
  return { ok: true };
}

/**
 * REVOGA o consentimento de marketing (LGPD art. 8º §5º: revogação a qualquer
 * momento, tão fácil quanto o opt-in). Vale imediatamente: o contato deixa de
 * ser alvo de QUALQUER campanha (o segmentador exclui quem não tem carimbo).
 */
export async function revogarConsentimentoAction(id: string): Promise<ResultadoAcaoContato> {
  try {
    await exigirEquipe();
  } catch {
    return { ok: false, erro: "Sem permissão. Entre novamente." };
  }
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("contatos")
    .update({ consentimento_marketing_em: null, consentimento_fonte: null })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { ok: false, erro: "Não foi possível revogar (só o responsável ou o gestor editam)." };
  }
  revalidatePath(`/corretor/crm/contatos/${id}`);
  return { ok: true };
}

// Validação de tag compartilhada pelas duas ações abaixo.
function validarTag(tag: string): string | null {
  const limpa = tag.trim();
  return limpa.length >= 1 && limpa.length <= 40 ? limpa : null;
}

/** Adiciona uma tag ao contato (dedup; máx. 20 tags — limite do domínio). */
export async function adicionarTagAction(
  id: string,
  tag: string,
): Promise<ResultadoAcaoContato> {
  try {
    await exigirEquipe();
  } catch {
    return { ok: false, erro: "Sem permissão. Entre novamente." };
  }
  const limpa = validarTag(tag);
  if (limpa === null) {
    return { ok: false, erro: "Tag inválida (1 a 40 caracteres)." };
  }
  const supabase = await criarClienteServidor();
  const { data: atual, error: erroLeitura } = await supabase
    .from("contatos")
    .select("tags")
    .eq("id", id)
    .maybeSingle();
  if (erroLeitura || !atual) {
    return { ok: false, erro: "Contato não encontrado ou fora do seu acesso." };
  }
  if (atual.tags.includes(limpa)) {
    return { ok: true };
  }
  if (atual.tags.length >= 20) {
    return { ok: false, erro: "Limite de 20 tags por contato atingido." };
  }
  const { data, error } = await supabase
    .from("contatos")
    .update({ tags: [...atual.tags, limpa] })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { ok: false, erro: "Não foi possível salvar a tag (só o responsável ou o gestor editam)." };
  }
  revalidatePath(`/corretor/crm/contatos/${id}`);
  return { ok: true };
}

/** Remove uma tag do contato (idempotente: tag ausente ⇒ ok). */
export async function removerTagAction(
  id: string,
  tag: string,
): Promise<ResultadoAcaoContato> {
  try {
    await exigirEquipe();
  } catch {
    return { ok: false, erro: "Sem permissão. Entre novamente." };
  }
  const limpa = tag.trim();
  const supabase = await criarClienteServidor();
  const { data: atual, error: erroLeitura } = await supabase
    .from("contatos")
    .select("tags")
    .eq("id", id)
    .maybeSingle();
  if (erroLeitura || !atual) {
    return { ok: false, erro: "Contato não encontrado ou fora do seu acesso." };
  }
  if (!atual.tags.includes(limpa)) {
    return { ok: true };
  }
  const { data, error } = await supabase
    .from("contatos")
    .update({ tags: atual.tags.filter((t) => t !== limpa) })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { ok: false, erro: "Não foi possível remover a tag (só o responsável ou o gestor editam)." };
  }
  revalidatePath(`/corretor/crm/contatos/${id}`);
  return { ok: true };
}
