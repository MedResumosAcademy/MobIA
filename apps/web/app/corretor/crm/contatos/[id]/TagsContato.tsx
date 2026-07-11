"use client";

// TAGS editáveis da ficha do contato: chips com remoção + input de adição.
// Client fino sobre adicionarTagAction/removerTagAction (dedup e limite de 20
// vivem na action); atualiza via router.refresh().

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { adicionarTagAction, removerTagAction } from "@/lib/dados/contatos";

export function TagsContato({ contatoId, tags }: { contatoId: string; tags: string[] }) {
  const router = useRouter();
  const [nova, setNova] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function adicionar() {
    const tag = nova.trim();
    if (tag === "") {
      return;
    }
    setErro(null);
    iniciar(async () => {
      const r = await adicionarTagAction(contatoId, tag);
      if (r.ok) {
        setNova("");
        router.refresh();
      } else {
        setErro(r.erro);
      }
    });
  }

  function remover(tag: string) {
    setErro(null);
    iniciar(async () => {
      const r = await removerTagAction(contatoId, tag);
      if (r.ok) {
        router.refresh();
      } else {
        setErro(r.erro);
      }
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-full bg-badge-neutro-bg py-0.5 pl-2.5 pr-1 text-xs font-medium text-badge-neutro-fg ring-1 ring-inset ring-border-strong/60"
          >
            {t}
            <button
              type="button"
              onClick={() => remover(t)}
              disabled={pendente}
              aria-label={`Remover tag ${t}`}
              className="rounded-full p-0.5 text-subtle transition-colors hover:bg-surface hover:text-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25 disabled:opacity-50"
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          </span>
        ))}
        <form
          className="inline-flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            adicionar();
          }}
        >
          <input
            value={nova}
            onChange={(e) => setNova(e.target.value)}
            placeholder="nova tag"
            aria-label="Nova tag"
            maxLength={40}
            className="w-24 rounded-full border border-border-strong bg-surface-card px-2.5 py-0.5 text-xs text-foreground placeholder:text-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
          />
          <button
            type="submit"
            disabled={pendente || nova.trim() === ""}
            aria-label="Adicionar tag"
            className="rounded-full border border-border-strong bg-surface-card p-1 text-subtle transition-colors hover:border-brand/50 hover:text-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
          </button>
        </form>
      </div>
      {erro && (
        <p className="mt-1.5 text-xs font-medium text-brand-strong" role="status">
          {erro}
        </p>
      )}
    </div>
  );
}
