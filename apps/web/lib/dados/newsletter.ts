"use server";

// NEWSLETTER (ESCOPO §V2, item 16) — camada de dados + Server Actions.
// Módulo "use server": só exporta funções async + tipos (apagados na
// compilação — mesmo padrão de gestor.ts/coringa.ts).
//
// - Inscrição pública: cliente PÚBLICO (anon) — a policy permite só INSERT;
//   duplicata é idempotente ({ ok, jaInscrito }) e NUNCA ecoamos o e-mail em
//   erros (não enumerar inscritos é requisito LGPD/segurança).
// - Inscritos (LGPD, migração 0022): a lista é DA PLATAFORMA ImobIA (o
//   consentimento é dado à ImobIA) — e-mails crus só para papel 'admin';
//   gestor vê apenas o TOTAL agregado (rpc newsletter_total_inscritos).
// - CRUD de edições: cliente do servidor (sessão) + gate gestor/admin aqui
//   E na RLS (org via trigger/privado.org_atual()).
// - Envio: PLUGGÁVEL — com RESEND_API_KEY envia via API do Resend (fetch
//   direto, sem SDK); sem chave, o produto segue 100% funcional com o botão
//   "copiar HTML". NUNCA logamos a lista de e-mails.

import { revalidatePath } from "next/cache";
import {
  edicaoNewsletterSchema,
  inscricaoNewsletterSchema,
  statusEdicaoNewsletter,
  type Database,
  type EdicaoNewsletterInput,
  type InscricaoNewsletterInput,
  type StatusEdicaoNewsletter,
} from "@imobia/domain";
import { obterPerfil, obterSessao } from "@/lib/auth/sessao";
import { criarClientePublico } from "@/lib/supabase/publico";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { ImovelParaEmail } from "@/lib/email/newsletter-html";
import { BASE_URL_SITE, gerarHtmlEdicao } from "@/lib/email/newsletter-html";
import { obterOrgConfig } from "./org-config";
import { urlPublicaMidia } from "./storage";

type LinhaEdicao = Database["public"]["Tables"]["newsletter_edicoes"]["Row"];

// --- Tipos de saída (camelCase, prontos para a UI) ---

export type ResultadoInscricao =
  | { ok: true; jaInscrito?: boolean }
  | { ok: false; erro: string };

export type InscritoNewsletter = {
  email: string;
  nome: string | null;
  consentiuEm: string;
};

export type EdicaoNewsletterResumo = {
  id: string;
  titulo: string;
  assunto: string;
  status: StatusEdicaoNewsletter;
  qtdImoveis: number;
  enviadaEm: string | null;
  criadoEm: string;
};

export type EdicaoNewsletterDetalhe = EdicaoNewsletterResumo & {
  introducao: string | null;
  imovelIds: string[];
};

export type ResultadoEdicao =
  | { ok: true; id: string }
  | { ok: false; erro: string };

export type ResultadoAcao = { ok: true } | { ok: false; erro: string };

export type ResultadoEnvio =
  | {
      ok: true;
      enviados: number;
      /** true quando o e-mail está em modo SIMULADO (0033) — nada saiu. */
      simulado?: boolean;
      /** No modo simulado: quantos inscritos ativos RECEBERIAM. */
      inscritosAtivos?: number;
    }
  | { ok: false; erro: string };

// --- Helpers internos ---

function coagirStatus(v: string): StatusEdicaoNewsletter {
  return (statusEdicaoNewsletter as readonly string[]).includes(v)
    ? (v as StatusEdicaoNewsletter)
    : "rascunho";
}

function mapResumo(l: LinhaEdicao): EdicaoNewsletterResumo {
  return {
    id: l.id,
    titulo: l.titulo,
    assunto: l.assunto,
    status: coagirStatus(l.status),
    qtdImoveis: l.imovel_ids.length,
    enviadaEm: l.enviada_em,
    criadoEm: l.criado_em,
  };
}

function mapDetalhe(l: LinhaEdicao): EdicaoNewsletterDetalhe {
  return { ...mapResumo(l), introducao: l.introducao, imovelIds: l.imovel_ids };
}

/** Gate de papel: só gestor/admin gerencia a newsletter (RLS reforça). */
async function exigirGestor(): Promise<void> {
  const sessao = await obterSessao();
  if (!sessao) {
    throw new Error("não autenticado");
  }
  const perfil = await obterPerfil(sessao.usuarioId);
  if (!perfil || (perfil.papel !== "gestor" && perfil.papel !== "admin")) {
    throw new Error("sem permissão para gerenciar a newsletter");
  }
}

// --- Captura pública (double opt-in — migração 0023) ---

