// NORMALIZAÇÃO da saída do interpretador LLM — módulo PURO (só zod + tipos do
// core; ZERO import de @ai-sdk/ai), extraído de interpretador-llm.ts para ser
// testável sem rede/chave. É a fronteira de segurança declarada nos invariantes
// do interpretador: o LLM não é confiável por construção, então TUDO que ele
// emite é revalidado aqui (datas, instantes, valor em CENTAVOS inteiro ≥ 0,
// telefone 8–13 dígitos, e-mail com formato) antes de virar ComandoInterpretado.

import { z } from "zod";
import type { ComandoInterpretado } from "@imobia/core";

// --- Schema zod que ESPELHA a união ComandoInterpretado do core -------------
// (o core não exporta zod; reconstruída aqui. Campos opcionais aceitam null —
// LLMs costumam emitir null em vez de omitir — e são normalizados adiante.)

const opcional = <T extends z.ZodTypeAny>(tipo: T) => tipo.nullish();

export const SCHEMA_COMANDO = z.discriminatedUnion("intencao", [
  z.object({
    intencao: z.literal("consultar_agenda"),
    dia: z.string().describe("Dia consultado, YYYY-MM-DD"),
  }),
  z.object({
    intencao: z.literal("criar_evento"),
    titulo: z.string().describe('Título curto, ex.: "Visita com Ana"'),
    tipo: z.enum(["visita", "reuniao", "compromisso"]),
    inicioISO: z
      .string()
      .describe("Início ISO com offset, ex.: 2026-07-04T15:00:00-03:00"),
    local: opcional(z.string()),
    contato: opcional(z.string()),
  }),
  z.object({
    intencao: z.literal("criar_lembrete"),
    titulo: z.string(),
    inicioISO: z.string().describe("ISO com offset -03:00"),
  }),
  z.object({
    intencao: z.literal("criar_tarefa"),
    titulo: z.string(),
    contato: opcional(z.string()),
    venceEm: opcional(z.string().describe("YYYY-MM-DD")),
  }),
  z.object({
    intencao: z.literal("criar_negocio"),
    contato: z.string(),
    valor: opcional(z.number().describe("Valor em CENTAVOS de real (inteiro)")),
    origem: opcional(z.string()),
  }),
  z.object({
    intencao: z.literal("registrar_nota"),
    contato: z.string(),
    nota: z.string(),
  }),
  z.object({
    intencao: z.literal("mudar_etapa"),
    contato: z.string(),
    etapa: z.enum(["novo", "contato", "visita", "proposta", "fechamento", "proxima"]),
  }),
  z.object({
    intencao: z.literal("marcar_resultado"),
    contato: z.string(),
    resultado: z.enum(["ganho", "perdido"]),
    valor: opcional(z.number().describe("Valor em CENTAVOS de real (inteiro)")),
  }),
  z.object({
    intencao: z.literal("atualizar_valor"),
    contato: z.string(),
    valor: z.number().describe("Valor em CENTAVOS de real (inteiro)"),
  }),
  z.object({
    intencao: z.literal("atualizar_contato_info"),
    contato: z.string(),
    telefone: opcional(z.string().describe("Só dígitos, ex.: 11988887777")),
    email: opcional(z.string()),
  }),
  z.object({
    intencao: z.literal("concluir_tarefa"),
    contato: opcional(z.string()),
    titulo: opcional(z.string()),
  }),
  z.object({
    intencao: z.literal("gerar_mensagem"),
    contato: z.string(),
    objetivo: z.enum(["followup", "visita", "proposta", "reativacao", "pos_venda"]),
  }),
  z.object({ intencao: z.literal("consultar_avisos") }),
  z.object({ intencao: z.literal("ajuda"), motivo: opcional(z.string()) }),
]);

export type SaidaLlm = z.infer<typeof SCHEMA_COMANDO>;

// --- Validação/normalização da saída ----------------------------------------

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

