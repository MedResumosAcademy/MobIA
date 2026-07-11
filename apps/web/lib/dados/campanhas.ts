"use server";

// CAMPANHAS (disparo em massa segmentado — CRM 2.0) — módulo "use server"
// (padrão newsletter.ts). Gestor/admin criam e disparam; corretor lê (RLS 0026).
//
// LGPD — INVARIANTE DE TODAS AS VIAS DE ENVIO EM MASSA: contato sem
// consentimento_marketing_em NUNCA recebe campanha. A segmentação
// (crm-nucleo segmentarContatos, sobre o motor puro contatoCasaSegmento)
// FORÇA apenasComConsentimento=true; excluídos viram campanha_envios com
// status 'sem_consentimento'/'sem_telefone' e a Meta NUNCA é chamada para
// eles. A previsão de alcance usa EXATAMENTE a mesma função do disparo —
// zero divergência entre o número prometido e o executado.
//
// META: campanha SEMPRE sai por TEMPLATE aprovado (fora da janela de 24h —
// regra da Meta para iniciar conversa). Sem envs da Meta, o disparo degrada
// com erro instrutivo (padrão Groq/Resend). Ritmo: pausa entre envios
// (~10 msg/s no teto). Falha parcial é honesta: contadores incrementais e
// status final 'concluida' (algum envio saiu) ou 'falhou' (nenhum saiu) —
// mesma lição da newsletter.

import { revalidatePath } from "next/cache";
import { calcularTemperatura, resumoCampanha, type ResumoCampanha } from "@imobia/core";
import {
  campanhaSchema,
  segmentoSchema,
  statusCampanhaSchema,
  type CampanhaInput,
  type Database,
  type Segmento,
  type StatusCampanha,
} from "@imobia/domain";
import { obterPerfil, obterSessao } from "@/lib/auth/sessao";
import { avaliarGateEnvio, type ConfigGateEnvio } from "@/lib/dados/envio-whatsapp";
import { enviarTemplateWhatsApp, metaDisponivel } from "@/lib/meta/whatsapp";
import { criarClienteServidor } from "@/lib/supabase/server";
import {
  maisQuente,
  segmentarContatos,
  statusEnvioParaResumo,
  type ContatoParaSegmentacao,
} from "./crm-nucleo";

type LinhaCampanha = Database["public"]["Tables"]["campanhas"]["Row"];

// --- Tipos de saída (camelCase, prontos para a UI) ---

export type CampanhaResumo = {
  id: string;
  nome: string;
  mensagem: string;
  templateNome: string | null;
  segmento: Segmento;
  status: StatusCampanha;
  totalAlvo: number;
  totalEnviado: number;
  totalFalha: number;
  criadoEm: string;
  atualizadoEm: string | null;
};

export type CampanhaDetalhe = CampanhaResumo & {
  /** Números consolidados (motor puro resumoCampanha sobre os envios). */
  resumo: ResumoCampanha;
  /** Detalhe das exclusões (LGPD/telefone/modo teste — "excluidos" do resumo). */
  exclusoes: {
    semConsentimento: number;
    semTelefone: number;
    bloqueadosModoTeste: number;
  };
  /**
   * 'enviando' sem progresso (atualizado_em parado além do limite) — o envio
   * foi interrompido no meio e pode ser retomado pelo disparo.
   */
  envioTravado: boolean;
};

export type ResultadoCampanha = { ok: true; id: string } | { ok: false; erro: string };

export type ResultadoPrevisao =
  | { ok: true; alvo: number; excluidos: { semConsentimento: number; semTelefone: number } }
  | { ok: false; erro: string };

export type ResultadoDisparo =
  | {
      ok: true;
      enviados: number;
      falhas: number;
      excluidos: number;
      /** Alvos aptos que NÃO receberam por causa do modo teste (0033). */
      bloqueadosModoTeste: number;
    }
  | { ok: false; erro: string };

// --- Helpers internos ---

/** Gate de papel: só gestor/admin gerencia campanhas (RLS reforça). */
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

function coagirStatus(v: string): StatusCampanha {
  const r = statusCampanhaSchema.safeParse(v);
  return r.success ? r.data : "rascunho";
}

/** segmento jsonb do banco → Segmento validado ({} se corrompido/antigo). */
function lerSegmento(json: unknown): Segmento {
  const r = segmentoSchema.safeParse(json);
  return r.success ? r.data : {};
}