/**
 * E-mail de confirmação de inscrição (double opt-in). Best-effort: falha de
 * envio NÃO derruba a inscrição (fica pendente; nunca receberá edições até
 * confirmar). NUNCA loga o e-mail nem o token.
 */
async function enviarEmailConfirmacao(
  apiKey: string,
  email: string,
  token: string,
): Promise<void> {
  const link = `${BASE_URL_SITE}/newsletter/confirmar?token=${token}`;
  const html =
    `<p>Recebemos um pedido para inscrever este e-mail na newsletter da ImobIA.</p>` +
    `<p><a href="${link}">Confirmar minha inscrição</a></p>` +
    `<p>Se não foi você, ignore esta mensagem — sem a confirmação, nada será enviado.</p>`;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "ImobIA <onboarding@resend.dev>",
        to: [email],
        subject: "Confirme sua inscrição na newsletter da ImobIA",
        html,
      }),
    });
  } catch {
    // Silencioso de propósito: sem detalhes (e sem dados pessoais) em logs.
  }
}

/**
 * Inscrição pública na newsletter (Server Action — funciona ANÔNIMO).
 * Idempotente: e-mail duplicado (23505) responde { ok: true, jaInscrito }
 * — sem revelar se o e-mail já existia por mensagem de erro.
 *
 * DOUBLE OPT-IN (LGPD, migração 0023): a inscrição nasce PENDENTE
 * (confirmado_em null) com um token gerado AQUI no servidor; com
 * RESEND_API_KEY enviamos o e-mail de confirmação (/newsletter/confirmar).
 * Só inscrições confirmadas entram em listarInscritos/enviarEdicaoAction —
 * inscrever o e-mail de um terceiro nunca gera envio a ele.
 */
export async function inscreverNewsletterAction(
  input: InscricaoNewsletterInput,
): Promise<ResultadoInscricao> {
  const parsed = inscricaoNewsletterSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      erro: "Confira o e-mail informado e o aceite de consentimento.",
    };
  }
  // Token de confirmação gerado no servidor — só viaja pelo e-mail (a policy
  // de SELECT é admin-only, então o INSERT não devolve representation).
  const token = crypto.randomUUID();
  const supabase = criarClientePublico();
  const { error } = await supabase.from("newsletter_inscricoes").insert({
    email: parsed.data.email,
    nome: parsed.data.nome && parsed.data.nome !== "" ? parsed.data.nome : null,
    token_confirmacao: token,
  });
  if (error) {
    if (error.code === "23505") {
      return { ok: true, jaInscrito: true };
    }
    // NUNCA ecoar o e-mail nem detalhes do banco.
    return {
      ok: false,
      erro: "Não foi possível concluir a inscrição agora. Tente novamente.",
    };
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    await enviarEmailConfirmacao(apiKey, parsed.data.email, token);
  }
  return { ok: true };
}

/**
 * Confirma uma inscrição pelo token do e-mail (double opt-in). RPC SECURITY
 * DEFINER — true só quando confirmou AGORA (token desconhecido, já usado ou
 * inscrição cancelada ⇒ false, sem distinguir os casos).
 */
export async function confirmarInscricaoAction(token: string): Promise<boolean> {
  // UUID malformado nem chega ao banco (a RPC tipa p_token como uuid).
  const uuidValido = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidValido.test(token)) {
    return false;
  }
  const supabase = criarClientePublico();
  const { data, error } = await supabase.rpc("newsletter_confirmar", {
    p_token: token,
  });
  if (error) {
    return false;
  }
  return data === true;
}

// --- Inscritos (total: gestor/admin; e-mails crus: só admin — LGPD 0022) ---

/**
 * Total de inscritos ATIVOS — agregado, sem dado pessoal. Função SECURITY
 * DEFINER no banco (newsletter_total_inscritos, gateada por papel), porque a
 * RLS de SELECT em newsletter_inscricoes é restrita ao admin da plataforma.
 */
export async function totalInscritos(): Promise<number> {
  await exigirGestor();
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("newsletter_total_inscritos");
  if (error) {
    throw new Error(`totalInscritos: ${error.message}`);
  }
  return data ?? 0;
}

/**
 * Lista de inscritos ativos E CONFIRMADOS (double opt-in, 0023 — quem nunca
 * clicou no e-mail de confirmação não entra, logo nunca recebe envio), mais
 * recentes primeiro, + total. LGPD: a RLS só devolve linhas ao papel 'admin'
 * (plataforma); para gestor, inscritos = [] e o total continua correto
 * (agregado via totalInscritos).
 */
