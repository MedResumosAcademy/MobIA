"use client";

// Ações da conversa aberta (client FOLHA): Assumir / Devolver para IA /
// Resolvido — as actions de fila da RPC 0030 (contrato { ok }, nunca lançam).
// router.refresh() re-renderiza a thread e os contadores no servidor.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bot, CheckCheck, UserRoundCheck } from "lucide-react";
import {
  atribuirConversaAction,
  devolverParaIaAction,
  marcarResolvidoAction,
  type ResultadoFila,
} from "@/lib/dados/conversas";

const CLASSE_ACAO =
  "inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-surface-card px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-brand/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25 disabled:cursor-not-allowed disabled:opacity-50";

export function AcoesConversa({
  contatoId,
  atendimento,
  atribuidaAMim,
  iaAtiva,
}: {
  contatoId: string;
  /** Estado atual ('ia' | 'humano' | 'resolvido') — decide o que faz sentido. */
  atendimento: string;
  atribuidaAMim: boolean;
  /** IA ligada na org? Devolver para uma IA desligada nem aparece habilitado. */
  iaAtiva: boolean;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function executar(acao: () => Promise<ResultadoFila>) {
    setErro(null);
    iniciar(async () => {
      const r = await acao();
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!(atendimento === "humano" && atribuidaAMim) && (
        <button
          type="button"
          className={CLASSE_ACAO}
          disabled={pendente}
          onClick={() => executar(() => atribuirConversaAction(contatoId))}
        >
          <UserRoundCheck className="h-3.5 w-3.5" aria-hidden />
          Assumir conversa
        </button>
      )}
      {atendimento !== "ia" && (
        <button
          type="button"
          className={CLASSE_ACAO}
          disabled={pendente || !iaAtiva}
          title={iaAtiva ? undefined : "A IA está desligada — ative em Treinar IA."}
          onClick={() => executar(() => devolverParaIaAction(contatoId))}
        >
          <Bot className="h-3.5 w-3.5" aria-hidden />
          Devolver para IA
        </button>
      )}
      {atendimento !== "resolvido" && (
        <button
          type="button"
          className={CLASSE_ACAO}
          disabled={pendente}
          onClick={() => executar(() => marcarResolvidoAction(contatoId))}
        >
          <CheckCheck className="h-3.5 w-3.5" aria-hidden />
          Resolvido
        </button>
      )}
      {erro !== null && (
        <span role="alert" className="text-xs font-medium text-gold-strong">
          {erro}
        </span>
      )}
    </div>
  );
}