function mapResumo(l: LinhaCampanha): CampanhaResumo {
  return {
    id: l.id,
    nome: l.nome,
    mensagem: l.mensagem,
    templateNome: l.template_nome,
    segmento: lerSegmento(l.segmento),
    status: coagirStatus(l.status),
    totalAlvo: l.total_alvo,
    totalEnviado: l.total_enviado,
    totalFalha: l.total_falha,
    criadoEm: l.criado_em,
    atualizadoEm: l.atualizado_em,
  };
}

/**
 * Carrega os contatos da org no formato do segmentador — 3 queries paralelas
 * (contatos, negócios abertos p/ etapas, leads p/ temperatura) + agregação.
 * MESMO caminho para previsão e disparo (zero divergência). A RLS escopa tudo
 * (gestor vê a org inteira; leads só de clientes consentidos).
 */
async function carregarContatosParaSegmentacao(
  supabase: Awaited<ReturnType<typeof criarClienteServidor>>,
): Promise<ContatoParaSegmentacao[]> {
  const [contatosRes, negociosRes, leadsRes] = await Promise.all([
    supabase
      .from("contatos")
      .select("id, tags, telefone, consentimento_marketing_em, cliente_id"),
    supabase
      .from("negocios")
      .select("contato_id, etapa")
      .not("contato_id", "is", null)
      .is("resultado", null),
    supabase
      .from("leads")
      .select("cliente_id, visitas, simulacoes, favoritos, cliques_financiamento, retornos"),
  ]);
  if (contatosRes.error) {
    throw new Error(`segmentacao(contatos): ${contatosRes.error.message}`);
  }
  if (negociosRes.error) {
    throw new Error(`segmentacao(negocios): ${negociosRes.error.message}`);
  }
  if (leadsRes.error) {
    throw new Error(`segmentacao(leads): ${leadsRes.error.message}`);
  }

  // Etapas dos negócios ABERTOS por contato.
  const etapasPorContato = new Map<string, string[]>();
  for (const n of negociosRes.data ?? []) {
    if (n.contato_id !== null) {
      const etapas = etapasPorContato.get(n.contato_id) ?? [];
      etapas.push(n.etapa);
      etapasPorContato.set(n.contato_id, etapas);
    }
  }

  // Temperatura por CLIENTE (motor puro sobre os contadores do lead; um
  // cliente com vários leads fica com a mais quente).
  const temperaturasPorCliente = new Map<string, string[]>();
  for (const l of leadsRes.data ?? []) {
    const { temperatura } = calcularTemperatura({
      visitas: l.visitas,
      simulacoes: l.simulacoes,
      favoritos: l.favoritos,
      cliquesFinanciamento: l.cliques_financiamento,
      retornos: l.retornos,
    });
    const lista = temperaturasPorCliente.get(l.cliente_id) ?? [];
    lista.push(temperatura);
    temperaturasPorCliente.set(l.cliente_id, lista);
  }

  return (contatosRes.data ?? []).map((c) => ({
    id: c.id,
    contato: {
      tags: c.tags,
      consentimentoMarketingEm: c.consentimento_marketing_em,
      telefone: c.telefone,
    },
    extras: {
      etapasAbertas: etapasPorContato.get(c.id) ?? [],
      temperatura:
        c.cliente_id !== null
          ? maisQuente(temperaturasPorCliente.get(c.cliente_id) ?? [])
          : null,
    },
  }));
}

// --- Leitura ---

/** Campanhas da org (RLS: corretor lê, gestor gerencia). Anônimo recebe []. */
export async function listarCampanhas(): Promise<CampanhaResumo[]> {
  const sessao = await obterSessao();
  if (!sessao) {
    return [];
  }
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("campanhas")
    .select("*")
    .order("criado_em", { ascending: false });
  if (error) {
    throw new Error(`listarCampanhas: ${error.message}`);
  }
  return (data ?? []).map(mapResumo);
}

/**
 * Campanha + resumo consolidado dos envios (motor puro resumoCampanha; as
 * exclusões LGPD/telefone contam como "excluido" via statusEnvioParaResumo).
 * null se fora do escopo (RLS) ou inexistente.
 */
