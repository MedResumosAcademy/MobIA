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
  formatarDiaCurto,
  formatarFone,
  formatarInstanteCurto,
  formatarReais,
  interpretarComando,
  type ComandoInterpretado,
} from "@imobia/core";
import type { EtapaNegocio, ResultadoNegocio } from "@imobia/domain";
import { revalidatePath } from "next/cache";
import { obterPerfil, obterSessao } from "@/lib/auth/sessao";
import { agoraSaoPauloISO, intervaloDoDiaSaoPaulo } from "@/lib/fuso";
import { iaDisponivel, interpretarComLlm } from "@/lib/ia/interpretador-llm";
import { criarEvento, listarEventos, type EventoAgenda } from "@/lib/dados/agenda";
import {
  adicionarAtividade,
  atualizarNegocio,
  criarNegocio,
  definirResultado,
  moverEtapa,
} from "@/lib/dados/negocios";
import { prioridades } from "@/lib/dados/prioridades";
import { concluirTarefa, criarTarefa } from "@/lib/dados/tarefas";
import { gerarMensagemNegocioAction } from "@/lib/dados/whatsapp";
import { criarClienteServidor } from "@/lib/supabase/server";
import { ETAPAS_ORDEM, ROTULO_ETAPA } from "@/app/corretor/negocios/rotulos";

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
  /** true quando o comando foi entendido pelo fallback de IA (selo na UI). */
  viaIa?: boolean;
};

