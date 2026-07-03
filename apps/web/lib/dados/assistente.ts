// ASSISTENTE do corretor — despacho dos comandos interpretados pelo motor PURO
// de @imobia/core (interpretarComando) para a camada de dados. Módulo
// server-side (NÃO é "use server" no topo: exporta TIPOS além de funções
// async); a Server Action carrega a diretiva inline no corpo.
//
// DIVISÃO DE RESPONSABILIDADE: a INTERPRETAÇÃO é 100% pura e determinística
// (@imobia/core, com o "agora" INJETADO aqui no frame do produto —
// agoraSaoPauloISO de lib/fuso.ts, ISO com offset de America/Sao_Paulo, para
// que "hoje"/"amanhã" e as horas sigam o relógio brasileiro e os instantes
// gravados sejam reais); este módulo só EXECUTA o comando reusando as camadas
// existentes (agenda,
// tarefas, negócios, prioridades) — nada de NLP/IO no core, nada de regex aqui.
//
// SEGURANÇA: exige papel profissional (corretor/gestor/admin); a RLS escopa
// todas as leituras/escritas. NUNCA executa nada destrutivo (só cria/consulta).
// Erros de banco viram mensagem GENTIL sem detalhes técnicos. pt-BR.

import {
  descreverComando,
  interpretarComando,
  type ComandoInterpretado,
} from "@imobia/core";
import { revalidatePath } from "next/cache";
import { obterPerfil, obterSessao } from "@/lib/auth/sessao";
import { agoraSaoPauloISO, intervaloDoDiaSaoPaulo } from "@/lib/fuso";
import { criarEvento, listarEventos, type EventoAgenda } from "@/lib/dados/agenda";
import { adicionarAtividade, criarNegocio } from "@/lib/dados/negocios";
import { prioridades } from "@/lib/dados/prioridades";
import { criarTarefa } from "@/lib/dados/tarefas";
import { criarClienteServidor } from "@/lib/supabase/server";

// --- Tipos de saída (prontos para a UI do assistente) ---

/** Urgência de um aviso (espelha NivelPrioridade da central de comando). */
export type NivelAviso = "critico" | "alto" | "medio";

/** Um aviso acionável (projeção serializável de ItemPrioridade — sem ícone). */
export type AvisoAssistente = {
  titulo: string;
  subtitulo: string;
  href: string;
  nivel: NivelAviso;
};

/** Resposta do assistente para a UI (balão de chat + payloads opcionais). */
export type RespostaAssistente = {
  texto: string;
  tipo: "agenda" | "avisos" | "confirmacao" | "erro" | "ajuda";
  /** Eventos do dia consultado (tipo "agenda"). */
  eventos?: EventoAgenda[];
  /** Avisos da fila de prioridades (tipo "avisos"). */
  avisos?: AvisoAssistente[];
  /** Link de continuação após uma ação bem-sucedida (tipo "confirmacao"). */
  acaoRealizada?: { rotulo: string; href?: string };
};

const TEXTO_AJUDA = [
  "Posso ajudar com comandos como:",
  '• "agendar visita com Ana amanhã às 15h"',
  '• "me lembra de ligar para o cartório sexta às 9h"',
  '• "criar tarefa enviar proposta no negócio da Sofia"',
  '• "criar negócio com Pedro de 450 mil"',
  '• "anota no negócio da Camila: prefere andar alto"',
  '• "como está minha agenda hoje?"',
  '• "quais são meus avisos?"',
].join("\n");

const ERRO_GENERICO: RespostaAssistente = {
  texto: "Não consegui completar agora — tente de novo em instantes.",
  tipo: "erro",
};

// --- Helpers ---

/** "2026-07-04" ⇒ "04/07" (rótulo curto de dia para as respostas). */
function rotuloDia(diaISO: string, hojeISO: string): string {
  if (diaISO === hojeISO) {
    return "hoje";
  }
  const [, mes, dia] = diaISO.split("-");
  return `no dia ${dia}/${mes}`;
}

/**
 * Negócio ABERTO do corretor logado cujo nome_contato casa com `contato`
 * (ilike). Ambíguo ⇒ o de movimento mais recente. null se nenhum casa.
 * A RLS já escopa; filtramos por corretor_id = sessão (agenda é pessoal).
 */
async function buscarNegocioAbertoPorContato(
  contato: string,
): Promise<{ id: string; nomeContato: string } | null> {
  const sessao = await obterSessao();
  if (!sessao) {
    return null;
  }
  const padrao = contato.replace(/[%_]/g, "").trim();
  if (!padrao) {
    return null;
  }
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("negocios")
    .select("id, nome_contato")
    .eq("corretor_id", sessao.usuarioId)
    .is("resultado", null)
    .ilike("nome_contato", `%${padrao}%`)
    .order("atualizado_em", { ascending: false, nullsFirst: false })
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return { id: data.id, nomeContato: data.nome_contato };
}

function erroNegocioNaoEncontrado(contato: string): RespostaAssistente {
  return {
    texto:
      `Não achei um negócio aberto de "${contato}" na sua carteira. ` +
      `Que tal criar um? Diga "criar negócio com ${contato}".`,
    tipo: "erro",
  };
}

// --- Despacho por intenção ---

