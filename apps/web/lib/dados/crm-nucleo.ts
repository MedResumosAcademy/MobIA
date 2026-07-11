// NÚCLEO PURO do CRM 2.0 (contatos/conversas/campanhas) — extraído para ser
// testável sem sessão/banco (mesmo padrão de prioridades-fila.ts). Recebe
// listas já lidas (e escopadas pela RLS) e devolve estruturas prontas:
//   - timeline unificada da ficha do contato (negócios, atividades, tarefas
//     e mensagens em uma linha só, ordenada do mais recente ao mais antigo);
//   - agregação da listagem de contatos (negócios abertos + última mensagem);
//   - agrupamento do inbox de conversas (última mensagem + não respondidas);
//   - segmentação de campanha (a MESMA função para previsão e disparo —
//     zero divergência) e o mapeamento de status de envio para o resumo.
//
// LGPD: segmentarContatos FORÇA apenasComConsentimento=true — contato sem
// consentimento de marketing NUNCA entra nos alvos de envio em massa, e o
// chamador não tem como relaxar isso por aqui.

import {
  contatoCasaSegmento,
  type ContatoSegmentavel,
  type ExtrasSegmentacao,
  type Segmento as SegmentoCore,
} from "@imobia/core";
import { TEMPERATURAS } from "@imobia/domain";

// ---------------------------------------------------------------------------
// Timeline unificada da ficha do contato
// ---------------------------------------------------------------------------

/** De onde veio o item da timeline (governa ícone/cor na UI). */
export type OrigemTimeline = "negocio" | "atividade" | "tarefa" | "mensagem";

/** Um item da timeline unificada do contato, pronto para a UI. */
export type ItemTimelineContato = {
  /** Chave estável ("origem:id da entidade"). */
  chave: string;
  origem: OrigemTimeline;
  /** Frase principal (descrição da atividade, corpo da mensagem, etc.). */
  titulo: string;
  /** Complemento (imóvel do negócio, direção da mensagem, prazo da tarefa). */
  detalhe: string | null;
  /** Instante ISO do item (ordena a timeline). */
  data: string;
  /** Negócio vinculado, quando o item pertence a um (para o link da ficha). */
  negocioId: string | null;
};

export type NegocioParaTimeline = {
  id: string;
  imovelTitulo: string | null;
  criadoEm: string;
};

export type AtividadeParaTimeline = {
  id: string;
  negocioId: string;
  descricao: string;
  criadoEm: string;
};

export type TarefaParaTimeline = {
  id: string;
  negocioId: string;
  titulo: string;
  concluida: boolean;
  venceEm: string | null;
  criadoEm: string;
};

export type MensagemParaTimeline = {
  id: string;
  direcao: string;
  corpo: string;
  criadoEm: string;
};

const LIMITE_CORPO_TIMELINE = 200;

/** Corpo de mensagem encurtado para a timeline (a conversa completa tem tela própria). */
function resumirCorpo(corpo: string): string {
  const texto = corpo.trim();
  if (texto.length <= LIMITE_CORPO_TIMELINE) {
    return texto;
  }
  return `${texto.slice(0, LIMITE_CORPO_TIMELINE - 1)}…`;
}

