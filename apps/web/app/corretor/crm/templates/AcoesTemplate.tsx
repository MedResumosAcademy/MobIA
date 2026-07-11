"use client";

// Ações do card de template (client FOLHA): registrar o ciclo NA META
// (submetido → aprovado/rejeitado — o veredito acontece LÁ, aqui só o
// espelho) e excluir o registro local com confirmação em dois cliques
// (padrão ArquivarFunil).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { STATUS_META_TEMPLATE, type StatusMetaTemplate } from "@imobia/domain";
import {
  atualizarStatusTemplateAction,
  excluirTemplateAction,
} from "@/lib/dados/templates";
import { ROTULO_STATUS_TEMPLATE } from "../rotulos";

const CLASSE_SELECT =
  "rounded-full border border-border-strong bg-surface-card px-3 py-1 text-xs font-medium text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25 disabled:opacity-50";

export function AcoesTemplate({
  templateId,
  status,
}: {
  templateId: string;
  status: string;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  function mudarStatus(novo: string) {
    if (novo === status || !(STATUS_META_TEMPLATE as readonly string[]).includes(novo)) {
      return;
    }
    setErro(null);
    iniciar(async () => {
      const r = await atualizarStatusTemplateAction(templateId, novo as StatusMetaTemplate);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      router.refresh();
    });
  }

  function excluir() {
    if (!confirmando) {
      setConfirmando(true);
      return;
    }
    setErro(null);
    iniciar(async () => {
      const r = await excluirTemplateAction(templateId);
      setConfirmando(false);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`status-${templateId}`}>
        Registrar status na Meta
      </label>
      <select
        id={`status-${templateId}`}
        value={status}
        onChange={(e) => mudarStatus(e.target.value)}
        disabled={pendente}
        className={CLASSE_SELECT}
      >
        {STATUS_META_TEMPLATE.map((s) => (
          <option key={s} value={s}>
            {ROTULO_STATUS_TEMPLATE[s]}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={excluir}
        disabled={pendente}
        className="rounded-full border border-border-strong bg-surface-card px-3 py-1 text-xs font-medium text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25 disabled:opacity-50"
      >
        {pendente ? "…" : confirmando ? "Confirmar excluir?" : "Excluir"}
      </button>
      {erro !== null && (
        <span role="alert" className="text-xs font-medium text-gold-strong">
          {erro}
        </span>
      )}
    </div>
  );
}
