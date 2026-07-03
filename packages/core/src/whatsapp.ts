// WhatsApp — motor PURO de geração de mensagens prontas pt-BR e de links
// wa.me para o corretor disparar com um clique.
//
// REGRAS DO MOTOR (invariantes):
//   - 100% determinístico: SEM IO, SEM Date.now() — tudo vem do contexto.
//   - NUNCA inventa dado: cada template só menciona imóvel, dias parado,
//     valor ou data de visita se o campo correspondente veio preenchido no
//     `ContextoMensagem`.
//   - Tom caloroso e profissional: 2–4 frases, UMA pergunta/CTA no final,
//     no máximo 1 emoji por mensagem.
//   - Link: https://wa.me/<numero>?text=<mensagem url-encoded>. Telefone com
//     10–11 dígitos ganha o DDI 55; 12–13 dígitos só valem se já começarem
//     com 55; qualquer outra coisa devolve null (nunca chuta número).

import { formatarReais } from "./modalidades";

/** Objetivos de mensagem que o gerador conhece. */
export type ObjetivoMensagem = "followup" | "visita" | "proposta" | "reativacao" | "pos_venda";

/** Contexto do negócio/contato usado para montar a mensagem. */
export interface ContextoMensagem {
  /** Nome completo do contato ("Sofia Almeida"). */
  nomeContato: string;
  /** Primeiro nome para o tratamento; se ausente, é derivado do nomeContato. */
  primeiroNome?: string;
  /** Nome do corretor que assina a mensagem. */
  nomeCorretor: string;
  /** Etapa atual do funil (informativo; não é obrigatório nos templates). */
  etapa?: string;
  /** Título do imóvel do negócio, se houver. */
  imovelTitulo?: string | null;
  /** Dias sem movimento no negócio, se conhecido. */
  diasSemMovimento?: number | null;
  /** Valor do negócio em CENTAVOS, se conhecido. */
  valor?: number | null;
  /** Data/hora da visita (ISO), quando o objetivo é confirmar uma visita. */
  dataVisitaISO?: string | null;
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/** "Sofia Almeida" ⇒ "Sofia" (ou o `primeiroNome` explícito, se veio). */
function primeiroNomeDe(ctx: ContextoMensagem): string {
  const explicito = ctx.primeiroNome?.trim();
  if (explicito) return explicito;
  return ctx.nomeContato.trim().split(/\s+/)[0] ?? ctx.nomeContato.trim();
}

/** "faz 1 dia" / "faz 12 dias" — só com valor conhecido e positivo. */
function fraseDias(n: number): string {
  return `faz ${n} ${n === 1 ? "dia" : "dias"} que não nos falamos`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

const DIAS_SEMANA = [
  "no domingo",
  "na segunda",
  "na terça",
  "na quarta",
  "na quinta",
  "na sexta",
  "no sábado",
] as const;

const RE_ISO_VISITA = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/;

/**
 * "2026-07-04T15:30:00-03:00" ⇒ "no sábado (04/07) às 15h30".
 * ISO inválido ⇒ null (a mensagem simplesmente não menciona a data).
 */
function formatarQuandoVisita(iso: string): string | null {
  const m = RE_ISO_VISITA.exec(iso.trim());
  if (!m || !m[1] || !m[2] || !m[3]) return null;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  // Date.UTC só como aritmética de calendário (dia da semana), nunca relógio.
  const semana = DIAS_SEMANA[new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()] ?? "";
  let quando = `${semana} (${pad2(dia)}/${pad2(mes)})`;
  if (m[4] !== undefined && m[5] !== undefined) {
    const h = Number(m[4]);
    const min = Number(m[5]);
    quando += ` às ${h}h${min === 0 ? "" : pad2(min)}`;
  }
  return quando;
}

function diasValidos(ctx: ContextoMensagem): number | null {
  const d = ctx.diasSemMovimento;
  return typeof d === "number" && Number.isFinite(d) && d >= 1 ? Math.floor(d) : null;
}

function imovelDe(ctx: ContextoMensagem): string | null {
  const t = ctx.imovelTitulo?.trim();
  return t ? t : null;
}

// ---------------------------------------------------------------------------
// gerarMensagemWhatsApp
// ---------------------------------------------------------------------------

/**
 * Gera a mensagem pronta (pt-BR, calorosa e profissional) para o objetivo
 * pedido, usando SOMENTE os dados presentes no contexto.
 */
export function gerarMensagemWhatsApp(objetivo: ObjetivoMensagem, ctx: ContextoMensagem): string {
  const p = primeiroNomeDe(ctx);
  const corretor = ctx.nomeCorretor.trim();
  const imovel = imovelDe(ctx);
  const dias = diasValidos(ctx);

  switch (objetivo) {
    case "followup": {
      const abertura = `Oi ${p}, tudo bem? Aqui é ${corretor}.`;
      if (imovel && dias !== null) {
        return `${abertura} ${fraseDias(dias).replace(/^faz/, "Faz")} e fiquei pensando se você teve tempo de avaliar o ${imovel}. Posso te ajudar com alguma dúvida?`;
      }
      if (imovel) {
        return `${abertura} Passando para saber se você teve tempo de pensar no ${imovel}. Posso te ajudar com alguma dúvida?`;
      }
      if (dias !== null) {
        return `${abertura} ${fraseDias(dias).replace(/^faz/, "Faz")} e queria saber como estão seus planos. Podemos conversar?`;
      }
      return `${abertura} Passando para saber como estão seus planos e se posso ajudar em algo. Podemos conversar?`;
    }

    case "visita": {
      const quando = ctx.dataVisitaISO ? formatarQuandoVisita(ctx.dataVisitaISO) : null;
      const abertura = `Oi ${p}, tudo bem? Aqui é ${corretor}.`;
      if (quando) {
        return imovel
          ? `${abertura} Passando para confirmar nossa visita ao ${imovel} ${quando}. Posso contar com você?`
          : `${abertura} Passando para confirmar nossa visita ${quando}. Posso contar com você?`;
      }
      return imovel
        ? `${abertura} Que tal conhecer o ${imovel} pessoalmente? Qual dia e horário ficam melhores para você?`
        : `${abertura} Que tal agendarmos uma visita para você conhecer o imóvel pessoalmente? Qual dia e horário ficam melhores para você?`;
    }

    case "proposta": {
      const abertura = `Oi ${p}, tudo bem? Aqui é ${corretor}.`;
      const valor = typeof ctx.valor === "number" && ctx.valor > 0 ? ctx.valor : null;
      if (valor !== null) {
        return imovel
          ? `${abertura} Sobre o ${imovel}: podemos avançar com a proposta de ${formatarReais(valor)}. Vamos alinhar os próximos passos?`
          : `${abertura} Podemos avançar com a proposta de ${formatarReais(valor)}. Vamos alinhar os próximos passos?`;
      }
      return imovel
        ? `${abertura} Queria alinhar com você os próximos passos da proposta do ${imovel}. Podemos conversar hoje?`
        : `${abertura} Queria alinhar com você os próximos passos da sua proposta. Podemos conversar hoje?`;
    }

    case "reativacao": {
      const abertura = `Oi ${p}, quanto tempo! Aqui é ${corretor}.`;
      if (imovel && dias !== null) {
        return `${abertura} ${fraseDias(dias).replace(/^faz/, "Faz")} e lembrei de você — queria saber se o ${imovel} ainda está nos seus planos. Vamos retomar a conversa?`;
      }
      if (imovel) {
        return `${abertura} Lembrei de você e queria saber se o ${imovel} ainda está nos seus planos. Vamos retomar a conversa?`;
      }
      if (dias !== null) {
        return `${abertura} ${fraseDias(dias).replace(/^faz/, "Faz")} e queria saber se você ainda está em busca de um imóvel. Vamos retomar a conversa?`;
      }
      return `${abertura} Lembrei de você e queria saber se ainda está em busca de um imóvel. Vamos retomar a conversa?`;
    }

    case "pos_venda": {
      const abertura = `Oi ${p}! Aqui é ${corretor}.`;
      return imovel
        ? `${abertura} Parabéns pela conquista do ${imovel} 🎉 Foi um prazer te acompanhar nessa jornada. Qualquer coisa que precisar, é só me chamar, combinado?`
        : `${abertura} Parabéns pelo fechamento do seu negócio 🎉 Foi um prazer te acompanhar nessa jornada. Qualquer coisa que precisar, é só me chamar, combinado?`;
    }
  }
}

// ---------------------------------------------------------------------------
// montarLinkWhatsApp
// ---------------------------------------------------------------------------

/**
 * Monta o link wa.me com a mensagem url-encoded.
 * Aceita telefone com formatação livre; considera só os dígitos:
 *   - 10–11 dígitos (DDD + número) ⇒ prefixa o DDI 55;
 *   - 12–13 dígitos JÁ começando com 55 ⇒ usa como está;
 *   - qualquer outro formato ⇒ null (nunca chuta o número).
 */
export function montarLinkWhatsApp(telefone: string, mensagem: string): string | null {
  const digitos = telefone.replace(/\D/g, "");
  let numero: string;
  if (digitos.length === 10 || digitos.length === 11) {
    numero = `55${digitos}`;
  } else if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55")) {
    numero = digitos;
  } else {
    return null;
  }
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}