export async function listarInscritos(): Promise<{
  total: number;
  inscritos: InscritoNewsletter[];
}> {
  const total = await totalInscritos(); // já faz o gate gestor/admin
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("newsletter_inscricoes")
    .select("email, nome, consentiu_em")
    .is("cancelado_em", null)
    .not("confirmado_em", "is", null)
    .order("consentiu_em", { ascending: false });
  if (error) {
    throw new Error(`listarInscritos: ${error.message}`);
  }
  return {
    total,
    inscritos: (data ?? []).map((l) => ({
      email: l.email,
      nome: l.nome,
      consentiuEm: l.consentiu_em,
    })),
  };
}

// --- Edições (gestor/admin; org via trigger + RLS) ---

export async function listarEdicoes(): Promise<EdicaoNewsletterResumo[]> {
  await exigirGestor();
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("newsletter_edicoes")
    .select("*")
    .order("criado_em", { ascending: false });
  if (error) {
    throw new Error(`listarEdicoes: ${error.message}`);
  }
  return (data ?? []).map(mapResumo);
}

/**
 * Edição por id — null se fora do escopo (RLS) ou inexistente. Erro REAL de
 * banco (transitório/permissão) LANÇA em vez de virar um falso 404 — o error
 * boundary pt-BR cobre; PGRST116 (0 ou 2+ linhas no maybeSingle) segue null.
 */
export async function obterEdicao(
  id: string,
): Promise<EdicaoNewsletterDetalhe | null> {
  await exigirGestor();
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("newsletter_edicoes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error && error.code !== "PGRST116") {
    throw new Error(`obterEdicao: ${error.message}`);
  }
  if (!data) {
    return null;
  }
  return mapDetalhe(data);
}

/** Cria uma edição (rascunho). org_id/autor_id vêm do trigger — anti-forja. */
export async function salvarEdicaoAction(
  input: EdicaoNewsletterInput,
): Promise<ResultadoEdicao> {
  // Action de client component: sessão expirada vira erro inline, não crash
  // (mesmo padrão de reatribuirLeadAction/definirMeta).
  try {
    await exigirGestor();
  } catch {
    return { ok: false, erro: "Sem permissão para gerenciar a newsletter. Entre novamente." };
  }
  const parsed = edicaoNewsletterSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: "Preencha título e assunto (até 160 caracteres)." };
  }
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("newsletter_edicoes")
    .insert({
      titulo: parsed.data.titulo,
      assunto: parsed.data.assunto,
      introducao: parsed.data.introducao ?? null,
      imovel_ids: parsed.data.imovelIds,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, erro: "Não foi possível salvar a edição." };
  }
  revalidatePath("/corretor/newsletter");
  return { ok: true, id: data.id };
}

/** Atualiza uma edição AINDA NÃO ENVIADA (enviada é imutável). */
export async function atualizarEdicaoAction(
  id: string,
  input: EdicaoNewsletterInput,
): Promise<ResultadoEdicao> {
  try {
    await exigirGestor();
  } catch {
    return { ok: false, erro: "Sem permissão para gerenciar a newsletter. Entre novamente." };
  }
  const parsed = edicaoNewsletterSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: "Preencha título e assunto (até 160 caracteres)." };
  }
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("newsletter_edicoes")
    .update({
      titulo: parsed.data.titulo,
      assunto: parsed.data.assunto,
      introducao: parsed.data.introducao ?? null,
      imovel_ids: parsed.data.imovelIds,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", id)
    .neq("status", "enviada")
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { ok: false, erro: "Não foi possível atualizar (edição enviada é imutável)." };
  }
  revalidatePath("/corretor/newsletter");
  revalidatePath(`/corretor/newsletter/${id}`);
  return { ok: true, id: data.id };
}

/** Marca uma edição rascunho como PRONTA para envio. */
export async function marcarProntaAction(id: string): Promise<ResultadoAcao> {
  try {
    await exigirGestor();
  } catch {
    return { ok: false, erro: "Sem permissão para gerenciar a newsletter. Entre novamente." };
  }
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("newsletter_edicoes")
    .update({ status: "pronta", atualizado_em: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "rascunho")
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { ok: false, erro: "Só rascunhos podem ser marcados como prontos." };
  }
  revalidatePath("/corretor/newsletter");
  revalidatePath(`/corretor/newsletter/${id}`);
  return { ok: true };
}

// --- Imóveis da edição (para preview e envio) ---

/**
 * Dados mínimos dos imóveis de uma edição, na ORDEM de imovelIds — filtro
 * EXPLÍCITO pela org do gestor (a RLS sozinha deixaria uma edição divulgar
 * 'disponivel' de org concorrente). Inclui reservado/vendido da própria org
 * para o preview não quebrar. Sem org ⇒ [].
 */
