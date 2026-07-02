// Camada de dados do PAINEL DE LEADS do corretor/gestor (ESCOPO §5.1–5.3).
// Módulo server-side (NÃO é "use server": exporta tipos/formatadores além de
// funções async). Usado por Server Components da área /corretor.
//
// LGPD (Decisão 6): a RLS já esconde clientes NÃO consentidos — leads_select,
// eventos_select e o par de policies 0007 (perfis/cliente_profiles) só liberam
// dados de clientes que consentiram. Aqui NÃO reforçamos consentimento por conta
// própria: confiamos na RLS. O que a query enxerga já está autorizado.
//
// TERMÔMETRO: a temperatura/score vêm SEMPRE do motor puro (@mobia/core) a
// partir dos contadores materializados na linha do lead — NUNCA da coluna
// `temperatura` (que o trigger grava como placeholder 'quente').

import { calcularTemperatura, type ResultadoTermometro } from "@mobia/core";
import type { Database, SinaisLead, Temperatura } from "@mobia/domain";
import { obterSessao } from "@/lib/auth/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";

type LinhaLead = Database["public"]["Tables"]["leads"]["Row"];
type LinhaEvento = Database["public"]["Tables"]["eventos"]["Row"];

// --- Tipos de saída (camelCase, prontos para a UI) ---

/** Uma linha do painel de leads: lead + cliente + imóvel + termômetro calculado. */
export type LeadPainel = {
  id: string;
  clienteId: string;
  imovelId: string;
  /** Nome do cliente (perfis.nome) — null se a RLS não expõe ou não preenchido. */
  clienteNome: string | null;
  /** Título derivado do imóvel (o banco não tem coluna de título). */
  imovelTitulo: string;
  temperatura: Temperatura;
  score: number;
  sinais: SinaisLead;
  origem: string | null;
  /** Timestamp ISO do evento mais recente do lead — null se ausente. */
  ultimoEventoEm: string | null;
  criadoEm: string;
};

/** Um item da timeline de um lead: evento já formatado para leitura. */
export type ItemTimeline = {
  id: string;
  tipo: string;
  /** Frase pronta em pt-BR, ex.: "Simulou entrada de R$ 30.000,00". */
  descricao: string;
  criadoEm: string;
};

/** Lead + timeline + capacidade do cliente (se a RLS a expõe). */
export type LeadDetalhe = {
  lead: LeadPainel;
  timeline: ItemTimeline[];
  /**
   * Capacidade calculada do Sonhômetro do cliente (centavos) — visível ao
   * corretor SÓ se o cliente consentiu (policy 0007). null quando indisponível.
   */
  capacidadeCliente: number | null;
};

// --- Helpers ---

/** Contadores da linha do lead → SinaisLead do domínio (entrada do termômetro). */
function sinaisDaLinha(l: LinhaLead): SinaisLead {
  return {
    visitas: l.visitas,
    simulacoes: l.simulacoes,
    favoritos: l.favoritos,
    cliquesFinanciamento: l.cliques_financiamento,
    retornos: l.retornos,
  };
}

/** Título derivado do imóvel — espelha imoveis.ts (sem coluna própria de título). */
function tituloImovel(im: { tipo: string | null; cidade: string; uf: string } | null): string {
  if (!im) {
    return "Imóvel";
  }
  const rotulos: Record<string, string> = {
    casa: "Casa",
    apartamento: "Apartamento",
    terreno: "Terreno",
  };
  const prefixo = im.tipo && rotulos[im.tipo] ? rotulos[im.tipo] : "Imóvel";
  return `${prefixo} em ${im.cidade}/${im.uf}`;
}

/** Centavos → "R$ 30.000,00" (pt-BR). */
function formatarReais(centavos: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    centavos / 100,
  );
}

function mapLeadPainel(
  l: LinhaLead,
  clienteNome: string | null,
  imovel: { tipo: string | null; cidade: string; uf: string } | null,
): LeadPainel {
  const sinais = sinaisDaLinha(l);
  const { temperatura, score }: ResultadoTermometro = calcularTemperatura(sinais);
  return {
    id: l.id,
    clienteId: l.cliente_id,
    imovelId: l.imovel_id,
    clienteNome,
    imovelTitulo: tituloImovel(imovel),
    temperatura,
    score,
    sinais,
    origem: l.origem,
    ultimoEventoEm: l.ultimo_evento_em,
    criadoEm: l.criado_em,
  };
}

/**
 * Formata um evento para a timeline (leitura humana em pt-BR). `simulacao` lê
 * metadata.entrada (centavos) quando presente. Exportada para teste/reuso na UI.
 */