export async function obterCampanha(id: string): Promise<CampanhaDetalhe | null> {
  const sessao = await obterSessao();
  if (!sessao) {
    return null;
  }
  const supabase = await criarClienteServidor();
  const [campanhaRes, enviosRes] = await Promise.all([
    supabase.from("campanhas").select("*").eq("id", id).maybeSingle(),
    supabase.from("campanha_envios").select("status").eq("campanha_id", id),
  ]);
  if (campanhaRes.error) {
    throw new Error(`obterCampanha: ${campanhaRes.error.message}`);
  }
  if (!campanhaRes.data) {
    return null;
  }
  if (enviosRes.error) {
    throw new Error(`obterCampanha(envios): ${enviosRes.error.message}`);
  }
  const envios = enviosRes.data ?? [];
  const resumo = mapResumo(campanhaRes.data);
  return {
    ...resumo,
    resumo: resumoCampanha(envios.map((e) => ({ status: statusEnvioParaResumo(e.status) }))),
    exclusoes: {
      semConsentimento: envios.filter((e) => e.status === "sem_consentimento").length,
      semTelefone: envios.filter((e) => e.status === "sem_telefone").length,
      bloqueadosModoTeste: envios.filter((e) => e.status === "bloqueado_modo_teste")
        .length,
    },
    envioTravado:
      resumo.status === "enviando" &&
      resumo.atualizadoEm !== null &&
      Date.now() - Date.parse(resumo.atualizadoEm) > LIMITE_ENVIANDO_PARADO_MS,
  };
}

// --- Escrita (gestor/admin; contrato { ok } — nunca lança) ---

/**
 * Cria (sem id) ou atualiza (com id) uma campanha. Só rascunho/pronta são
 * editáveis — campanha disparada é imutável (histórico auditável).
 */
export async function salvarCampanhaAction(input: CampanhaInput): Promise<ResultadoCampanha> {
  let ctx: { usuarioId: string; orgId: string };
  try {
    ctx = await exigirGestor();
  } catch {
    return { ok: false, erro: "Sem permissão para gerenciar campanhas. Entre novamente." };
  }
  const parsed = campanhaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: "Confira nome (até 120) e mensagem (até 4096 caracteres)." };
  }
  const d = parsed.data;
  const supabase = await criarClienteServidor();

  if (d.id) {
    const { data, error } = await supabase
      .from("campanhas")
      .update({
        nome: d.nome,
        mensagem: d.mensagem,
        template_nome: d.templateNome ?? null,
        segmento: d.segmento,
      })
      .eq("id", d.id)
      .in("status", ["rascunho", "pronta"])
      .select("id")
      .maybeSingle();
    if (error || !data) {
      return { ok: false, erro: "Não foi possível atualizar (campanha disparada é imutável)." };
    }
    revalidatePath("/corretor/crm/campanhas");
    return { ok: true, id: data.id };
  }

  const { data, error } = await supabase
    .from("campanhas")
    .insert({
      org_id: ctx.orgId,
      autor_id: ctx.usuarioId,
      nome: d.nome,
      mensagem: d.mensagem,
      template_nome: d.templateNome ?? null,
      segmento: d.segmento,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, erro: "Não foi possível salvar a campanha." };
  }
  revalidatePath("/corretor/crm/campanhas");
  return { ok: true, id: data.id };
}

/**
 * PREVISÃO de alcance de um segmento: quantos contatos receberiam (alvo) e
 * quantos ficariam de fora por LGPD/telefone. Usa a MESMA segmentação do
 * disparo (crm-nucleo segmentarContatos) — o número prometido é o executado.
 */
export async function preverAlcanceAction(segmento: Segmento): Promise<ResultadoPrevisao> {
  try {
    await exigirGestor();
  } catch {
    return { ok: false, erro: "Sem permissão para gerenciar campanhas. Entre novamente." };
  }
  const parsed = segmentoSchema.safeParse(segmento);
  if (!parsed.success) {
    return { ok: false, erro: "Segmento inválido — confira os filtros." };
  }
  const supabase = await criarClienteServidor();
  let itens: ContatoParaSegmentacao[];
  try {
    itens = await carregarContatosParaSegmentacao(supabase);
  } catch {
    return { ok: false, erro: "Falha temporária ao carregar os contatos — tente novamente." };
  }
  const seg = segmentarContatos(itens, parsed.data);
  return {
    ok: true,
    alvo: seg.alvos.length,
    excluidos: {
      semConsentimento: seg.semConsentimento.length,
      semTelefone: seg.semTelefone.length,
    },
  };
}

// Pausa entre envios: teto de ~10 mensagens/s no disparo.
const PAUSA_ENTRE_ENVIOS_MS = 100;

