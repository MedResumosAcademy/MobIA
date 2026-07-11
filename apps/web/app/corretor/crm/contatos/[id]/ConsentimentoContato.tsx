"use client";

// CONSENTIMENTO de marketing (LGPD) na ficha do contato. Mostra o estado
// honesto (✓ autorizado desde/fonte · — sem consentimento) e as duas ações
// dedicadas: registrar opt-in (fonte obrigatória) e revogar (em dois cliques,
// para não revogar sem querer). Client fino sobre as actions de contatos.ts.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { Botao } from "@/components/ui/Botao";
import { Campo } from "@/components/ui/Campo";
import {
  registrarConsentimentoAction,
  revogarConsentimentoAction,
} from "@/lib/dados/contatos";

const FMT_DATA = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeZone: "America/Sao_Paulo",
});

export function ConsentimentoContato({
  contatoId,
  consentimentoEm,
  fonte,
}: {
  contatoId: string;
  consentimentoEm: string | null;
  fonte: string | null;
}) {
  const router = useRouter();
  const [novaFonte, setNovaFonte] = useState("");
  const [confirmandoRevogacao, setConfirmandoRevogacao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function registrar() {
    setErro(null);
    iniciar(async () => {
      const r = await registrarConsentimentoAction(contatoId, novaFonte);
      if (r.ok) {
        setNovaFonte("");
        router.refresh();
      } else {
        setErro(r.erro);
      }
    });
  }

  function revogar() {
    setErro(null);
    iniciar(async () => {
      const r = await revogarConsentimentoAction(contatoId);
      if (r.ok) {
        setConfirmandoRevogacao(false);
        router.refresh();
      } else {
        setErro(r.erro);
      }
    });
  }

  if (consentimentoEm !== null) {
    return (
      <div className="rounded-xl border border-brand/30 bg-brand-soft p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-brand-strong">
          <ShieldCheck className="h-4 w-4" aria-hidden />
          Marketing autorizado
        </p>
        <p className="mt-1 text-xs text-brand-strong/80">
          Desde {FMT_DATA.format(new Date(consentimentoEm))}
          {fonte ? ` · fonte: ${fonte}` : ""}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {confirmandoRevogacao ? (
            <>
              <Botao tamanho="sm" onClick={revogar} disabled={pendente}>
                {pendente ? "Revogando…" : "Confirmar revogação"}
              </Botao>
              <Botao
                variante="fantasma"
                tamanho="sm"
                onClick={() => setConfirmandoRevogacao(false)}
                disabled={pendente}
              >
                Cancelar
              </Botao>
            </>
          ) : (
            <Botao
              variante="secundario"
              tamanho="sm"
              onClick={() => setConfirmandoRevogacao(true)}
            >
              <ShieldOff className="h-3.5 w-3.5" aria-hidden />
              Revogar consentimento
            </Botao>
          )}
        </div>
        {confirmandoRevogacao && (
          <p className="mt-2 text-xs text-brand-strong/80" role="status">
            Vale na hora: o contato sai de qualquer campanha futura.
          </p>
        )}
        {erro && (
          <p className="mt-2 text-xs font-medium text-brand-strong" role="status">
            {erro}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <ShieldOff className="h-4 w-4 text-subtle" aria-hidden />
        Sem consentimento de marketing
      </p>
      <p className="mt-1 text-xs text-subtle">
        Sem opt-in registrado, o contato nunca entra em campanhas — só em
        conversas 1:1 de atendimento (LGPD).
      </p>
      <form
        className="mt-3 flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          registrar();
        }}
      >
        <Campo
          value={novaFonte}
          onChange={(e) => setNovaFonte(e.target.value)}
          placeholder="Fonte do opt-in — ex.: formulário do site"
          aria-label="Fonte do consentimento"
          maxLength={200}
          className="py-2 text-xs"
        />
        <Botao
          type="submit"
          variante="secundario"
          tamanho="sm"
          disabled={pendente || novaFonte.trim() === ""}
          className="self-start"
        >
          {pendente ? "Registrando…" : "Registrar opt-in"}
        </Botao>
      </form>
      {erro && (
        <p className="mt-2 text-xs font-medium text-brand-strong" role="status">
          {erro}
        </p>
      )}
    </div>
  );
}