const TEXTO_AJUDA = [
  "Posso ajudar com comandos como:",
  '• "agendar visita com Ana amanhã às 15h"',
  '• "me lembra de ligar para o cartório sexta às 9h"',
  '• "criar tarefa enviar proposta no negócio da Sofia"',
  '• "criar negócio com Pedro de 450 mil"',
  '• "passa a Sofia para proposta"',
  '• "fechei com a Camila por 780 mil"',
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
 * Normaliza texto para busca TOLERANTE A ACENTOS e caixa: "Patricia" deve
 * casar "Patrícia Nunes" (digitação sem acento e transcrição de voz divergem
 * do cadastro com frequência em pt-BR). NFD separa a marca diacrítica da
 * letra; \p{M} remove as marcas; lowercase fecha o casamento case-insensitive.
 */
function normalizarParaBusca(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

/**
 * Negócio ABERTO do corretor logado cujo nome_contato casa com `contato`
 * (accent/case-insensitive, em memória — ilike do Postgres é sensível a
 * acentos). Ambíguo ⇒ o de movimento mais recente. null se nenhum casa.
 * A RLS já escopa; filtramos por corretor_id = sessão (agenda é pessoal).
 */
async function buscarNegocioAbertoPorContato(
  contato: string,
): Promise<{ id: string; nomeContato: string } | null> {
  const sessao = await obterSessao();
  if (!sessao) {
    return null;
  }
  const padrao = normalizarParaBusca(contato);
  if (!padrao) {
    return null;
  }
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("negocios")
    .select("id, nome_contato")
    .eq("corretor_id", sessao.usuarioId)
    .is("resultado", null)
    .order("atualizado_em", { ascending: false, nullsFirst: false })
    .order("criado_em", { ascending: false });
  if (error || !data) {
    return null;
  }
  const achado = data.find((n) => normalizarParaBusca(n.nome_contato).includes(padrao));
  return achado ? { id: achado.id, nomeContato: achado.nome_contato } : null;
}

function erroNegocioNaoEncontrado(contato: string): RespostaAssistente {
  return {
    texto:
      `Não achei um negócio aberto de "${contato}" na sua carteira. ` +
      `Que tal criar um? Diga "criar negócio com ${contato}".`,
    tipo: "erro",
  };
}

/**
 * Negócio do corretor logado localizado por contato, para as intenções de
 * GESTÃO (mudar etapa, fechar, valor, contato). Diferente do helper acima:
 *   - traz etapa/resultado/valor (o despacho decide o que fazer com fechados);
 *   - prefere ABERTOS; se só há fechados, devolve o fechado mais recente para
 *     que o chamador responda um erro gentil ("já foi ganho") em vez de
 *     "não achei";
 *   - marca `ambiguo` quando 2+ negócios ABERTOS de nomes DIFERENTES casam o
 *     padrão (o escolhido é o de atualizado_em mais recente — e a confirmação
 *     avisa qual foi usado).
 */
type NegocioLocalizado = {
  id: string;
  nomeContato: string;
  etapa: EtapaNegocio;
  resultado: ResultadoNegocio | null;
  valor: number | null;
  ambiguo: boolean;
};

async function localizarNegocioPorContato(contato: string): Promise<NegocioLocalizado | null> {
  const sessao = await obterSessao();
  if (!sessao) {
    return null;
  }
  const padrao = normalizarParaBusca(contato);
  if (!padrao) {
    return null;
  }
  const supabase = await criarClienteServidor();
  // Sem ilike no banco (sensível a acentos): traz os negócios do corretor
  // já ordenados e casa o contato em memória, tolerante a acentos.
  const { data: todos, error } = await supabase
    .from("negocios")
    .select("id, nome_contato, etapa, resultado, valor")
    .eq("corretor_id", sessao.usuarioId)
    .order("atualizado_em", { ascending: false, nullsFirst: false })
    .order("criado_em", { ascending: false });
  if (error || !todos) {
    return null;
  }
  const data = todos.filter((n) => normalizarParaBusca(n.nome_contato).includes(padrao));
  if (data.length === 0) {
    return null;
  }
  const abertos = data.filter((n) => n.resultado === null);
  const escolhido = abertos[0] ?? data[0];
  if (!escolhido) {
    return null;
  }
  const nomesAbertos = new Set(abertos.map((n) => n.nome_contato.trim().toLowerCase()));
  return {
    id: escolhido.id,
    nomeContato: escolhido.nome_contato,
    etapa: escolhido.etapa as EtapaNegocio,
    resultado: (escolhido.resultado as ResultadoNegocio | null) ?? null,
    valor: escolhido.valor,
    ambiguo: nomesAbertos.size > 1,
  };
}

/** Sufixo da confirmação quando o contato casou mais de um negócio aberto. */
function sufixoAmbiguo(negocio: NegocioLocalizado): string {
  return negocio.ambiguo ? " Se era outro negócio, me diga o nome completo do contato." : "";
}

/** Erro gentil para tentativas de mexer num negócio já fechado. */
function erroNegocioFechado(negocio: NegocioLocalizado): RespostaAssistente {
  const rotulo = negocio.resultado === "ganho" ? "ganho 🎉" : "marcado como perdido";
  return {
    texto:
      `O negócio de ${negocio.nomeContato} já foi ${rotulo} — quer criar um novo? ` +
      `Diga "criar negócio com ${negocio.nomeContato}".`,
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
      // Participo por tipo: "Visita agendada", "Reunião agendada", "Compromisso agendado".
      const rotuloAgendado: Record<typeof cmd.tipo, string> = {
        visita: "Visita agendada",
        reuniao: "Reunião agendada",
        compromisso: "Compromisso agendado",
      };
      return {
        texto:
          `${rotuloAgendado[cmd.tipo]}: ${cmd.titulo} — ${formatarInstanteCurto(cmd.inicioISO)}` +
          (cmd.local !== undefined ? ` (${cmd.local})` : "") +
          ".",
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
        texto: `Lembrete criado: ${cmd.titulo} — ${formatarInstanteCurto(cmd.inicioISO)}.`,
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
        texto:
          `Tarefa criada: "${cmd.titulo}" no negócio de ${negocio.nomeContato}` +
          (cmd.venceEm !== undefined ? ` — vence ${formatarDiaCurto(cmd.venceEm)}` : "") +
          ".",
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
        texto:
          `Negócio criado com ${cmd.contato}` +
          (cmd.valor !== undefined ? ` de ${formatarReais(cmd.valor)}` : "") +
          (cmd.origem !== undefined ? ` (origem: ${cmd.origem})` : "") +
          ".",
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
        texto: `Nota registrada na ficha de ${negocio.nomeContato}.`,
        tipo: "confirmacao",
        acaoRealizada: { rotulo: "Ver negócio", href: `/corretor/negocios/${negocio.id}` },
      };
    }

    case "mudar_etapa": {
      const negocio = await localizarNegocioPorContato(cmd.contato);
      if (!negocio) {
        return erroNegocioNaoEncontrado(cmd.contato);
      }
      if (negocio.resultado !== null) {
        return erroNegocioFechado(negocio);
      }
      let destino: EtapaNegocio;
      if (cmd.etapa === "proxima") {
        const proxima = ETAPAS_ORDEM[ETAPAS_ORDEM.indexOf(negocio.etapa) + 1];
        if (proxima === undefined) {
          return {
            texto:
              `O negócio de ${negocio.nomeContato} já está no Fechamento — a última etapa ` +
              `do funil. Para encerrar, diga "fechei com ${negocio.nomeContato}" ou ` +
              `"perdi o negócio de ${negocio.nomeContato}".`,
            tipo: "erro",
          };
        }
        destino = proxima;
      } else {
        destino = cmd.etapa;
      }
      if (destino === negocio.etapa) {
        return {
          texto: `O negócio de ${negocio.nomeContato} já está na etapa ${ROTULO_ETAPA[destino]}.`,
          tipo: "erro",
        };
      }
      // Reusa moverEtapa (negocios.ts) — MESMO caminho do kanban: update da
      // etapa (o trigger toca atualizado_em) + atividade 'mudanca_etapa' na
      // timeline com a transição de→para. NÃO toca resultado.
      await moverEtapa(negocio.id, destino);
      revalidatePath("/corretor/negocios");
      revalidatePath(`/corretor/negocios/${negocio.id}`);
      return {
        texto:
          `Negócio de ${negocio.nomeContato} movido para ${ROTULO_ETAPA[destino]}.` +
          sufixoAmbiguo(negocio),
        tipo: "confirmacao",
        acaoRealizada: { rotulo: "Ver negócio", href: `/corretor/negocios/${negocio.id}` },
      };
    }

    case "marcar_resultado": {
      const negocio = await localizarNegocioPorContato(cmd.contato);
      if (!negocio) {
        return erroNegocioNaoEncontrado(cmd.contato);
      }
      if (negocio.resultado !== null) {
        return erroNegocioFechado(negocio);
      }
      // Valor primeiro (se veio), para o negócio fechar já com o valor certo.
      if (cmd.valor !== undefined) {
        await atualizarNegocio(negocio.id, { valor: cmd.valor });
      }
      // Reusa definirResultado (negocios.ts) — mesmo caminho do detalhe:
      // etapa='fechamento' + resultado + atividade 'ganho'/'perdido'; o
      // trigger negocios_gerenciar_fechamento carimba fechado_em.
      await definirResultado(negocio.id, cmd.resultado);
      revalidatePath("/corretor/negocios");
      revalidatePath(`/corretor/negocios/${negocio.id}`);
      const valorFinal = cmd.valor ?? negocio.valor;
      const texto =
        cmd.resultado === "ganho"
          ? `Venda registrada! 🎉 ${negocio.nomeContato}` +
            (valorFinal !== null ? ` — ${formatarReais(valorFinal)}` : "") +
            `. Parabéns pelo fechamento!` +
            sufixoAmbiguo(negocio)
          : `Negócio de ${negocio.nomeContato} marcado como perdido — registrei no seu ` +
            `funil. Faz parte do jogo; o próximo você fecha.` +
            sufixoAmbiguo(negocio);
      return {
        texto,
        tipo: "confirmacao",
        acaoRealizada: { rotulo: "Ver funil", href: "/corretor/negocios" },
      };
    }

    case "atualizar_valor": {
      const negocio = await localizarNegocioPorContato(cmd.contato);
      if (!negocio) {
        return erroNegocioNaoEncontrado(cmd.contato);
      }
      if (negocio.resultado !== null) {
        return erroNegocioFechado(negocio);
      }
      // Reusa atualizarNegocio (negocios.ts): patch de valor + atividade
      // descritiva na timeline (o trigger toca atualizado_em).
      await atualizarNegocio(negocio.id, { valor: cmd.valor });
      revalidatePath("/corretor/negocios");
      revalidatePath(`/corretor/negocios/${negocio.id}`);
      return {
        texto:
          `Valor atualizado: o negócio de ${negocio.nomeContato} agora é ` +
          `${formatarReais(cmd.valor)}.` +
          sufixoAmbiguo(negocio),
        tipo: "confirmacao",
        acaoRealizada: { rotulo: "Ver negócio", href: `/corretor/negocios/${negocio.id}` },
      };
    }

    case "atualizar_contato_info": {
      if (cmd.telefone === undefined && cmd.email === undefined) {
        // O motor não emite este estado; guarda para o fallback LLM.
        return {
          texto:
            "Qual telefone ou e-mail devo salvar? " +
            'Diga, por exemplo, "o telefone da Sofia é (11) 98888-7777".',
          tipo: "erro",
        };
      }
      const negocio = await localizarNegocioPorContato(cmd.contato);
      if (!negocio) {
        return erroNegocioNaoEncontrado(cmd.contato);
      }
      if (negocio.resultado !== null) {
        return erroNegocioFechado(negocio);
      }
      // Reusa atualizarNegocio (negocios.ts): telefone_contato/email_contato.
      await atualizarNegocio(negocio.id, {
        ...(cmd.telefone !== undefined ? { telefoneContato: cmd.telefone } : {}),
        ...(cmd.email !== undefined ? { emailContato: cmd.email } : {}),
      });
      revalidatePath(`/corretor/negocios/${negocio.id}`);
      const partes = [
        ...(cmd.telefone !== undefined ? [`telefone ${formatarFone(cmd.telefone)}`] : []),
        ...(cmd.email !== undefined ? [`e-mail ${cmd.email}`] : []),
      ];
      return {
        texto:
          `Contato salvo na ficha de ${negocio.nomeContato}: ${partes.join(" e ")}.` +
          sufixoAmbiguo(negocio),
        tipo: "confirmacao",
        acaoRealizada: { rotulo: "Ver negócio", href: `/corretor/negocios/${negocio.id}` },
      };
    }

    case "concluir_tarefa": {
      const sessao = await obterSessao();
      if (!sessao) {
        return ERRO_GENERICO;
      }
      // Escopo opcional pelo negócio do contato ("a tarefa da Sofia").
      let negocioId: string | undefined;
      if (cmd.contato !== undefined) {
        const negocio = await buscarNegocioAbertoPorContato(cmd.contato);
        if (!negocio) {
          return erroNegocioNaoEncontrado(cmd.contato);
        }
        negocioId = negocio.id;
      }
      if (cmd.titulo === undefined && negocioId === undefined) {
        // O motor não emite este estado; guarda para o fallback LLM.
        return {
          texto:
            "Qual tarefa você concluiu? " +
            'Diga, por exemplo, "concluí a tarefa enviar contrato".',
          tipo: "erro",
        };
      }
      // Tarefa ABERTA do corretor por título (casamento accent-insensitive em
      // memória — ilike do Postgres é sensível a acentos) e/ou negócio; se
      // casar mais de uma, vence a de vencimento mais próximo (sem prazo por
      // último).
      const supabase = await criarClienteServidor();
      let query = supabase
        .from("negocio_tarefas")
        .select("id, titulo, negocio_id")
        .eq("corretor_id", sessao.usuarioId)
        .eq("concluida", false);
      if (negocioId !== undefined) {
        query = query.eq("negocio_id", negocioId);
      }
      const { data: tarefas, error } = await query
        .order("vence_em", { ascending: true, nullsFirst: false })
        .order("criado_em", { ascending: true });
      if (error) {
        return ERRO_GENERICO;
      }
      const padraoTitulo = cmd.titulo !== undefined ? normalizarParaBusca(cmd.titulo) : null;
      const tarefa =
        (tarefas ?? []).find(
          (t) => padraoTitulo === null || normalizarParaBusca(t.titulo).includes(padraoTitulo),
        ) ?? null;
      if (!tarefa) {
        return {
          texto:
            "Não achei uma tarefa aberta " +
            (cmd.titulo !== undefined
              ? `parecida com "${cmd.titulo}"`
              : `no negócio de ${cmd.contato ?? ""}`.trimEnd()) +
            " — ela já pode ter sido concluída.",
          tipo: "erro",
        };
      }
      // Reusa concluirTarefa (tarefas.ts): o trigger negocio_tarefas_concluir
      // carimba concluida_em.
      await concluirTarefa(tarefa.id, true);
      revalidatePath(`/corretor/negocios/${tarefa.negocio_id}`);
      revalidatePath("/corretor");
      return {
        texto: `Tarefa concluída: "${tarefa.titulo}" ✅`,
        tipo: "confirmacao",
        acaoRealizada: { rotulo: "Ver negócio", href: `/corretor/negocios/${tarefa.negocio_id}` },
      };
    }

    case "gerar_mensagem": {
      // Localiza o negócio (prefere abertos; pós-venda pode cair num fechado
      // ganho — a mensagem de parabéns faz sentido justamente aí) e delega a
      // redação à camada de WhatsApp (IA com fallback no motor puro).
      const negocio = await localizarNegocioPorContato(cmd.contato);
      if (!negocio) {
        return erroNegocioNaoEncontrado(cmd.contato);
      }
      const resultado = await gerarMensagemNegocioAction(negocio.id, cmd.objetivo);
      if (!resultado.ok) {
        return { texto: resultado.erro, tipo: "erro" };
      }
      const semFone =
        resultado.waUrl === null
          ? `\n\n(sem telefone cadastrado — me diga o número: "o telefone da ${negocio.nomeContato} é...")`
          : "";
      return {
        texto: `Mensagem pronta para ${negocio.nomeContato}:\n\n${resultado.mensagem}${semFone}`,
        tipo: "confirmacao",
        acaoRealizada: resultado.waUrl
          ? { rotulo: "Abrir no WhatsApp", href: resultado.waUrl }
          : { rotulo: "Ver negócio", href: `/corretor/negocios/${negocio.id}` },
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
  // Caminho RÁPIDO: motor puro e determinístico. Só quando ele não entende
  // ("ajuda") e há chave configurada, o LLM tenta como FALLBACK — e qualquer
  // falha dele (timeout, erro, saída inválida) degrada para a ajuda de sempre.
  let cmd = interpretarComando(texto, agoraISO);
  let viaIa = false;
  if (cmd.intencao === "ajuda" && iaDisponivel()) {
    const cmdIa = await interpretarComLlm(texto, agoraISO);
    if (cmdIa !== null && cmdIa.intencao !== "ajuda") {
      cmd = cmdIa;
      viaIa = true;
    }
  }
  try {
    const resposta = await despachar(cmd, agoraISO);
    return viaIa ? { ...resposta, viaIa: true } : resposta;
  } catch {
    return ERRO_GENERICO;
  }
}