async function despachar(cmd: ComandoInterpretado, agoraISO: string): Promise<RespostaAssistente> {
  switch (cmd.intencao) {
    case "consultar_agenda": {
      const { deISO, ateISO } = intervaloDoDiaSaoPaulo(cmd.dia);
      const eventos = await listarEventos(deISO, ateISO);
      const rotulo = rotuloDia(cmd.dia, agoraISO.slice(0, 10));
      const texto =
        eventos.length === 0
          ? `Agenda livre ${rotulo} ✨`
          : eventos.length === 1
            ? `Você tem 1 compromisso ${rotulo}.`
            : `Você tem ${eventos.length} compromissos ${rotulo}.`;
      return { texto, tipo: "agenda", eventos };
    }

    case "criar_evento": {
      const negocio =
        cmd.contato !== undefined ? await buscarNegocioAbertoPorContato(cmd.contato) : null;
      await criarEvento(
        {
          titulo: cmd.titulo,
          tipo: cmd.tipo,
          inicio: cmd.inicioISO,
          ...(cmd.local !== undefined ? { local: cmd.local } : {}),
          ...(negocio ? { negocioId: negocio.id } : {}),
        },
        "assistente",
      );
      revalidatePath("/corretor/agenda");
      return {
        texto: `Feito! ${descreverComando(cmd)}`,
        tipo: "confirmacao",
        acaoRealizada: { rotulo: "Ver agenda", href: "/corretor/agenda" },
      };
    }

    case "criar_lembrete": {
      await criarEvento(
        { titulo: cmd.titulo, tipo: "lembrete", inicio: cmd.inicioISO },
        "assistente",
      );
      revalidatePath("/corretor/agenda");
      return {
        texto: `Feito! ${descreverComando(cmd)}`,
        tipo: "confirmacao",
        acaoRealizada: { rotulo: "Ver agenda", href: "/corretor/agenda" },
      };
    }

    case "criar_tarefa": {
      if (cmd.contato === undefined) {
        return {
          texto:
            "De qual negócio é essa tarefa? " +
            'Diga, por exemplo, "criar tarefa enviar contrato no negócio da Sofia".',
          tipo: "erro",
        };
      }
      const negocio = await buscarNegocioAbertoPorContato(cmd.contato);
      if (!negocio) {
        return erroNegocioNaoEncontrado(cmd.contato);
      }
      await criarTarefa({
        negocioId: negocio.id,
        titulo: cmd.titulo,
        venceEm: cmd.venceEm ?? null,
      });
      revalidatePath(`/corretor/negocios/${negocio.id}`);
      return {
        texto: `Feito! ${descreverComando(cmd)}`,
        tipo: "confirmacao",
        acaoRealizada: { rotulo: "Ver negócio", href: `/corretor/negocios/${negocio.id}` },
      };
    }

    case "criar_negocio": {
      // Reusa criarNegocio (negocios.ts): valida, deriva org/corretor da
      // sessão e registra a atividade 'criacao'.
      await criarNegocio({
        nomeContato: cmd.contato,
        valor: cmd.valor ?? null,
        origem: cmd.origem ?? "Assistente",
      });
      revalidatePath("/corretor/negocios");
      return {
        texto: `Feito! ${descreverComando(cmd)}`,
        tipo: "confirmacao",
        acaoRealizada: { rotulo: "Ver funil", href: "/corretor/negocios" },
      };
    }

    case "registrar_nota": {
      const negocio = await buscarNegocioAbertoPorContato(cmd.contato);
      if (!negocio) {
        return erroNegocioNaoEncontrado(cmd.contato);
      }
      // Reusa adicionarAtividade (negocios.ts): tipo 'nota' na timeline.
      await adicionarAtividade(negocio.id, "nota", cmd.nota);
      revalidatePath(`/corretor/negocios/${negocio.id}`);
      return {
        texto: `Anotado na ficha de ${negocio.nomeContato}.`,
        tipo: "confirmacao",
        acaoRealizada: { rotulo: "Ver negócio", href: `/corretor/negocios/${negocio.id}` },
      };
    }

    case "consultar_avisos": {
      const itens = await prioridades("meu");
      const avisos: AvisoAssistente[] = itens.map((i) => ({
        titulo: i.titulo,
        subtitulo: i.subtitulo,
        href: i.href,
        nivel: i.nivel,
      }));
      const texto =
        avisos.length === 0
          ? "Tudo em dia por aqui ✨"
          : avisos.length === 1
            ? "Você tem 1 ponto pedindo atenção."
            : `Você tem ${avisos.length} pontos pedindo atenção.`;
      return { texto, tipo: "avisos", avisos };
    }

    case "ajuda":
      return { texto: TEXTO_AJUDA, tipo: "ajuda" };
  }
}

// --- Server Action ---

/**
 * Executa um comando falado/digitado do assistente. Interpreta com o motor
 * puro (@imobia/core, "agora" injetado) e despacha para a camada de dados.
 * Exige papel corretor/gestor/admin. NUNCA lança: qualquer falha vira uma
 * RespostaAssistente gentil (tipo "erro"), sem vazar detalhes do banco.
 */
export async function executarComandoAction(texto: string): Promise<RespostaAssistente> {
  "use server";
  const sessao = await obterSessao();
  const perfil = sessao ? await obterPerfil(sessao.usuarioId) : null;
  if (!sessao || !perfil || perfil.papel === "cliente" || !perfil.orgId) {
    return {
      texto: "O assistente é exclusivo para corretores e gestores. Faça login com sua conta profissional.",
      tipo: "erro",
    };
  }

  const agoraISO = agoraSaoPauloISO();
  const cmd = interpretarComando(texto, agoraISO);
  try {
    return await despachar(cmd, agoraISO);
  } catch {
    return ERRO_GENERICO;
  }
}