/** Date.parse defensivo — ISO inválido conta como "muito antigo" (vai ao fim). */
function instante(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Junta negócios, atividades, tarefas e mensagens do contato em UMA timeline,
 * ordenada do mais recente ao mais antigo (desempate determinístico pela
 * chave). Puro: não filtra por acesso — as listas já chegam escopadas.
 */
export function montarTimelineContato(entrada: {
  negocios: readonly NegocioParaTimeline[];
  atividades: readonly AtividadeParaTimeline[];
  tarefas: readonly TarefaParaTimeline[];
  mensagens: readonly MensagemParaTimeline[];
}): ItemTimelineContato[] {
  const itens: ItemTimelineContato[] = [];

  for (const n of entrada.negocios) {
    itens.push({
      chave: `negocio:${n.id}`,
      origem: "negocio",
      titulo: "Negócio no funil",
      detalhe: n.imovelTitulo,
      data: n.criadoEm,
      negocioId: n.id,
    });
  }

  for (const a of entrada.atividades) {
    itens.push({
      chave: `atividade:${a.id}`,
      origem: "atividade",
      titulo: a.descricao,
      detalhe: null,
      data: a.criadoEm,
      negocioId: a.negocioId,
    });
  }

  for (const t of entrada.tarefas) {
    itens.push({
      chave: `tarefa:${t.id}`,
      origem: "tarefa",
      titulo: t.titulo,
      detalhe: t.concluida
        ? "Tarefa concluída"
        : t.venceEm !== null
          ? `Tarefa — vence em ${t.venceEm}`
          : "Tarefa pendente",
      data: t.criadoEm,
      negocioId: t.negocioId,
    });
  }

  for (const m of entrada.mensagens) {
    itens.push({
      chave: `mensagem:${m.id}`,
      origem: "mensagem",
      titulo: resumirCorpo(m.corpo),
      detalhe: m.direcao === "entrada" ? "Mensagem recebida" : "Mensagem enviada",
      data: m.criadoEm,
      negocioId: null,
    });
  }

  itens.sort(
    (a, b) => instante(b.data) - instante(a.data) || a.chave.localeCompare(b.chave),
  );
  return itens;
}

// ---------------------------------------------------------------------------
// Agregação da listagem de contatos (sem N+1: 3 queries → 1 passada aqui)
// ---------------------------------------------------------------------------

export type MensagemParaAgregacao = {
  contatoId: string;
  corpo: string;
  direcao: string;
  criadoEm: string;
};

export type AgregadoContato = {
  /** Quantos negócios ABERTOS (sem resultado) apontam para o contato. */
  negociosAbertos: number;
  /** Última mensagem trocada com o contato — null se nunca conversou. */
  ultimaMensagem: { corpo: string; direcao: string; criadoEm: string } | null;
};

/**
 * Agrega, por contato, a contagem de negócios abertos e a última mensagem.
 * Robusto à ordem de chegada das mensagens (compara criadoEm, não posição).
 */
export function agregarPorContato(
  negociosAbertos: readonly { contatoId: string | null }[],
  mensagens: readonly MensagemParaAgregacao[],
): Map<string, AgregadoContato> {
  const porContato = new Map<string, AgregadoContato>();

  const garantir = (id: string): AgregadoContato => {
    const atual = porContato.get(id);
    if (atual) {
      return atual;
    }
    const novo: AgregadoContato = { negociosAbertos: 0, ultimaMensagem: null };
    porContato.set(id, novo);
    return novo;
  };

  for (const n of negociosAbertos) {
    if (n.contatoId !== null) {
      garantir(n.contatoId).negociosAbertos += 1;
    }
  }

  for (const m of mensagens) {
    const agregado = garantir(m.contatoId);
    if (
      agregado.ultimaMensagem === null ||
      instante(m.criadoEm) > instante(agregado.ultimaMensagem.criadoEm)
    ) {
      agregado.ultimaMensagem = { corpo: m.corpo, direcao: m.direcao, criadoEm: m.criadoEm };
    }
  }

  return porContato;
}

// ---------------------------------------------------------------------------
// Inbox de conversas
// ---------------------------------------------------------------------------

export type MensagemParaConversa = {
  contatoId: string;
  corpo: string;
  direcao: string;
  status: string;
  criadoEm: string;
};

export type ConversaAgregada = {
  contatoId: string;
  ultima: { corpo: string; direcao: string; status: string; criadoEm: string };
  /** Última mensagem RECEBIDA do contato (base da janela de 24h) — null se nunca escreveu. */
  ultimaEntradaEm: string | null;
  /** Mensagens de entrada DEPOIS da última saída (aguardando resposta da equipe). */
  naoRespondidas: number;
};

/**
 * Agrupa as mensagens por contato em conversas: última mensagem, última
 * ENTRADA (para a janela de 24h) e quantas entradas ainda não foram
 * respondidas. Saída ordenada pela última mensagem (mais recente primeiro).
 */
export function agruparConversas(
  mensagens: readonly MensagemParaConversa[],
): ConversaAgregada[] {
  type Acumulador = {
    ultima: MensagemParaConversa;
    ultimaEntradaEm: string | null;
    ultimaSaidaEm: string | null;
    entradas: string[];
  };
  const porContato = new Map<string, Acumulador>();

  for (const m of mensagens) {
    const acc = porContato.get(m.contatoId) ?? {
      ultima: m,
      ultimaEntradaEm: null,
      ultimaSaidaEm: null,
      entradas: [],
    };
    if (instante(m.criadoEm) >= instante(acc.ultima.criadoEm)) {
      acc.ultima = m;
    }
    if (m.direcao === "entrada") {
      acc.entradas.push(m.criadoEm);
      if (acc.ultimaEntradaEm === null || instante(m.criadoEm) > instante(acc.ultimaEntradaEm)) {
        acc.ultimaEntradaEm = m.criadoEm;
      }
    } else if (
      acc.ultimaSaidaEm === null ||
      instante(m.criadoEm) > instante(acc.ultimaSaidaEm)
    ) {
      acc.ultimaSaidaEm = m.criadoEm;
    }
    porContato.set(m.contatoId, acc);
  }

  const conversas: ConversaAgregada[] = [];
  for (const [contatoId, acc] of porContato) {
    const corte = acc.ultimaSaidaEm === null ? null : instante(acc.ultimaSaidaEm);
    const naoRespondidas = acc.entradas.filter(
      (e) => corte === null || instante(e) > corte,
    ).length;
    conversas.push({
      contatoId,
      ultima: {
        corpo: acc.ultima.corpo,
        direcao: acc.ultima.direcao,
        status: acc.ultima.status,
        criadoEm: acc.ultima.criadoEm,
      },
      ultimaEntradaEm: acc.ultimaEntradaEm,
      naoRespondidas,
    });
  }

  conversas.sort(
    (a, b) =>
      instante(b.ultima.criadoEm) - instante(a.ultima.criadoEm) ||
      a.contatoId.localeCompare(b.contatoId),
  );
  return conversas;
}

// ---------------------------------------------------------------------------
// Segmentação de campanha (previsão E disparo usam ESTA função)
// ---------------------------------------------------------------------------

export type ContatoParaSegmentacao = {
  id: string;
  contato: ContatoSegmentavel;
  extras: ExtrasSegmentacao;
};

export type ResultadoSegmentacao = {
  /** Contatos que CASAM com o segmento (consentidos + com telefone válido). */
  alvos: string[];
  /** Casariam, mas NUNCA recebem: sem opt-in de marketing (LGPD). */
  semConsentimento: string[];
  /** Casariam, mas sem telefone válido para o WhatsApp. */
  semTelefone: string[];
  /** Não casam com os critérios do segmento (não contam como excluídos). */
  foraDoSegmento: string[];
};

/**
 * Aplica o segmento sobre os contatos com o motor puro (@imobia/core
 * contatoCasaSegmento). apenasComConsentimento é FORÇADO true: esta função
 * alimenta ENVIO em massa e a LGPD é invariante — quem não consentiu marketing
 * nunca vira alvo, e a previsão de alcance usa exatamente o mesmo caminho.
 */
export function segmentarContatos(
  itens: readonly ContatoParaSegmentacao[],
  seg: Omit<SegmentoCore, "apenasComConsentimento">,
): ResultadoSegmentacao {
  const resultado: ResultadoSegmentacao = {
    alvos: [],
    semConsentimento: [],
    semTelefone: [],
    foraDoSegmento: [],
  };
  for (const item of itens) {
    const { casa, motivoExclusao } = contatoCasaSegmento(item.contato, item.extras, {
      ...seg,
      apenasComConsentimento: true,
    });
    if (casa) {
      resultado.alvos.push(item.id);
    } else if (motivoExclusao === "sem_consentimento") {
      resultado.semConsentimento.push(item.id);
    } else if (motivoExclusao === "sem_telefone") {
      resultado.semTelefone.push(item.id);
    } else {
      resultado.foraDoSegmento.push(item.id);
    }
  }
  return resultado;
}

// ---------------------------------------------------------------------------
// Status de envio → resumo (core resumoCampanha) e temperatura mais quente
// ---------------------------------------------------------------------------

/**
 * Mapeia o status de campanha_envios (0026) para o vocabulário do
 * resumoCampanha do core: as exclusões LGPD/telefone contam como "excluido";
 * o resto passa direto ("enviado" soma em enviados, "falhou" em falhas).
 */
export function statusEnvioParaResumo(status: string): string {
  return status === "sem_consentimento" || status === "sem_telefone" ? "excluido" : status;
}

// Rank crescente de temperatura (índice em TEMPERATURAS = mais quente).
const RANK_TEMPERATURA: readonly string[] = TEMPERATURAS;

/**
 * A temperatura MAIS QUENTE entre as informadas (um cliente pode ter vários
 * leads). Valores desconhecidos são ignorados; lista vazia ⇒ null.
 */
export function maisQuente(temperaturas: readonly string[]): string | null {
  let melhor: string | null = null;
  let melhorRank = -1;
  for (const t of temperaturas) {
    const rank = RANK_TEMPERATURA.indexOf(t);
    if (rank > melhorRank) {
      melhorRank = rank;
      melhor = t;
    }
  }
  return melhor;
}
