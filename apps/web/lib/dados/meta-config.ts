// STATUS DA CONEXÃO META (WhatsApp Cloud API) — helper server-only para a UI
// mostrar honestamente o que está ligado e o que falta configurar.
//
// SEGURANÇA: devolve SÓ OS NOMES das envs faltantes, nunca valores — pode ser
// exibido para gestor/admin sem risco. Não faz IO: é leitura pura de env.

/** Envs necessárias para ENVIAR mensagens (texto/template). */
const ENVS_ENVIO = ["META_WHATSAPP_TOKEN", "META_WHATSAPP_PHONE_NUMBER_ID"] as const;

/** Envs necessárias para RECEBER eventos no webhook (mensagens + status). */
const ENVS_WEBHOOK = [
  "META_WEBHOOK_VERIFY_TOKEN",
  "META_APP_SECRET",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

export type StatusConexaoMeta = {
  /** true = dá para ENVIAR pelo número conectado (token + phone number id). */
  conectado: boolean;
  /** true = o webhook consegue verificar, validar assinatura e gravar. */
  webhookPronto: boolean;
  /** Nomes das envs ausentes (nunca valores) — vazio quando tudo configurado. */
  faltando: string[];
};

/** Fotografia da integração Meta neste ambiente (sem env ⇒ degrada, não quebra). */
export function statusConexaoMeta(): StatusConexaoMeta {
  const faltamEnvio = ENVS_ENVIO.filter((nome) => !process.env[nome]);
  const faltamWebhook = ENVS_WEBHOOK.filter((nome) => !process.env[nome]);
  return {
    conectado: faltamEnvio.length === 0,
    webhookPronto: faltamWebhook.length === 0,
    faltando: [...faltamEnvio, ...faltamWebhook],
  };
}
