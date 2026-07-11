"use client";

// Tokens do ENDPOINT DE CAPTAÇÃO (POST /api/captacao) — lista (prefixo,
// origem, ativo, último uso), criação por origem e revogação. O token em
// claro aparece UMA única vez, logo após criar, com aviso "copie agora" —
// no banco vive só o sha256 (tokens_captacao, 0033).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleOff, KeyRound, Plus, TriangleAlert } from "lucide-react";
import { Botao } from "@/components/ui/Botao";
import { Campo } from "@/components/ui/Campo";
import {
  criarTokenCaptacaoAction,
  revogarTokenCaptacaoAction,
  type TokenCaptacaoResumo,
} from "@/lib/dados/config-central";
import { tempoRelativo } from "../leads/tempo";
import { BotaoCopiar } from "./BotaoCopiar";

export function TokensCaptacao({ tokens }: { tokens: TokenCaptacaoResumo[] }) {
  const router = useRouter();
  const [origem, setOrigem] = useState("");
  const [tokenNovo, setTokenNovo] = useState<{ origem: string; token: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function criar() {
    const alvo = origem.trim();
    if (alvo === "") {
      return;
    }
    setErro(null);
    iniciar(async () => {
      const r = await criarTokenCaptacaoAction(alvo);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setTokenNovo({ origem: alvo, token: r.token });
      setOrigem("");
      router.refresh();
    });
  }

  function revogar(id: string) {
    setErro(null);
    iniciar(async () => {
      const r = await revogarTokenCaptacaoAction(id);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Criar token */}
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          criar();
        }}
      >
        <Campo
          value={origem}
          onChange={(e) => setOrigem(e.target.value)}
          placeholder="Origem do token (ex.: site, landing-verao)"
          aria-label="Origem do novo token de captação"
          maxLength={60}
          disabled={pendente}
          className="max-w-xs"
        />
        <Botao type="submit" variante="secundario" tamanho="sm" disabled={pendente || origem.trim() === ""}>
          <Plus className="h-4 w-4" aria-hidden />
          Criar token
        </Botao>
      </form>

      {/* Token recém-criado — única vez que o claro aparece */}
      {tokenNovo !== null && (
        <div className="rounded-xl border border-gold/40 bg-gold-soft p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-gold-strong">
            <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
            Copie agora — este token não será mostrado de novo.
          </p>
          <p className="mt-1 text-xs text-foreground">
            Token da origem <strong>{tokenNovo.origem}</strong>. Use-o no header{" "}
            <code className="rounded bg-surface px-1 py-0.5">Authorization: Bearer …</code>{" "}
            do formulário externo.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="min-w-0 break-all rounded-lg border border-border bg-surface px-2.5 py-1.5 font-mono text-xs text-foreground">
              {tokenNovo.token}
            </code>
            <BotaoCopiar valor={tokenNovo.token} rotulo="Copiar token" />
          </div>
        </div>
      )}

      {erro !== null && (
        <p role="status" className="text-sm font-medium text-gold-strong">
          {erro}
        </p>
      )}

      {/* Lista */}
      {tokens.length === 0 ? (
        <p className="flex items-center gap-2 rounded-xl border border-dashed border-border-strong bg-surface p-4 text-sm text-subtle">
          <KeyRound className="h-4 w-4 shrink-0" aria-hidden />
          Nenhum token ainda — crie um por origem (site, landing…) para o
          formulário externo postar leads direto no CRM.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tokens.map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-border bg-surface p-3"
            >
              <code className="rounded-md bg-surface-card px-2 py-1 font-mono text-xs text-foreground ring-1 ring-inset ring-border-strong/60">
                {t.prefixo}…
              </code>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                {t.origem}
              </span>
              <span className="text-xs text-subtle">
                {t.ultimoUsoEm ? `último uso ${tempoRelativo(t.ultimoUsoEm)}` : "nunca usado"}
              </span>
              {t.ativo ? (
                <button
                  type="button"
                  onClick={() => revogar(t.id)}
                  disabled={pendente}
                  className="inline-flex items-center gap-1 rounded-full border border-border-strong px-2.5 py-1 text-xs font-semibold text-muted transition-colors hover:border-brand/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25 disabled:opacity-50"
                >
                  <CircleOff className="h-3 w-3" aria-hidden />
                  Revogar
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-badge-neutro-bg px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-badge-neutro-fg ring-1 ring-inset ring-border-strong/60">
                  Revogado
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
