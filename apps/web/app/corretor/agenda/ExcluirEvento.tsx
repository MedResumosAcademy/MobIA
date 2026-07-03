"use client";

// Botão (X) para EXCLUIR um evento próprio da agenda. Fina camada client sobre
// a action excluirEvento (acoes.ts) — a camada de dados + RLS garantem que só
// o dono exclui. router.refresh() re-renderiza a agenda. pt-BR.
//
// UX destrutiva: exclusão em DOIS cliques — o primeiro troca o X por
// "Confirmar?" por ~3s (evita toque acidental no mobile); só o segundo clique
// dentro da janela dispara a action. Falha da action mostra mensagem de erro.

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { excluirEvento } from "./acoes";

export function ExcluirEvento({ id, titulo }: { id: string; titulo: string }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Limpa o timeout pendente ao desmontar (evita setState em componente morto).
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  function limparTimeout() {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  function aoClicar() {
    setErro(false);
    if (!confirmando) {
      // 1º clique: arma a confirmação por ~3s.
      setConfirmando(true);
      limparTimeout();
      timeoutRef.current = setTimeout(() => {
        setConfirmando(false);
        timeoutRef.current = null;
      }, 3000);
      return;
    }
    // 2º clique dentro da janela: exclui de verdade.
    limparTimeout();
    setConfirmando(false);
    iniciar(async () => {
      const resultado = await excluirEvento(id);
      if (resultado.ok) {
        router.refresh();
      } else {
        setErro(true);
      }
    });
  }

  return (
    <span className="inline-flex shrink-0 items-center gap-1.5">
      {erro && (
        <span role="alert" className="text-xs text-brand-strong">
          Não foi possível excluir. Tente de novo.
        </span>
      )}
      <button
        type="button"
        onClick={aoClicar}
        disabled={pendente}
        aria-label={
          confirmando
            ? `Confirmar exclusão de "${titulo}" da agenda`
            : `Excluir "${titulo}" da agenda`
        }
        title={confirmando ? "Clique de novo para confirmar" : "Excluir da agenda"}
        className="shrink-0 rounded-full p-1.5 text-subtle transition-colors hover:bg-brand-soft hover:text-brand-strong disabled:cursor-not-allowed disabled:opacity-50"
      >
        {confirmando ? (
          <span className="text-xs font-semibold text-brand-strong">Confirmar?</span>
        ) : (
          <X className="h-4 w-4" aria-hidden />
        )}
      </button>
    </span>
  );
}
