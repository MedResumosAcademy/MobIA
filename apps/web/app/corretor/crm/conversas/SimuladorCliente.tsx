"use client";

// MODO SIMULAÇÃO — o input "responder como CLIENTE": a mensagem entra pelo
// MESMO pipeline do webhook (simularMensagemAction) e a IA responde de
// verdade. Enquanto processa, pontinhos de "digitando"; depois, refresh para a
// thread server-side mostrar a resposta (ou a escalada). "Reiniciar teste"
// devolve o contato de teste à IA para demonstrar a escalada de novo.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, UserRound } from "lucide-react";
import { Botao } from "@/components/ui/Botao";
import { Campo } from "@/components/ui/Campo";
import {
  reiniciarSimulacaoAction,
  simularMensagemAction,
} from "@/lib/dados/simulador";

const ROTULO_ACAO: Record<string, string> = {
  ia_respondeu: "A IA respondeu como faria com um cliente real.",
  escalada: "A IA escalou — a conversa foi para a fila humana (Precisam).",
  fila_humana: "A conversa está na fila humana — a IA não responde neste estado.",
};

export function SimuladorCliente({ contatoId }: { contatoId: string }) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();
  const [reiniciando, iniciarReinicio] = useTransition();

  function enviarComoCliente() {
    setAviso(null);
    iniciar(async () => {
      const r = await simularMensagemAction(contatoId, texto);
      if (!r.ok) {
        setAviso({ tipo: "erro", texto: r.erro });
        return;
      }
      setTexto("");
      setAviso({ tipo: "ok", texto: ROTULO_ACAO[r.acao] ?? "Mensagem processada." });
      router.refresh();
    });
  }

  function reiniciar() {
    setAviso(null);
    iniciarReinicio(async () => {
      const r = await reiniciarSimulacaoAction(contatoId);
      if (!r.ok) {
        setAviso({ tipo: "erro", texto: r.erro });
        return;
      }
      setAviso({ tipo: "ok", texto: "Simulação reiniciada — a IA voltou a atender." });
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-gold/40 bg-gold-soft/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-gold-strong">
          <UserRound className="h-3.5 w-3.5" aria-hidden />
          Responder como cliente
        </p>
        <button
          type="button"
          onClick={reiniciar}
          disabled={reiniciando || pendente}
          className="inline-flex items-center gap-1 text-xs font-medium text-muted transition-colors hover:text-foreground disabled:opacity-50"
        >
          <RotateCcw className="h-3 w-3" aria-hidden />
          {reiniciando ? "Reiniciando…" : "Reiniciar teste"}
        </button>
      </div>
      <form
        className="mt-2 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          enviarComoCliente();
        }}
      >
        <Campo
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Digite como se fosse o cliente…"
          aria-label="Mensagem simulada do cliente"
          maxLength={4096}
          disabled={pendente}
          className="flex-1"
        />
        <Botao
          type="submit"
          variante="premium"
          tamanho="sm"
          disabled={pendente || texto.trim() === ""}
        >
          {pendente ? "Enviando…" : "Enviar como cliente"}
        </Botao>
      </form>
      {pendente && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted" role="status">
          <span className="inline-flex gap-0.5" aria-hidden>
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gold-strong [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gold-strong [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gold-strong [animation-delay:300ms]" />
          </span>
          A IA está lendo e respondendo…
        </p>
      )}
      {!pendente && aviso !== null && (
        <p
          className={`mt-2 text-xs font-medium ${aviso.tipo === "ok" ? "text-brand-strong" : "text-gold-strong"}`}
          role="status"
        >
          {aviso.texto}
        </p>
      )}
    </div>
  );
}
