"use client";

// "+ Simular" (gestor/admin): garante o contato de teste da org e navega para
// a thread dele — lá o gestor conversa com a própria IA como se fosse um
// cliente. Nada é enviado ao WhatsApp em nenhuma hipótese.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { iniciarSimulacaoAction } from "@/lib/dados/simulador";

export function BotaoSimular() {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function simular() {
    setErro(null);
    iniciar(async () => {
      const r = await iniciarSimulacaoAction();
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      router.push(`/corretor/crm/conversas?contato=${r.contatoId}`);
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={simular}
        disabled={pendente}
        className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold-soft px-3.5 py-1.5 text-xs font-semibold text-gold-strong transition-colors hover:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25 disabled:opacity-50"
      >
        <FlaskConical className="h-3.5 w-3.5" aria-hidden />
        {pendente ? "Abrindo…" : "+ Simular"}
      </button>
      {erro !== null && (
        <span role="alert" className="text-xs font-medium text-gold-strong">
          {erro}
        </span>
      )}
    </span>
  );
}
