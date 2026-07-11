"use server";

// CONFIG DE ATENDIMENTO COM IA (migração 0029) — módulo "use server" (padrão
// contatos.ts): leitura da config da org + salvamento (gestor/admin, RLS
// reforça) + PLAYGROUND do "Treinar IA" (testeDePersonaAction: pergunta de
// teste respondida com a config REAL salva, contato fictício, sem banco de
// mensagens — nada vai para nenhum cliente).
//
// PRINCÍPIOS: as REGRAS FIXAS (transparência de IA, nunca inventar
// imóvel/preço) vivem no core e NÃO são configuráveis por aqui — persona/FAQ
// só ADICIONAM contexto. IA nasce DESLIGADA (ia_ativa=false).

import { revalidatePath } from "next/cache";
import {
  configAtendimentoSchema,
  type ConfigAtendimento,
  type ConfigAtendimentoInput,
} from "@imobia/domain";
import { obterPerfil, obterSessao } from "@/lib/auth/sessao";
import { responderComoAtendente } from "@/lib/ia/atendente";
import { iaDisponivel } from "@/lib/ia/cascata-groq";
import { permitido } from "@/lib/seguranca/limitador";
import { criarClienteServidor } from "@/lib/supabase/server";

// --- Tipos de saída ---

/** Config da org + o que o ambiente permite (para a UI ser honesta). */
export type ConfigAtendimentoDaOrg = {
  config: ConfigAtendimento;
  /** true se a org JÁ salvou uma config (false = defaults, nunca salvos). */
  existe: boolean;
  /** true se há GROQ_API_KEY no ambiente (sem ela a IA não responde NUNCA). */
  iaDisponivelNoAmbiente: boolean;
};

export type ResultadoConfig = { ok: true } | { ok: false; erro: string };

export type ResultadoTestePersona =
  | { ok: true; tipo: "resposta" | "escalar"; texto: string }
  | { ok: false; erro: string };

// --- Helpers internos ---

async function exigirEquipe(): Promise<{ usuarioId: string; orgId: string; papel: string }> {
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

async function exigirGestor(): Promise<{ usuarioId: string; orgId: string }> {
  const ctx = await exigirEquipe();
  if (ctx.papel !== "gestor" && ctx.papel !== "admin") {
    throw new Error("só gestor/admin configuram a IA");
  }
  return { usuarioId: ctx.usuarioId, orgId: ctx.orgId };
}

const CONFIG_PADRAO: ConfigAtendimento = configAtendimentoSchema.parse({});

// --- Leitura ---

/**
 * Config de atendimento da org (toda a equipe LÊ — a UI mostra o estado da
 * IA). Sem linha salva ⇒ defaults do schema (IA desligada). Anônimo ⇒ null.
 */
export async function obterConfigAtendimento(): Promise<ConfigAtendimentoDaOrg | null> {
  const sessao = await obterSessao();
  if (!sessao) {
    return null;
  }
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("atendimento_config")
    .select("ia_ativa, nome_assistente, persona, boas_vindas, faq, escalar_quando")
    .maybeSingle();
  if (!data) {
    return {
      config: CONFIG_PADRAO,
      existe: false,
      iaDisponivelNoAmbiente: iaDisponivel(),
    };
  }
  // Revalida o que veio do banco (faq é jsonb livre) — lixo vira default.
  const parsed = configAtendimentoSchema.safeParse({
    iaAtiva: data.ia_ativa,
    nomeAssistente: data.nome_assistente,
    persona: data.persona ?? undefined,
    boasVindas: data.boas_vindas ?? undefined,
    faq: data.faq,
    escalarQuando: data.escalar_quando ?? undefined,
  });
  return {
    config: parsed.success ? parsed.data : CONFIG_PADRAO,
    existe: true,
    iaDisponivelNoAmbiente: iaDisponivel(),
  };
}

// --- Escrita (contrato { ok } — nunca lança) ---

/**
 * Salva a config da org (upsert da linha única; gestor/admin — a RLS 0029
 * reforça). O zod valida limites (persona ≤ 2000, FAQ ≤ 30 itens etc.).
 */
export async function salvarConfigAction(
  input: ConfigAtendimentoInput,
): Promise<ResultadoConfig> {
  let ctx: { orgId: string };
  try {
    ctx = await exigirGestor();
  } catch {
    return { ok: false, erro: "Só gestor ou admin configuram a IA de atendimento." };
  }
  const parsed = configAtendimentoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: "Confira os campos: há valores fora dos limites." };
  }
  const d = parsed.data;
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("atendimento_config").upsert(
    {
      org_id: ctx.orgId,
      ia_ativa: d.iaAtiva,
      nome_assistente: d.nomeAssistente,
      persona: d.persona ?? null,
      boas_vindas: d.boasVindas ?? null,
      faq: d.faq,
      escalar_quando: d.escalarQuando ?? null,
    },
    { onConflict: "org_id" },
  );
  if (error) {
    return { ok: false, erro: "Não foi possível salvar a configuração. Tente novamente." };
  }
  revalidatePath("/corretor/crm");
  return { ok: true };
}

/**
 * PLAYGROUND do "Treinar IA": responde `pergunta` com a config SALVA da org e
 * um contato fictício — nada é gravado, nada vai a nenhum cliente. Funciona
 * mesmo com ia_ativa=false (é treino); exige GROQ_API_KEY no ambiente.
 */
export async function testeDePersonaAction(
  pergunta: string,
): Promise<ResultadoTestePersona> {
  let ctx: { usuarioId: string; orgId: string };
  try {
    ctx = await exigirGestor();
  } catch {
    return { ok: false, erro: "Só gestor ou admin testam a IA de atendimento." };
  }
  const texto = pergunta.trim();
  if (texto === "" || texto.length > 1000) {
    return { ok: false, erro: "Escreva uma pergunta de teste de 1 a 1000 caracteres." };
  }
  if (!permitido(`treinar-ia:${ctx.usuarioId}`, 10, 60_000)) {
    return { ok: false, erro: "Muitos testes em sequência — aguarde um instante." };
  }
  if (!iaDisponivel()) {
    return {
      ok: false,
      erro: "IA desligada neste ambiente (sem GROQ_API_KEY) — as conversas caem na fila humana.",
    };
  }

  const dados = await obterConfigAtendimento();
  const config = dados?.config ?? CONFIG_PADRAO;
  const resposta = await responderComoAtendente(
    {
      nomeAssistente: config.nomeAssistente,
      persona: config.persona,
      faq: config.faq,
      escalarQuando: config.escalarQuando,
    },
    { nome: "Cliente de teste" },
    [],
    texto,
  );
  if (resposta === null) {
    return { ok: false, erro: "A IA não respondeu a tempo — tente de novo." };
  }
  if (resposta.tipo === "resposta") {
    return { ok: true, tipo: "resposta", texto: resposta.texto };
  }
  return {
    ok: true,
    tipo: "escalar",
    texto: `Esta mensagem ESCALARIA para a fila humana (motivo: ${resposta.motivo}).`,
  };
}
