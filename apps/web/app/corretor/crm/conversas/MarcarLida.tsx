"use client";

// Marca a conversa aberta como LIDA (zera nao_lidas via RPC 0030) — abriu, viu.
// Client invisível: dispara UMA vez por contato (ref-guard, sobrevive ao
// StrictMode) e faz refresh para o badge e a fila "Precisam" refletirem.
// Nenhum setState em efeito (regra do lint) — só a action assíncrona.

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { marcarLidaAction } from "@/lib/dados/conversas";

export function MarcarLida({
  contatoId,
  naoLidas,
}: {
  contatoId: string;
  naoLidas: number;
}) {
  const router = useRouter();
  const marcada = useRef<string | null>(null);

  useEffect(() => {
    if (naoLidas === 0 || marcada.current === contatoId) {
      return;
    }
    marcada.current = contatoId;
    void marcarLidaAction(contatoId).then((r) => {
      if (r.ok) {
        router.refresh();
      }
    });
  }, [contatoId, naoLidas, router]);

  return null;
}
