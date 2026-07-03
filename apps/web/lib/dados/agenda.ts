// Camada de dados da AGENDA do corretor + Server Actions. Módulo server-side
// (NÃO é "use server" no topo: exporta TIPOS além de funções async, como
// negocios.ts/comunidade.ts). As Server Actions de ESCRITA carregam a diretiva
// inline "use server" no corpo.
//
// ESCOPO/RLS: a RLS de 0020 cuida de tudo — corretor vê/edita só os SEUS
// eventos; gestor/admin veem os da org (select). Como a agenda é PESSOAL, as
// leituras aqui ainda filtram por corretor_id = sessão (o gestor vê a própria
// agenda, não a do time). As ESCRITAS derivam org_id/corretor_id da SESSÃO
// (nunca do input) — o trigger de 0020 reforça (coalesce p/ auth.uid()).
//
// AGRUPAMENTO POR DIA: `listarAgenda` junta eventos (agenda_eventos) e tarefas
// pendentes com prazo (minhasTarefas) num ItemAgenda por dia:
//   ItemAgenda = { data: "YYYY-MM-DD", itens: EntradaAgenda[] }
//   EntradaAgenda = { tipo: "evento", evento } | { tipo: "tarefa", tarefa }
// Dentro do dia, EVENTOS vêm primeiro (ordenados por início) e as TAREFAS do
// dia (sem hora) depois. A chave `data` do evento é o dia do `inicio` no
// relógio de America/Sao_Paulo (lib/fuso.ts — mesmo frame da exibição em
// formato.ts e do "hoje" da página); a da tarefa é o próprio vence_em.
// Datas ISO; pt-BR.

import {
  eventoAgendaSchema,
  tiposEventoAgenda,
  type Database,
  type EventoAgendaEntrada,
  type TipoEventoAgenda,
} from "@imobia/domain";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obterPerfil, obterSessao } from "@/lib/auth/sessao";
import { minhasTarefas, type TarefaResumo } from "@/lib/dados/tarefas";
import { diaSaoPaulo } from "@/lib/fuso";
import { criarClienteServidor } from "@/lib/supabase/server";

type LinhaEvento = Database["public"]["Tables"]["agenda_eventos"]["Row"];

// --- Tipos de saída (camelCase, prontos para a UI) ---

/** Como o evento foi criado (coluna criado_via). */
export type CriadoVia = "manual" | "assistente";

/** Um evento da agenda, com o contato do negócio vinculado (se houver). */
export type EventoAgenda = {
  id: string;
  titulo: string;
  tipo: TipoEventoAgenda;
  inicioISO: string;
  fimISO: string | null;
  local: string | null;
  observacao: string | null;
  negocioId: string | null;
  /** Nome do contato do negócio vinculado (null se sem vínculo/fora do RLS). */
  negocioContato?: string | null;
  criadoVia: CriadoVia;
};

/** Uma entrada da agenda de um dia: um evento com hora OU uma tarefa do dia. */
export type EntradaAgenda =
  | { tipo: "evento"; evento: EventoAgenda }
  | { tipo: "tarefa"; tarefa: TarefaResumo };

/** Um dia da agenda (chave YYYY-MM-DD) com suas entradas ordenadas. */
export type ItemAgenda = {
  data: string;
  itens: EntradaAgenda[];
};

/** Retorno padrão das actions de escrita. */
export type ResultadoAgenda =
  | { ok: true; evento: EventoAgenda }
  | { ok: false; erro: string };

// --- Helpers ---

function coagirTipo(v: string): TipoEventoAgenda {
  return (tiposEventoAgenda as readonly string[]).includes(v)
    ? (v as TipoEventoAgenda)
    : "compromisso";
}

type LinhaEventoEnriquecida = LinhaEvento & {
  negocio: { nome_contato: string | null } | null;
};

function mapEvento(linha: LinhaEventoEnriquecida): EventoAgenda {
  return {
    id: linha.id,
    titulo: linha.titulo,
    tipo: coagirTipo(linha.tipo),
    inicioISO: linha.inicio,
    fimISO: linha.fim,
    local: linha.local,
    observacao: linha.observacao,
    negocioId: linha.negocio_id,
    negocioContato: linha.negocio?.nome_contato ?? null,
    criadoVia: linha.criado_via === "assistente" ? "assistente" : "manual",
  };
}

// Colunas do join usadas para dar contexto ao evento (contato do negócio).
const SELECT_ENRIQUECIDO = "*, negocio:negocios(nome_contato)";

/** Sessão + perfil profissional (corretor/gestor/admin). Lança se não autorizado. */
async function exigirProfissional(): Promise<{ usuarioId: string; orgId: string }> {
  const sessao = await obterSessao();
  if (!sessao) {
    throw new Error("não autenticado");
  }
  const perfil = await obterPerfil(sessao.usuarioId);
  if (!perfil || perfil.papel === "cliente" || !perfil.orgId) {
    throw new Error("sem permissão de escrita na org");
  }
  return { usuarioId: sessao.usuarioId, orgId: perfil.orgId };
}

// --- Leitura (agenda PESSOAL do usuário logado) ---

/**
 * Eventos do usuário logado com início dentro de [deISO, ateISO] (inclusivo),
 * ordenados por início. Filtra por corretor_id = sessão mesmo sob RLS (gestor
 * vê a org no select, mas a agenda exibida é a própria). Anônimo recebe [].
 */
