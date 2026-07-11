// TICKS de status de mensagem do WhatsApp (✓ enviada · ✓✓ entregue · ✓✓ lida)
// — componente PURO server-safe, compartilhado pela timeline da ficha do
// contato e pelo inbox de conversas. Só faz sentido para mensagens de SAÍDA;
// para entrada/desconhecido não renderiza nada.

import { AlertTriangle, Check, CheckCheck, Clock } from "lucide-react";
import { statusMensagemSchema } from "@imobia/domain";
import { ROTULO_STATUS_MENSAGEM } from "./rotulos";

export function TicksMensagem({ status }: { status: string }) {
  const parsed = statusMensagemSchema.safeParse(status);
  if (!parsed.success || parsed.data === "recebida") {
    return null;
  }
  const s = parsed.data;
  const rotulo = ROTULO_STATUS_MENSAGEM[s];
  const icone =
    s === "pendente" ? (
      <Clock className="h-3.5 w-3.5" aria-hidden />
    ) : s === "enviada" ? (
      <Check className="h-3.5 w-3.5" aria-hidden />
    ) : s === "falhou" ? (
      <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
    ) : (
      // entregue e lida: dois ticks; a lida ganha a cor da marca (abaixo).
      <CheckCheck className="h-3.5 w-3.5" aria-hidden />
    );
  const cor =
    s === "falhou"
      ? "text-gold-strong"
      : s === "lida"
        ? "text-brand-strong"
        : "text-subtle";
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-medium ${cor}`}
      aria-label={`Status da mensagem: ${rotulo}`}
    >
      {icone}
      {rotulo}
    </span>
  );
}