export function dataValida(dia: string): boolean {
  if (!RE_DATA.test(dia)) return false;
  const d = new Date(`${dia}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === dia;
}

export function instanteValido(iso: string): boolean {
  return !Number.isNaN(new Date(iso).getTime());
}

export function texto(s: string | null | undefined): string | undefined {
  const limpo = s?.trim();
  return limpo ? limpo : undefined;
}

/** Converte a saída do LLM num ComandoInterpretado consistente, ou null. */
export function normalizar(saida: SaidaLlm): ComandoInterpretado | null {
  switch (saida.intencao) {
    case "consultar_agenda":
      return dataValida(saida.dia) ? { intencao: "consultar_agenda", dia: saida.dia } : null;

    case "criar_evento": {
      const titulo = texto(saida.titulo);
      if (!titulo || !instanteValido(saida.inicioISO)) return null;
      const local = texto(saida.local);
      const contato = texto(saida.contato);
      return {
        intencao: "criar_evento",
        titulo,
        tipo: saida.tipo,
        inicioISO: saida.inicioISO,
        ...(local !== undefined ? { local } : {}),
        ...(contato !== undefined ? { contato } : {}),
      };
    }

    case "criar_lembrete": {
      const titulo = texto(saida.titulo);
      if (!titulo || !instanteValido(saida.inicioISO)) return null;
      return { intencao: "criar_lembrete", titulo, inicioISO: saida.inicioISO };
    }

    case "criar_tarefa": {
      const titulo = texto(saida.titulo);
      if (!titulo) return null;
      const contato = texto(saida.contato);
      const venceEm = texto(saida.venceEm);
      if (venceEm !== undefined && !dataValida(venceEm)) return null;
      return {
        intencao: "criar_tarefa",
        titulo,
        ...(contato !== undefined ? { contato } : {}),
        ...(venceEm !== undefined ? { venceEm } : {}),
      };
    }

    case "criar_negocio": {
      const contato = texto(saida.contato);
      if (!contato) return null;
      const valor = saida.valor ?? undefined;
      if (valor !== undefined && (!Number.isInteger(valor) || valor < 0)) return null;
      const origem = texto(saida.origem);
      return {
        intencao: "criar_negocio",
        contato,
        ...(valor !== undefined ? { valor } : {}),
        ...(origem !== undefined ? { origem } : {}),
      };
    }

    case "registrar_nota": {
      const contato = texto(saida.contato);
      const nota = texto(saida.nota);
      return contato && nota ? { intencao: "registrar_nota", contato, nota } : null;
    }

    case "mudar_etapa": {
      const contato = texto(saida.contato);
      return contato ? { intencao: "mudar_etapa", contato, etapa: saida.etapa } : null;
    }

    case "marcar_resultado": {
      const contato = texto(saida.contato);
      if (!contato) return null;
      const valor = saida.valor ?? undefined;
      if (valor !== undefined && (!Number.isInteger(valor) || valor < 0)) return null;
      return {
        intencao: "marcar_resultado",
        contato,
        resultado: saida.resultado,
        ...(valor !== undefined ? { valor } : {}),
      };
    }

    case "atualizar_valor": {
      const contato = texto(saida.contato);
      if (!contato || !Number.isInteger(saida.valor) || saida.valor < 0) return null;
      return { intencao: "atualizar_valor", contato, valor: saida.valor };
    }

    case "atualizar_contato_info": {
      const contato = texto(saida.contato);
      if (!contato) return null;
      // Telefone SÓ dígitos (mesma normalização do motor); fora de 8–13 ⇒ fora.
      const digitos = texto(saida.telefone)?.replace(/\D/g, "");
      const telefone = digitos && digitos.length >= 8 && digitos.length <= 13 ? digitos : undefined;
      const emailBruto = texto(saida.email);
      const email = emailBruto && /^\S+@\S+\.\S+$/.test(emailBruto) ? emailBruto : undefined;
      if (telefone === undefined && email === undefined) return null;
      return {
        intencao: "atualizar_contato_info",
        contato,
        ...(telefone !== undefined ? { telefone } : {}),
        ...(email !== undefined ? { email } : {}),
      };
    }

    case "concluir_tarefa": {
      const contato = texto(saida.contato);
      const titulo = texto(saida.titulo);
      if (contato === undefined && titulo === undefined) return null;
      return {
        intencao: "concluir_tarefa",
        ...(contato !== undefined ? { contato } : {}),
        ...(titulo !== undefined ? { titulo } : {}),
      };
    }

    case "gerar_mensagem": {
      const contato = texto(saida.contato);
      return contato
        ? { intencao: "gerar_mensagem", contato, objetivo: saida.objetivo }
        : null;
    }

    case "consultar_avisos":
      return { intencao: "consultar_avisos" };

    case "ajuda": {
      const motivo = texto(saida.motivo);
      return { intencao: "ajuda", ...(motivo !== undefined ? { motivo } : {}) };
    }
  }
}

// --- Âncoras de calendário para o prompt --------------------------------------

const DIAS_SEMANA = [
  "domingo", "segunda-feira", "terça-feira", "quarta-feira",
  "quinta-feira", "sexta-feira", "sábado",
] as const;

/** Dia da semana pt-BR dos componentes locais do ISO (sem mágica de fuso). */
export function diaDaSemanaLocal(agoraISO: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(agoraISO);
  if (!m) return "";
  const idx = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay();
  return DIAS_SEMANA[idx] ?? "";
}

/**
 * Calendário dos próximos 8 dias ("sexta 2026-07-03 (hoje), sábado
 * 2026-07-04, …") — âncora determinística para o LLM resolver dias da semana.
 */
export function calendarioProximosDias(agoraISO: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(agoraISO);
  if (!m) return "";
  const base = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const itens: string[] = [];
  for (let i = 0; i < 8; i += 1) {
    const d = new Date(base + i * 86_400_000);
    const dia = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    itens.push(`${DIAS_SEMANA[d.getUTCDay()]} ${dia}${i === 0 ? " (hoje)" : i === 1 ? " (amanhã)" : ""}`);
  }
  return itens.join(", ");
}