export async function listarEventos(deISO: string, ateISO: string): Promise<EventoAgenda[]> {
  const sessao = await obterSessao();
  if (!sessao) {
    return [];
  }
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("agenda_eventos")
    .select(SELECT_ENRIQUECIDO)
    .eq("corretor_id", sessao.usuarioId)
    .gte("inicio", deISO)
    .lte("inicio", ateISO)
    .order("inicio", { ascending: true });
  if (error) {
    throw new Error(`listarEventos: ${error.message}`);
  }
  return (data ?? []).map((linha) => mapEvento(linha as LinhaEventoEnriquecida));
}

/**
 * Agenda agrupada por dia no intervalo [deISO, ateISO]: eventos do usuário +
 * suas tarefas pendentes com vence_em no intervalo. Dias ordenados asc; dentro
 * do dia, eventos (por início) e depois as tarefas do dia. Anônimo recebe [].
 */
export async function listarAgenda(deISO: string, ateISO: string): Promise<ItemAgenda[]> {
  const [eventos, tarefas] = await Promise.all([listarEventos(deISO, ateISO), minhasTarefas()]);

  const deDia = deISO.slice(0, 10);
  const ateDia = ateISO.slice(0, 10);
  const tarefasDoIntervalo = tarefas.filter(
    (t) => t.venceEm !== null && t.venceEm >= deDia && t.venceEm <= ateDia,
  );

  const porDia = new Map<string, EntradaAgenda[]>();
  const entradasDe = (dia: string): EntradaAgenda[] => {
    const atual = porDia.get(dia);
    if (atual) {
      return atual;
    }
    const novo: EntradaAgenda[] = [];
    porDia.set(dia, novo);
    return novo;
  };

  // Eventos primeiro (já vêm ordenados por início dentro do dia)…
  for (const evento of eventos) {
    entradasDe(diaSaoPaulo(evento.inicioISO)).push({ tipo: "evento", evento });
  }
  // …tarefas do dia (sem hora) depois, na ordem de minhasTarefas (prazo asc).
  for (const tarefa of tarefasDoIntervalo) {
    if (tarefa.venceEm) {
      entradasDe(tarefa.venceEm).push({ tipo: "tarefa", tarefa });
    }
  }

  return [...porDia.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, itens]) => ({ data, itens }));
}

// --- Escrita (org/corretor da SESSÃO; trigger de 0020 reforça) ---

/**
 * Insere um evento validado (eventoAgendaSchema). NÃO é Server Action: função
 * interna reusada pela action manual e pelo assistente (que carimba
 * criado_via='assistente'). org_id/corretor_id vêm da sessão — o trigger
 * agenda_preencher_org reforça. Lança em erro de banco/validação.
 */
export async function criarEvento(
  input: EventoAgendaEntrada,
  criadoVia: CriadoVia,
): Promise<EventoAgenda> {
  const { usuarioId, orgId } = await exigirProfissional();
  const dados = eventoAgendaSchema.parse(input);
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("agenda_eventos")
    .insert({
      org_id: orgId,
      corretor_id: usuarioId,
      titulo: dados.titulo,
      tipo: dados.tipo,
      inicio: dados.inicio,
      fim: dados.fim ?? null,
      local: dados.local ?? null,
      negocio_id: dados.negocioId ?? null,
      observacao: dados.observacao ?? null,
      criado_via: criadoVia,
    })
    .select(SELECT_ENRIQUECIDO)
    .single();
  if (error || !data) {
    throw new Error(`criarEvento: ${error?.message ?? "sem retorno"}`);
  }
  return mapEvento(data as LinhaEventoEnriquecida);
}

/**
 * Server Action: cria um evento MANUAL na agenda do usuário logado. Valida com
 * eventoAgendaSchema; revalida /corretor/agenda. Retorno tipado (nunca lança).
 */
export async function criarEventoAction(input: EventoAgendaEntrada): Promise<ResultadoAgenda> {
  "use server";
  const parsed = eventoAgendaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: "Dados do evento inválidos. Confira título e horários." };
  }
  try {
    const evento = await criarEvento(parsed.data, "manual");
    revalidatePath("/corretor/agenda");
    return { ok: true, evento };
  } catch {
    return { ok: false, erro: "Não foi possível criar o evento. Tente novamente." };
  }
}

/**
 * Server Action: exclui um evento DO PRÓPRIO usuário (além da RLS, filtra por
 * corretor_id = sessão). Idempotente: ausência é sucesso. Revalida
 * /corretor/agenda. Retorno tipado (nunca lança).
 */
export async function excluirEventoAction(
  id: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  "use server";
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) {
    return { ok: false, erro: "Evento inválido." };
  }
  try {
    const { usuarioId } = await exigirProfissional();
    const supabase = await criarClienteServidor();
    const { error } = await supabase
      .from("agenda_eventos")
      .delete()
      .eq("id", parsed.data)
      .eq("corretor_id", usuarioId);
    if (error) {
      return { ok: false, erro: "Não foi possível excluir o evento." };
    }
    revalidatePath("/corretor/agenda");
    return { ok: true };
  } catch {
    return { ok: false, erro: "Não foi possível excluir o evento." };
  }
}