// Envio 'enviando' sem carimbo novo (trigger campanhas_tocar_atualizado_em
// roda a cada contador incremental) há mais deste limite = processo morto
// (ex.: função derrubada na Vercel) — libera a retomada segura.
// Espelhado em app/corretor/crm/campanhas/[id]/page.tsx (UI da retomada).
const LIMITE_ENVIANDO_PARADO_MS = 10 * 60 * 1000;

// Envios que JÁ saíram pela Meta — nunca são refeitos numa retomada/retry.
const STATUS_JA_ENVIADO = ["enviado", "entregue", "lido"];

function pausa(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * DISPARA a campanha via template da Meta para os alvos consentidos.
 *   1. Gate gestor/admin + Meta conectada + template_nome obrigatório;
 *   2. segmenta com a MESMA função da previsão (LGPD forçada);
 *   3. reivindica a campanha (status → 'enviando' só de rascunho/pronta/falhou
 *      — corrida de duplo clique cai fora aqui); envio interrompido no meio
 *      ('enviando' com atualizado_em parado além do limite) pode ser RETOMADO
 *      — quem já recebeu nunca recebe de novo;
 *   4. grava campanha_envios de TODOS (excluídos com status próprio — a Meta
 *      nunca é chamada para eles) e envia 1 a 1 com pausa (~10/s), gravando a
 *      mensagem no histórico da conversa e atualizando contadores a cada envio;
 *   5. fim honesto: 'concluida' (algo saiu) ou 'falhou' (nada saiu).
 */
export async function dispararCampanhaAction(id: string): Promise<ResultadoDisparo> {
  let ctx: { usuarioId: string; orgId: string };
  try {
    ctx = await exigirGestor();
  } catch {
    return { ok: false, erro: "Sem permissão para disparar campanhas. Entre novamente." };
  }
  if (!metaDisponivel()) {
    return {
      ok: false,
      erro:
        "WhatsApp não conectado — conecte a integração Meta (variáveis de ambiente) para " +
        "disparar campanhas. Enquanto isso, use as conversas 1:1 com o link do WhatsApp.",
    };
  }

  const supabase = await criarClienteServidor();
  const { data: campanha, error } = await supabase
    .from("campanhas")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    return { ok: false, erro: "Falha temporária ao carregar a campanha — tente novamente." };
  }
  if (!campanha) {
    return { ok: false, erro: "Campanha não encontrada." };
  }
  const templateNome = campanha.template_nome?.trim() ?? "";
  if (templateNome === "") {
    return {
      ok: false,
      erro:
        "Campanha inicia conversa FORA da janela de 24h — informe o nome de um template " +
        "aprovado na Meta antes de disparar.",
    };
  }

  let itens: ContatoParaSegmentacao[];
  try {
    itens = await carregarContatosParaSegmentacao(supabase);
  } catch {
    return { ok: false, erro: "Falha ao carregar os contatos. Nada foi enviado — tente novamente." };
  }
  const seg = segmentarContatos(itens, lerSegmento(campanha.segmento));
  const totalExcluidos = seg.semConsentimento.length + seg.semTelefone.length;

  // GATE do modo de envio (0033): a config é lida UMA vez e aplicada por alvo
  // (função pura). Alvo fora da lista em modo teste vira 'bloqueado_modo_teste'
  // — a Meta NUNCA é chamada para ele e o resumo conta como excluído.
  const { data: cfgEnvio } = await supabase
    .from("org_config")
    .select("whatsapp_modo, whatsapp_numeros_teste")
    .eq("org_id", ctx.orgId)
    .maybeSingle();
  const gateConfig: ConfigGateEnvio | null = cfgEnvio
    ? {
        whatsappModo: cfgEnvio.whatsapp_modo,
        whatsappNumerosTeste: cfgEnvio.whatsapp_numeros_teste,
      }
    : null;
  const porId = new Map(itens.map((i) => [i.id, i]));
  const bloqueadosModoTeste = new Set(
    seg.alvos.filter((contatoId) => {
      const telefone = porId.get(contatoId)?.contato.telefone ?? null;
      return !avaliarGateEnvio(gateConfig, telefone).pode;
    }),
  );

  if (seg.alvos.length === 0) {
    return {
      ok: false,
      erro:
        totalExcluidos > 0
          ? `Nenhum contato apto: ${seg.semConsentimento.length} sem consentimento de ` +
            `marketing (LGPD) e ${seg.semTelefone.length} sem telefone. Nada foi enviado.`
          : "Nenhum contato casa com o segmento — ajuste os filtros.",
    };
  }

  // Reivindica a campanha — guard de corrida: só rascunho/pronta/falhou viram
  // 'enviando' (retry de 'falhou' é seguro: nada saiu). Duplo clique cai aqui.
  const { data: reivindicada, error: erroClaim } = await supabase
    .from("campanhas")
    .update({
      status: "enviando",
      total_alvo: seg.alvos.length + totalExcluidos,
      total_enviado: 0,
      total_falha: 0,
    })
    .eq("id", id)
    .in("status", ["rascunho", "pronta", "falhou"])
    .select("id")
    .maybeSingle();
  if (erroClaim || !reivindicada) {
    // RETOMADA: envio interrompido no meio (processo morto) fica 'enviando'
    // para sempre sem este caminho. Se o carimbo atualizado_em está parado há
    // mais do que o limite, re-reivindica — o UPDATE re-checa o WHERE na
    // versão mais nova da linha, então duas retomadas simultâneas não passam
    // juntas (a primeira renova o carimbo e derruba a segunda).
    const corte = new Date(Date.now() - LIMITE_ENVIANDO_PARADO_MS).toISOString();
    const { data: retomada, error: erroRetomada } = await supabase
      .from("campanhas")
      .update({ status: "enviando", total_alvo: seg.alvos.length + totalExcluidos })
      .eq("id", id)
      .eq("status", "enviando")
      .lt("atualizado_em", corte)
      .select("id")
      .maybeSingle();
    if (erroRetomada || !retomada) {
      return { ok: false, erro: "Esta campanha já foi disparada (ou está em envio agora)." };
    }
  }

  // Quem JÁ recebeu nesta campanha NUNCA recebe de novo — protege a retomada
  // de envio interrompido (e qualquer retry) contra mensagens duplicadas.
  const { data: linhasJaEnviadas, error: erroJaEnviados } = await supabase
    .from("campanha_envios")
    .select("contato_id")
    .eq("campanha_id", id)
    .in("status", STATUS_JA_ENVIADO);
  if (erroJaEnviados) {
    await supabase.from("campanhas").update({ status: "falhou" }).eq("id", id);
    return { ok: false, erro: "Falha ao preparar os envios — tente novamente." };
  }
  const jaEnviados = new Set((linhasJaEnviadas ?? []).map((l) => l.contato_id));

  // Refaz só os envios NÃO concluídos (linhas já enviadas ficam; o UNIQUE
  // campanha+contato segue respeitado porque jaEnviados sai das inserções).
  // A policy DELETE existe desde a 0035 — sem ela o RLS zerava o delete em
  // silêncio e o INSERT abaixo estourava o UNIQUE (re-disparo em loop eterno).
  const { error: erroLimpeza } = await supabase
    .from("campanha_envios")
    .delete()
    .eq("campanha_id", id)
    .not("status", "in", '("enviado","entregue","lido")');
  if (erroLimpeza) {
    await supabase.from("campanhas").update({ status: "falhou" }).eq("id", id);
    return { ok: false, erro: "Falha ao preparar os envios — tente novamente." };
  }
  const linhasEnvio = [
    // LGPD: excluídos ganham registro auditável e NUNCA geram chamada à Meta.
    ...seg.semConsentimento
      .filter((contatoId) => !jaEnviados.has(contatoId))
      .map((contatoId) => ({
        campanha_id: id,
        contato_id: contatoId,
        org_id: ctx.orgId,
        status: "sem_consentimento",
      })),
    ...seg.semTelefone
      .filter((contatoId) => !jaEnviados.has(contatoId))
      .map((contatoId) => ({
        campanha_id: id,
        contato_id: contatoId,
        org_id: ctx.orgId,
        status: "sem_telefone",
      })),
    // Modo teste (0033): alvo apto fora da lista ganha registro honesto e a
    // Meta nunca é chamada para ele.
    ...seg.alvos
      .filter((contatoId) => !jaEnviados.has(contatoId) && bloqueadosModoTeste.has(contatoId))
      .map((contatoId) => ({
        campanha_id: id,
        contato_id: contatoId,
        org_id: ctx.orgId,
        status: "bloqueado_modo_teste",
      })),
    ...seg.alvos
      .filter((contatoId) => !jaEnviados.has(contatoId) && !bloqueadosModoTeste.has(contatoId))
      .map((contatoId) => ({
        campanha_id: id,
        contato_id: contatoId,
        org_id: ctx.orgId,
        status: "pendente",
      })),
  ];
  // Upsert (não insert): se alguma linha não-concluída sobreviveu ao delete
  // acima, ela é ATUALIZADA em vez de estourar o UNIQUE campanha+contato —
  // re-disparo nunca trava em 23505 (resiliência além da policy 0035).
  const { error: erroEnvios } =
    linhasEnvio.length > 0
      ? await supabase
          .from("campanha_envios")
          .upsert(linhasEnvio, { onConflict: "campanha_id,contato_id" })
      : { error: null };
  if (erroEnvios) {
    await supabase.from("campanhas").update({ status: "falhou" }).eq("id", id);
    return { ok: false, erro: "Falha ao preparar os envios. Nada foi enviado — tente novamente." };
  }

  // Contagem honesta: quem já tinha recebido (retomada) conta como enviado.
  let enviados = jaEnviados.size;
  let falhas = 0;
  let primeiroErro: string | null = null;
  const bloqueadosNovos = seg.alvos.filter(
    (contatoId) => !jaEnviados.has(contatoId) && bloqueadosModoTeste.has(contatoId),
  ).length;
  const alvosPendentes = seg.alvos.filter(
    (contatoId) => !jaEnviados.has(contatoId) && !bloqueadosModoTeste.has(contatoId),
  );

  for (const contatoId of alvosPendentes) {
    const item = porId.get(contatoId);
    const telefone = item?.contato.telefone ?? null;
    // Defesa em profundidade (LGPD): o segmentador JÁ exigiu consentimento e
    // telefone; se algo divergiu, exclui em vez de enviar — Meta não é chamada.
    if (!item || item.contato.consentimentoMarketingEm === null || telefone === null) {
      await supabase
        .from("campanha_envios")
        .update({ status: "sem_consentimento" })
        .eq("campanha_id", id)
        .eq("contato_id", contatoId);
      continue;
    }

    const envio = await enviarTemplateWhatsApp(telefone, templateNome);
    if (envio.ok) {
      enviados += 1;
      // Histórico: a mensagem da campanha entra na conversa do contato. Falha
      // neste insert não desfaz o envio (a mensagem JÁ saiu) — mensagem_id
      // fica nulo e o envio segue contabilizado.
      const { data: mensagem } = await supabase
        .from("mensagens")
        .insert({
          org_id: ctx.orgId,
          contato_id: contatoId,
          canal: "whatsapp",
          direcao: "saida",
          corpo: campanha.mensagem,
          template_nome: templateNome,
          status: "enviada",
          meta_message_id: envio.metaMessageId,
        })
        .select("id")
        .maybeSingle();
      await supabase
        .from("campanha_envios")
        .update({ status: "enviado", mensagem_id: mensagem?.id ?? null })
        .eq("campanha_id", id)
        .eq("contato_id", contatoId);
    } else {
      falhas += 1;
      primeiroErro = primeiroErro ?? envio.erro;
      await supabase
        .from("campanha_envios")
        .update({ status: "falhou", erro: envio.erro })
        .eq("campanha_id", id)
        .eq("contato_id", contatoId);
    }

    // Contadores incrementais (a UI acompanha o progresso do 'enviando').
    await supabase
      .from("campanhas")
      .update({ total_enviado: enviados, total_falha: falhas })
      .eq("id", id);
    await pausa(PAUSA_ENTRE_ENVIOS_MS);
  }

  // Fim honesto: 'concluida' se ALGO saiu; 'falhou' se nada saiu (retry
  // seguro) — inclusive quando o modo teste bloqueou todos os alvos (após
  // ajustar a lista/modo na central, o disparo pode ser refeito).
  const statusFinal =
    enviados === 0 && (falhas > 0 || bloqueadosNovos > 0) ? "falhou" : "concluida";
  await supabase
    .from("campanhas")
    .update({ status: statusFinal, total_enviado: enviados, total_falha: falhas })
    .eq("id", id);
  revalidatePath("/corretor/crm/campanhas");
  revalidatePath(`/corretor/crm/campanhas/${id}`);

  if (statusFinal === "falhou") {
    const aviso =
      bloqueadosNovos > 0
        ? ` Modo teste ativo: ${bloqueadosNovos} contato(s) fora da lista de números de teste.`
        : "";
    return {
      ok: false,
      erro:
        `Nenhuma mensagem saiu (${falhas} falha(s)).${aviso} ${primeiroErro ?? ""}`.trim(),
    };
  }
  return {
    ok: true,
    enviados,
    falhas,
    excluidos: totalExcluidos,
    bloqueadosModoTeste: bloqueadosNovos,
  };
}
