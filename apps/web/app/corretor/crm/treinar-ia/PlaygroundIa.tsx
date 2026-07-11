"use client";

// PLAYGROUND do "Treinar IA": pergunta de teste → testeDePersonaAction →
// resposta na hora (ou o aviso de que aquela mensagem ESCALARIA, com o
// motivo). Usa a config SALVA da org, com contato fictício — nada é gravado e
// nenhum cliente recebe nada.

import { useState, useTransition } from "react";
import { Bot, Send, TriangleAlert } from "lucide-react";
import { Botao } from "@/components/ui/Botao";
import { Campo } from "@/components/ui/Campo";
import { testeDePersonaAction } from "@/lib/dados/atendimento-config";

type Resultado =
  | { tipo: "resposta" | "escalar"; texto: string }
  | { tipo: "erro"; texto: string };

export function PlaygroundIa({ nomeAssistente }: { nomeAssistente: string }) {
  const [pergunta, setPergunta] = useState("");
  const [ultimaPergunta, setUltimaPergunta] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [pendente, iniciar] = useTransition();

  function testar() {
    const texto = pergunta.trim();
    if (texto === "") {
      return;
    }
    setResultado(null);
    setUltimaPergunta(texto);
    iniciar(async () => {
      const r = await testeDePersonaAction(texto);
      if (!r.ok) {
        setResultado({ tipo: "erro", texto: r.erro });
        return;
      }
      setResultado({ tipo: r.tipo, texto: r.texto });
      setPergunta("");
    });
  }

  return (
    <section
      aria-label="Playground de teste da IA"
      className="flex flex-col gap-3 rounded-2xl border border-brand/30 bg-surface-card p-5 shadow-[var(--shadow-card)]"
    >
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Bot className="h-5 w-5 text-brand-strong" aria-hidden />
          Testar a {nomeAssistente}
        </h2>
        <p className="mt-1 text-sm text-muted">
          Pergunte como se fosse um cliente. O teste usa a última configuração
          SALVA — salve antes de testar mudanças.
        </p>
      </div>

      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          testar();
        }}
      >
        <Campo
          value={pergunta}
          onChange={(e) => setPergunta(e.target.value)}
          placeholder="Ex.: vocês trabalham com financiamento?"
          aria-label="Pergunta de teste para a IA"
          maxLength={1000}
          disabled={pendente}
          className="flex-1"
        />
        <Botao type="submit" tamanho="sm" disabled={pendente || pergunta.trim() === ""}>
          <Send className="h-4 w-4" aria-hidden />
          {pendente ? "Testando…" : "Testar"}
        </Botao>
      </form>

      {pendente && (
        <p className="flex items-center gap-1.5 text-xs text-muted" role="status">
          <span className="inline-flex gap-0.5" aria-hidden>
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand [animation-delay:300ms]" />
          </span>
          A IA está pensando…
        </p>
      )}

      {!pendente && resultado !== null && (
        <div className="flex flex-col gap-2" role="status">
          {ultimaPergunta !== null && (
            <div className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-tr-sm bg-surface px-3.5 py-2 text-sm text-foreground ring-1 ring-inset ring-border-strong/60">
                {ultimaPergunta}
              </p>
            </div>
          )}
          {resultado.tipo === "resposta" ? (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-brand-soft px-3.5 py-2 shadow-[var(--shadow-soft)]">
                <p className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold text-brand-strong">
                  <Bot className="h-3 w-3" aria-hidden />
                  {nomeAssistente}
                </p>
                <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                  {resultado.texto}
                </p>
              </div>
            </div>
          ) : (
            <p
              className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${
                resultado.tipo === "escalar"
                  ? "border-gold/40 bg-gold-soft text-foreground"
                  : "border-border bg-surface text-muted"
              }`}
            >
              <TriangleAlert
                className="mt-0.5 h-4 w-4 shrink-0 text-gold-strong"
                aria-hidden
              />
              {resultado.texto}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