export function formatarEvento(e: Pick<LinhaEvento, "tipo" | "metadata">): string {
  switch (e.tipo) {
    case "visita_ficha":
      return "Visitou a ficha do imóvel";
    case "clique":
      return "Interagiu com o imóvel";
    case "favorito":
      return "Favoritou o imóvel";
    case "retorno":
      return "Retornou ao imóvel";
    case "simulacao": {
      const entrada = lerEntrada(e.metadata);
      return entrada !== null
        ? `Simulou entrada de ${formatarReais(entrada)}`
        : "Simulou o financiamento";
    }
    case "clique_financiamento":
      return "Clicou em financiamento";
    case "sonhometro_completo":
      return "Concluiu o Sonhômetro";
    default:
      return "Interagiu com o imóvel";
  }
}

/** Extrai metadata.entrada (número, centavos) de forma defensiva; null se ausente. */
function lerEntrada(metadata: LinhaEvento["metadata"]): number | null {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    const v = (metadata as Record<string, unknown>).entrada;
    if (typeof v === "number" && Number.isFinite(v)) {
      return v;
    }
  }
  return null;
}

// --- Leitura (corretor/gestor logado; RLS impõe org + consentimento) ---

/**
 * Leads da org do corretor/gestor logado, enriquecidos e ordenados por score
 * desc (mais quentes primeiro). A RLS já limita a org + clientes consentidos;
 * anônimo/cliente recebe lista vazia (guard evita a query). O nome do cliente
 * e o título do imóvel vêm de joins que a RLS pode ou não expor (null tolerado).
 */
export async function listarLeads(): Promise<LeadPainel[]> {
  const sessao = await obterSessao();
  if (!sessao) {
    return [];
  }
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("leads")
    .select("*, cliente:perfis!leads_cliente_id_fkey(nome), imovel:imoveis(tipo, cidade, uf)")
    .order("ultimo_evento_em", { ascending: false });
  if (error) {
    throw new Error(`listarLeads: ${error.message}`);
  }
  const leads = (data ?? []).map((linha) => {
    const { cliente, imovel, ...l } = linha as LinhaLead & {
      cliente: { nome: string | null } | null;
      imovel: { tipo: string | null; cidade: string; uf: string } | null;
    };
    return mapLeadPainel(l, cliente?.nome ?? null, imovel);
  });
  // Ordenação final por score (calculado no motor) — a query só pré-ordena por tempo.
  return leads.sort((a, b) => b.score - a.score);
}

/**
 * Um lead + sua TIMELINE + a capacidade do cliente (se visível). Retorna null se
 * o lead não é visível (RLS) ou não existe. A timeline traz TODOS os eventos do
 * par (cliente_id, imovel_id) — a RLS de eventos já exige consentimento — em
 * ordem cronológica, formatados para leitura.
 */
export async function obterLead(leadId: string): Promise<LeadDetalhe | null> {
  const sessao = await obterSessao();
  if (!sessao) {
    return null;
  }
  const supabase = await criarClienteServidor();

  const { data: linha, error } = await supabase
    .from("leads")
    .select("*, cliente:perfis!leads_cliente_id_fkey(nome), imovel:imoveis(tipo, cidade, uf)")
    .eq("id", leadId)
    .maybeSingle();
  if (error) {
    throw new Error(`obterLead: ${error.message}`);
  }
  if (!linha) {
    return null;
  }
  const { cliente, imovel, ...l } = linha as LinhaLead & {
    cliente: { nome: string | null } | null;
    imovel: { tipo: string | null; cidade: string; uf: string } | null;
  };
  const lead = mapLeadPainel(l, cliente?.nome ?? null, imovel);

  // Timeline: eventos do par (cliente, imóvel), cronológico. RLS já filtra.
  const { data: eventos, error: erroEventos } = await supabase
    .from("eventos")
    .select("id, tipo, metadata, criado_em")
    .eq("cliente_id", l.cliente_id)
    .eq("imovel_id", l.imovel_id)
    .order("criado_em", { ascending: true });
  if (erroEventos) {
    throw new Error(`obterLead(timeline): ${erroEventos.message}`);
  }
  const timeline: ItemTimeline[] = (eventos ?? []).map((e) => ({
    id: e.id,
    tipo: e.tipo,
    descricao: formatarEvento(e),
    criadoEm: e.criado_em,
  }));

  // Capacidade do Sonhômetro do cliente — visível só se consentiu (policy 0007).
  const { data: perfilCliente } = await supabase
    .from("cliente_profiles")
    .select("capacidade_calculada")
    .eq("usuario_id", l.cliente_id)
    .maybeSingle();

  return {
    lead,
    timeline,
    capacidadeCliente: perfilCliente?.capacidade_calculada ?? null,
  };
}
