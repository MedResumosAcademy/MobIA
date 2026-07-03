"use client";

// Botão (X) para EXCLUIR um evento próprio da agenda. Fina camada client sobre
// a action excluirEvento (acoes.ts) — a camada de dados + RLS garantem que só
// o dono exclui. router.refresh() re-renderiza a agenda. pt-BR.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { excluirEvento } from "./acoes";

export function ExcluirEvento({ id, titulo }: { id: string; titulo: string }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();

  function excluir() {
    iniciar(async () => {
      const resultado = await excluirEvento(id);
      if (resultado.ok) {
        router.refresh();
      }
    });
  }

  return (
    <button
      type="button"
      onClick={excluir}
      disabled={pendente}
      aria-label={`Excluir "${titulo}" da agenda`}
      title="Excluir da agenda"
      className="shrink-0 rounded-full p-1.5 text-subtle transition-colors hover:bg-brand-soft hover:text-brand-strong disabled:cursor-not-allowed disabled:opacity-50"
    >
      <X className="h-4 w-4" aria-hidden />
    </button>
  );
}
