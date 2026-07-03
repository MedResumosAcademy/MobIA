"use client";

// Checkbox/botão para marcar ou desmarcar uma TAREFA como concluída. Fina camada
// client sobre concluirTarefaAction; após a ação, router.refresh() re-renderiza o
// Server Component pai. A autoridade de escopo é a RLS (0012) — aqui só a
// interação. Reusado no detalhe do negócio e na lista "Minhas tarefas".

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { concluirTarefaAction } from "./acoes";

type Props = {
  id: string;
  negocioId: string;
  concluida: boolean;
};

export function BotaoConcluir({ id, negocioId, concluida }: Props) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function alternar() {
    iniciar(async () => {
      const fd = new FormData();
      fd.set("id", id);
      fd.set("negocioId", negocioId);
      fd.set("concluida", String(!concluida));
      const res = await concluirTarefaAction(fd);
      if (!res.ok) {
        // A action retorna { ok:false } em vez de lançar — sem error boundary.
        setErro(res.erro);
        return;
      }
      setErro(null);
      router.refresh();
    });
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={alternar}
        disabled={pendente}
        aria-pressed={concluida}
        aria-label={concluida ? "Reabrir tarefa" : "Concluir tarefa"}
        title={erro ?? undefined}
        className={`inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          concluida
            ? "border-brand bg-brand text-brand-contrast"
            : "border-border-strong bg-surface-card text-transparent hover:border-brand/60"
        }`}
      >
        <Check className="h-4 w-4" aria-hidden strokeWidth={3} />
      </button>
      {erro !== null && (
        <span
          role="alert"
          className="absolute left-0 top-full z-10 mt-1 w-48 rounded-lg border border-border bg-surface-card p-2 text-xs text-brand-strong shadow-[var(--shadow-card)]"
        >
          {erro}
        </span>
      )}
    </span>
  );
}