export async function obterImoveisDaEdicao(
  imovelIds: string[],
): Promise<ImovelParaEmail[]> {
  if (imovelIds.length === 0) {
    return [];
  }
  const sessao = await obterSessao();
  const perfil = sessao ? await obterPerfil(sessao.usuarioId) : null;
  if (!perfil?.orgId) {
    return [];
  }
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("imoveis")
    .select("id, tipo, cidade, uf, valor, fotos")
    .in("id", imovelIds)
    .eq("org_id", perfil.orgId);
  if (error) {
    throw new Error(`obterImoveisDaEdicao: ${error.message}`);
  }
  const rotulos: Record<string, string> = {
    casa: "Casa",
    apartamento: "Apartamento",
    terreno: "Terreno",
  };
  const porId = new Map(
    (data ?? []).map((l) => [
      l.id,
      {
        id: l.id,
        titulo: `${(l.tipo && rotulos[l.tipo]) || "Imóvel"} em ${l.cidade}/${l.uf}`,
        cidade: l.cidade,
        uf: l.uf,
        valor: l.valor,
        fotoCapa: l.fotos[0] ? urlPublicaMidia("imoveis-fotos", l.fotos[0]) : null,
      },
    ]),
  );
  return imovelIds
    .map((id) => porId.get(id))
    .filter((i): i is ImovelParaEmail => i !== undefined);
}

// --- Envio (pluggável — Resend via fetch, sem SDK) ---

const TAMANHO_LOTE_RESEND = 100;

/**
 * Envio PARCIAL: os lotes anteriores já chegaram aos destinatários. Marca a
 * edição como enviada (registrando o envio parcial) para o botão de reenvio
 * NÃO duplicar o e-mail para as primeiras centenas de inscritos — perder a
 * cauda é menos danoso que enviar duplicado.
 */
async function marcarEnvioParcial(
  id: string,
  enviados: number,
  total: number,
): Promise<ResultadoEnvio> {
  const supabase = await criarClienteServidor();
  const agora = new Date().toISOString();
  await supabase
    .from("newsletter_edicoes")
    .update({ status: "enviada", enviada_em: agora, atualizado_em: agora })
    .eq("id", id);
  revalidatePath("/corretor/newsletter");
  revalidatePath(`/corretor/newsletter/${id}`);
  return {
    ok: false,
    erro:
      `Falha no provedor após ${enviados} de ${total} e-mails enviados. ` +
      `NÃO reenvie: os primeiros ${enviados} inscritos já receberam. A edição foi marcada ` +
      "como enviada para evitar duplicidade — para alcançar o restante, copie o " +
      "HTML e envie manualmente ou contate o suporte.",
  };
}

/**
 * Envia a edição a todos os inscritos ativos. Sem RESEND_API_KEY o envio
 * automático fica indisponível (o gestor copia o HTML) — produto segue
 * funcional. NUNCA loga a lista de e-mails.
 */
