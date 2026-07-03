"use client";

// Ações da edição da newsletter (client) — marcar pronta, copiar HTML e enviar.
// O HTML completo chega pronto do Server Component (gerarHtmlEdicao); aqui só
// orquestramos as Server Actions e o clipboard. Envio PLUGGÁVEL: sem
// RESEND_API_KEY o botão fica desabilitado com a dica de copiar o HTML.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ClipboardCopy, Send } from "lucide-react";
import type { StatusEdicaoNewsletter } from "@imobia/domain";
import { Botao } from "@/components/ui/Botao";
import { enviarEdicaoAction, marcarProntaAction } from "@/lib/dados/newsletter";

export function AcoesEdicao({
  id,
  status,
  html,
  envioConfigurado,
}: {
  id: string;
  status: StatusEdicaoNewsletter;
  html: string;
  envioConfigurado: boolean;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [copiado, setCopiado] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function copiarHtml() {
    try {
      await navigator.clipboard.writeText(html);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setErro("Não foi possível copiar — selecione o HTML manualmente.");
    }
  }

  function marcarPronta() {
    setErro(null);
    setMensagem(null);
    iniciar(async () => {
      const resultado = await marcarProntaAction(id);
      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }
      setMensagem("Edição marcada como pronta.");
      router.refresh();
    });
  }

  function enviar() {
    setErro(null);
    setMensagem(null);
    iniciar(async () => {
      const resultado = await enviarEdicaoAction(id);
      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }
      setMensagem(`Edição enviada para ${resultado.enviados} inscrito(s). 📬`);
      router.refresh();
    });
  }

  const enviada = status === "enviada";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {status === "rascunho" && (
          <Botao
            type="button"
            variante="secundario"
            disabled={pendente}
            onClick={marcarPronta}
          >
            <Check size={16} aria-hidden strokeWidth={2} />
            Marcar como pronta
          </Botao>
        )}

        <Botao
          type="button"
          variante="secundario"
          disabled={pendente}
          onClick={copiarHtml}
        >
          <ClipboardCopy size={16} aria-hidden strokeWidth={2} />
          {copiado ? "HTML copiado!" : "Copiar HTML"}
        </Botao>

        <Botao
          type="button"
          variante="primario"
          disabled={pendente || enviada || !envioConfigurado}
          onClick={enviar}
          title={
            !envioConfigurado
              ? "Envio automático não configurado — copie o HTML e envie pela sua ferramenta."
              : undefined
          }
        >
          <Send size={16} aria-hidden strokeWidth={2} />
          {pendente ? "Enviando…" : enviada ? "Já enviada" : "Enviar aos inscritos"}
        </Botao>
      </div>

      {!envioConfigurado && !enviada && (
        <p className="text-xs text-subtle">
          Envio automático não configurado — use “Copiar HTML” e dispare pela sua
          ferramenta de e-mail preferida.
        </p>
      )}
      {mensagem && (
        <p className="text-sm font-medium text-brand-strong" role="status">
          {mensagem}
        </p>
      )}
      {erro && (
        <p className="text-sm text-brand-strong" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}
