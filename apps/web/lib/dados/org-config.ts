"use server";

// CENTRAL DE CONFIGURAÇÃO DA ORG (migração 0033, tabela org_config) — módulo
// "use server" (padrão atendimento-config.ts): leitura da config que GOVERNA
// os envios (modo WhatsApp teste/produção, e-mail simulado/real, motivos de
// perda, destino do Lead Ads) + salvamento por gestor/admin (RLS reforça).
//
// SEGURANÇA (default inegociável): org sem linha/linha corrompida se comporta
// como 'teste' + 'simulado' — NUNCA degradamos para "envia tudo". A leitura é
// cacheada POR REQUEST (React cache): página + gates de envio na mesma
// requisição fazem UMA query.

import { cache } from "react";
import { revalidatePath } from "next/cache";
import {
  orgConfigSchema,
  telefoneWhatsappSchema,
  type OrgConfig,
  type OrgConfigInput,
} from "@imobia/domain";
import { obterPerfil, obterSessao } from "@/lib/auth/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";

export type ResultadoOrgConfig = { ok: true } | { ok: false; erro: string };

// Defaults SEGUROS do schema (teste/simulado) — usados quando não há linha.
const CONFIG_PADRAO: OrgConfig = orgConfigSchema.parse({});

/** Gate de papel: só gestor/admin altera a central (RLS 0033 reforça). */
async function exigirGestor(): Promise<{ orgId: string }> {
  const sessao = await obterSessao();
  if (!sessao) {
    throw new Error("não autenticado");
  }
  const perfil = await obterPerfil(sessao.usuarioId);
  if (!perfil || (perfil.papel !== "gestor" && perfil.papel !== "admin") || !perfil.orgId) {
    throw new Error("sem permissão de gestor");
  }
  return { orgId: perfil.orgId };
}

const obterOrgConfigCacheada = cache(async (): Promise<OrgConfig | null> => {
  const sessao = await obterSessao();
  if (!sessao) {
    return null;
  }
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("org_config")
    .select(
      "whatsapp_modo, whatsapp_numeros_teste, email_modo, motivos_perda, leadads_funil_id, leadads_consentimento",
    )
    .maybeSingle();
  if (!data) {
    return CONFIG_PADRAO;
  }
  // Revalida o que veio do banco — lixo degrada para os defaults SEGUROS.
  const parsed = orgConfigSchema.safeParse({
    whatsappModo: data.whatsapp_modo,
    whatsappNumerosTeste: data.whatsapp_numeros_teste,
    emailModo: data.email_modo,
    motivosPerda: data.motivos_perda,
    leadadsFunilId: data.leadads_funil_id,
    leadadsConsentimento: data.leadads_consentimento,
  });
  return parsed.success ? parsed.data : CONFIG_PADRAO;
});

/**
 * Config central da org logada (toda a equipe LÊ — os gates e banners
 * precisam dela). Sem linha ⇒ defaults seguros (teste/simulado). Anônimo ⇒
 * null. Cache por request.
 */
export async function obterOrgConfig(): Promise<OrgConfig | null> {
  return obterOrgConfigCacheada();
}

/**
 * Salva a central da org (upsert da linha única; gestor/admin). O input é
 * PARCIAL: cada seção da página /corretor/config envia só os campos dela e o
 * restante é preservado a partir da config vigente (defaults seguros quando a
 * org ainda não tem linha). Números de teste aceitam máscara livre
 * ("(11) 98888-7777") e são NORMALIZADOS para dígitos com DDI 55 antes da
 * validação — mesmo formato que o gate compara.
 */
export async function salvarOrgConfigAction(
  input: Partial<OrgConfigInput>,
): Promise<ResultadoOrgConfig> {
  let ctx: { orgId: string };
  try {
    ctx = await exigirGestor();
  } catch {
    return { ok: false, erro: "Só gestor ou admin alteram a central de configuração." };
  }

  // Base = config vigente (a action roda em request próprio, cache fresco).
  const atual = (await obterOrgConfigCacheada()) ?? CONFIG_PADRAO;

  // Normaliza os números de teste ANTES do zod (máscara → dígitos com 55).
  let numeros: string[] = atual.whatsappNumerosTeste;
  if (input.whatsappNumerosTeste !== undefined) {
    numeros = [];
    for (const bruto of input.whatsappNumerosTeste) {
      if (String(bruto).trim() === "") {
        continue;
      }
      const r = telefoneWhatsappSchema.safeParse(String(bruto));
      if (!r.success) {
        return { ok: false, erro: "Número de teste inválido — use DDD + número (ex.: 11 98888-7777)." };
      }
      if (!numeros.includes(r.data)) {
        numeros.push(r.data);
      }
    }
  }

  const parsed = orgConfigSchema.safeParse({
    whatsappModo: input.whatsappModo ?? atual.whatsappModo,
    whatsappNumerosTeste: numeros,
    emailModo: input.emailModo ?? atual.emailModo,
    motivosPerda: input.motivosPerda ?? atual.motivosPerda,
    leadadsFunilId:
      input.leadadsFunilId !== undefined ? input.leadadsFunilId : atual.leadadsFunilId,
    leadadsConsentimento: input.leadadsConsentimento ?? atual.leadadsConsentimento,
  });
  if (!parsed.success) {
    return { ok: false, erro: "Confira os campos: há valores fora dos limites." };
  }
  const d = parsed.data;

  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("org_config").upsert(
    {
      org_id: ctx.orgId,
      whatsapp_modo: d.whatsappModo,
      whatsapp_numeros_teste: d.whatsappNumerosTeste,
      email_modo: d.emailModo,
      motivos_perda: d.motivosPerda,
      leadads_funil_id: d.leadadsFunilId ?? null,
      leadads_consentimento: d.leadadsConsentimento,
    },
    { onConflict: "org_id" },
  );
  if (error) {
    return { ok: false, erro: "Não foi possível salvar a configuração. Tente novamente." };
  }
  revalidatePath("/corretor/config");
  revalidatePath("/corretor/crm");
  revalidatePath("/corretor/crm/conversas");
  revalidatePath("/corretor/crm/campanhas");
  revalidatePath("/corretor/newsletter");
  return { ok: true };
}
