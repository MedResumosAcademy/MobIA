// GATE DE ENVIO WhatsApp (central de configuração, 0033) — a função ÚNICA que
// decide se um número pode receber mensagem REAL pela Meta. TODAS as vias que
// chamam lib/meta passam por aqui: conversas 1:1 (texto/template), disparo de
// campanha e a resposta da IA no pipeline de atendimento. O SIMULADOR nunca
// passa pela Meta, então não passa pelo gate.
//
// REGRA (default inegociável):
//   - modo 'producao'  ⇒ pode;
//   - modo 'teste'     ⇒ só se o telefone está em whatsapp_numeros_teste;
//   - sem config/linha corrompida ⇒ comporta-se como 'teste' com lista vazia
//     (BLOQUEIA) — nunca degradamos para "envia tudo".
//
// Módulo server-side comum (não é "use server"): exporta a especificação PURA
// (avaliarGateEnvio, testada em envio-whatsapp.test.ts) + o helper async que
// carrega a config pelo client do CHAMADOR (sessão nas actions, service role
// no webhook — por isso o orgId é parâmetro explícito).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@imobia/domain";

export type GateEnvio = { pode: true } | { pode: false; motivo: "modo_teste" };

export type ConfigGateEnvio = {
  whatsappModo: string;
  whatsappNumerosTeste: string[];
};

/** Telefone em máscara livre → dígitos com DDI 55 (mesma regra do domínio). */
function normalizarDigitos(telefone: string): string {
  const digitos = telefone.replace(/\D/g, "");
  if (digitos.length >= 10 && digitos.length <= 11) {
    return `55${digitos}`;
  }
  return digitos;
}

/**
 * Especificação PURA do gate: decide por config + telefone, sem IO.
 * `config` null (org sem linha/erro de leitura) BLOQUEIA — default seguro.
 */
export function avaliarGateEnvio(
  config: ConfigGateEnvio | null,
  telefoneE164: string | null,
): GateEnvio {
  if (config !== null && config.whatsappModo === "producao") {
    return { pode: true };
  }
  // Modo teste (ou config ausente = teste com lista vazia): só os listados.
  if (telefoneE164 !== null && config !== null) {
    const alvo = normalizarDigitos(telefoneE164);
    const listado = config.whatsappNumerosTeste.some(
      (n) => normalizarDigitos(n) === alvo,
    );
    if (listado) {
      return { pode: true };
    }
  }
  return { pode: false, motivo: "modo_teste" };
}

/**
 * Gate com IO: carrega org_config pelo client informado e aplica a regra
 * pura. `supabase` é o client do CHAMADOR (sessão ou service role); `orgId`
 * escopa explicitamente porque o service role não tem org_atual(). Falha de
 * leitura ⇒ BLOQUEIA (nunca envia "na dúvida").
 */
export async function podeEnviarPara(
  supabase: SupabaseClient<Database>,
  orgId: string,
  telefoneE164: string | null,
): Promise<GateEnvio> {
  const { data } = await supabase
    .from("org_config")
    .select("whatsapp_modo, whatsapp_numeros_teste")
    .eq("org_id", orgId)
    .maybeSingle();
  return avaliarGateEnvio(
    data
      ? {
          whatsappModo: data.whatsapp_modo,
          whatsappNumerosTeste: data.whatsapp_numeros_teste,
        }
      : null,
    telefoneE164,
  );
}

/** Mensagem pt-BR padrão quando o gate bloqueia (mesma em todas as vias). */
export const ERRO_MODO_TESTE =
  "Modo teste ativo: este número não está na lista de números de teste da " +
  "organização — nada foi enviado. Adicione o número à lista ou mude para " +
  "produção na central de configuração.";
