"use client";

// Botão "Compartilhar" — usa a Web Share API quando disponível (mobile) e cai
// para copiar o link do perfil para a área de transferência (desktop). Feedback
// efêmero de "Link copiado!". Componente client leve, sem estado no server.

import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { Botao } from "@/components/ui/Botao";

type Props = {
  /** Caminho relativo do perfil, ex.: "/corretor/perfil/<id>". */
  caminho: string;
  nome: string;
};

export function BotaoCompartilhar({ caminho, nome }: Props) {
  const [copiado, setCopiado] = useState(false);

  async function compartilhar() {
    const url =
      typeof window !== "undefined" ? new URL(caminho, window.location.origin).href : caminho;
    const dados = { title: `Perfil de ${nome} — ImobIA`, url };

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(dados);
        return;
      } catch {
        // usuário cancelou ou não suportado — cai para copiar
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // silencioso: sem clipboard disponível
    }
  }

  return (
    <Botao
      variante="secundario"
      tamanho="sm"
      onClick={compartilhar}
      className="gap-1.5"
    >
      {copiado ? (
        <>
          <Check className="h-4 w-4" aria-hidden />
          Link copiado!
        </>
      ) : (
        <>
          <Share2 className="h-4 w-4" aria-hidden />
          Compartilhar
        </>
      )}
    </Botao>
  );
}