export async function enviarEdicaoAction(id: string): Promise<ResultadoEnvio> {
  try {
    await exigirGestor();
  } catch {
    return { ok: false, erro: "Sem permissão para gerenciar a newsletter. Entre novamente." };
  }

  // GATE de e-mail (central de configuração, 0033): email_modo 'simulado' (o
  // DEFAULT — org sem config também cai aqui) roda o fluxo SEM chamar o
  // Resend e marca a edição como 'simulada' (status 0034; escolha documentada:
  // não há coluna de flag/observação em newsletter_edicoes, e 'enviada' aqui
  // seria mentira que bloquearia o envio real depois). A "segmentação" da
  // newsletter é a lista de inscritos ativos — devolvemos o total que
  // RECEBERIA (agregado LGPD-safe, sem e-mails crus).
  const orgConfig = await obterOrgConfig();
  if (orgConfig === null || orgConfig.emailModo !== "real") {
    let edicaoSim: EdicaoNewsletterDetalhe | null;
    try {
      edicaoSim = await obterEdicao(id);
    } catch {
      return {
        ok: false,
        erro: "Falha temporária ao carregar a edição. Nenhum e-mail foi enviado — tente novamente.",
      };
    }
    if (!edicaoSim) {
      return { ok: false, erro: "Edição não encontrada." };
    }
    if (edicaoSim.status === "enviada") {
      return { ok: false, erro: "Esta edição já foi enviada." };
    }
    let alcance = 0;
    try {
      alcance = await totalInscritos();
    } catch {
      return {
        ok: false,
        erro: "Falha temporária ao contar os inscritos. Nada foi enviado — tente novamente.",
      };
    }
    const supabaseSim = await criarClienteServidor();
    await supabaseSim
      .from("newsletter_edicoes")
      .update({ status: "simulada", atualizado_em: new Date().toISOString() })
      .eq("id", id)
      .neq("status", "enviada");
    revalidatePath("/corretor/newsletter");
    revalidatePath(`/corretor/newsletter/${id}`);
    return { ok: true, enviados: 0, simulado: true, inscritosAtivos: alcance };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      erro: "Envio automático não configurado — copie o HTML e envie pela sua ferramenta.",
    };
  }

  // obterEdicao agora LANÇA em erro real de banco; aqui (ação com retorno
  // estruturado, nada enviado ainda) degradamos para erro retry-seguro.
  let edicao: EdicaoNewsletterDetalhe | null;
  try {
    edicao = await obterEdicao(id);
  } catch {
    return {
      ok: false,
      erro: "Falha temporária ao carregar a edição. Nenhum e-mail foi enviado — tente novamente.",
    };
  }
  if (!edicao) {
    return { ok: false, erro: "Edição não encontrada." };
  }
  if (edicao.status === "enviada") {
    return { ok: false, erro: "Esta edição já foi enviada." };
  }

  // listarInscritos LANÇA em erro de banco; nada foi enviado ainda — degrada
  // para erro retry-seguro em vez de estourar no error boundary.
  let total: number;
  let inscritos: InscritoNewsletter[];
  try {
    ({ total, inscritos } = await listarInscritos());
  } catch {
    return {
      ok: false,
      erro: "Falha temporária ao carregar os inscritos. Nenhum e-mail foi enviado — tente novamente.",
    };
  }
  if (inscritos.length === 0) {
    // LGPD (0022): os e-mails crus só existem para o admin da plataforma —
    // gestor com inscritos ativos vê o motivo real, não um "0 inscritos" falso.
    return {
      ok: false,
      erro:
        total > 0
          ? "Por LGPD, o envio aos inscritos é feito pelo admin da plataforma ImobIA — copie o HTML se precisar enviar pela sua ferramenta."
          : "Nenhum inscrito ativo para receber esta edição.",
    };
  }

  let imoveis: ImovelParaEmail[];
  try {
    imoveis = await obterImoveisDaEdicao(edicao.imovelIds);
  } catch {
    return {
      ok: false,
      erro: "Falha temporária ao carregar os imóveis da edição. Nenhum e-mail foi enviado — tente novamente.",
    };
  }
  const html = gerarHtmlEdicao(edicao, imoveis);

  // Lotes no endpoint /emails/batch (um item por destinatário — sem expor
  // e-mails de terceiros no "to" e sem logar a lista).
  for (let i = 0; i < inscritos.length; i += TAMANHO_LOTE_RESEND) {
    const lote = inscritos.slice(i, i + TAMANHO_LOTE_RESEND).map((inscrito) => ({
      from: "ImobIA <onboarding@resend.dev>",
      to: [inscrito.email],
      subject: edicao.assunto,
      html,
    }));
    // fetch REJEITA em falha de rede (TypeError) — não só devolve !ok em erro
    // HTTP. Os dois caminhos recebem o MESMO tratamento: nada enviado ⇒ retry
    // seguro; envio parcial ⇒ marcar enviada para não duplicar.
    let resposta: Response;
    try {
      resposta = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(lote),
      });
    } catch {
      // i = quantos e-mails JÁ SAÍRAM nos lotes anteriores.
      if (i === 0) {
        return {
          ok: false,
          erro: "Falha de rede no envio. Nenhum e-mail foi enviado — tente novamente.",
        };
      }
      return marcarEnvioParcial(id, i, inscritos.length);
    }
    if (!resposta.ok) {
      if (i === 0) {
        // Nada foi enviado — o retry é seguro.
        return {
          ok: false,
          erro: "Falha no envio pelo provedor. Nenhum e-mail foi enviado — tente novamente.",
        };
      }
      return marcarEnvioParcial(id, i, inscritos.length);
    }
  }

  const supabase = await criarClienteServidor();
  const agora = new Date().toISOString();
  const { error } = await supabase
    .from("newsletter_edicoes")
    .update({ status: "enviada", enviada_em: agora, atualizado_em: agora })
    .eq("id", id);
  if (error) {
    return { ok: false, erro: "E-mails enviados, mas houve falha ao marcar o status." };
  }
  revalidatePath("/corretor/newsletter");
  revalidatePath(`/corretor/newsletter/${id}`);
  return { ok: true, enviados: inscritos.length };
}
