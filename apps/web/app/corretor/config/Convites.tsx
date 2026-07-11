"use client";

// CONVITES da equipe — emite convite (e-mail + papel corretor/gestor) via RPC
// emitir_convite (0033): o CÓDIGO aparece UMA única vez, com o link de
// cadastro pronto (/cadastro?convite=…) — quem se cadastrar com aquele e-mail
// + código é promovido automaticamente no signup (handle_new_user, 0004).
// Pendentes podem ser revogados; consumidos/expirados ficam no histórico.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MailPlus, TriangleAlert, UserX } from "lucide-react";
import { Botao } from "@/components/ui/Botao";
import { Campo, CampoSelect, GrupoCampo } from "@/components/ui/Campo";
import {
  emitirConviteAction,
  revogarConviteAction,
  type ConviteResumo,
} from "@/lib/dados/config-central";
import { tempoRelativo } from "../leads/tempo";
import { BotaoCopiar } from "./BotaoCopiar";

const ESTILO_STATUS: Record<ConviteResumo["status"], string> = {
  pendente: "bg-gold-soft text-gold-strong ring-gold/40",
  consumido: "bg-brand-soft text-brand-strong ring-brand/15",
  expirado: "bg-badge-neutro-bg text-badge-neutro-fg ring-border-strong/60",
};

export function Convites({ convites }: { convites: ConviteResumo[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState<"corretor" | "gestor">("corretor");
  const [emitido, setEmitido] = useState<{
    email: string;
    papel: string;
    codigo: string;
  } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function emitir() {
    setErro(null);
    iniciar(async () => {
      const r = await emitirConviteAction({ email: email.trim(), papel });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setEmitido({ email: r.email, papel: r.papel, codigo: r.codigo });
      setEmail("");
      router.refresh();
    });
  }

  function revogar(id: string) {
    setErro(null);
    iniciar(async () => {
      const r = await revogarConviteAction(id);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      router.refresh();
    });
  }

  const linkCadastro =
    emitido !== null
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/cadastro?convite=${emitido.codigo}`
      : "";

  return (
    <div className="flex flex-col gap-4">
      {/* Emitir convite */}
      <form
        className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          emitir();
        }}
      >
        <GrupoCampo rotulo="E-mail do convidado" htmlFor="convite-email">
          <Campo
            id="convite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="pessoa@imobiliaria.com.br"
            maxLength={160}
            disabled={pendente}
          />
        </GrupoCampo>
        <GrupoCampo rotulo="Papel" htmlFor="convite-papel">
          <CampoSelect
            id="convite-papel"
            value={papel}
            onChange={(e) => setPapel(e.target.value === "gestor" ? "gestor" : "corretor")}
            disabled={pendente}
          >
            <option value="corretor">Corretor</option>
            <option value="gestor">Gestor</option>
          </CampoSelect>
        </GrupoCampo>
        <Botao type="submit" tamanho="sm" disabled={pendente || email.trim() === ""} className="mb-0.5">
          <MailPlus className="h-4 w-4" aria-hidden />
          {pendente ? "Emitindo…" : "Convidar"}
        </Botao>
      </form>

      {/* Código emitido — única vez que aparece */}
      {emitido !== null && (
        <div className="rounded-xl border border-gold/40 bg-gold-soft p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-gold-strong">
            <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
            Copie agora — o código não será mostrado de novo.
          </p>
          <p className="mt-1 text-xs leading-relaxed text-foreground">
            Envie o link abaixo para <strong>{emitido.email}</strong> e peça
            para se cadastrar com ESTE e-mail — a conta já nasce como{" "}
            <strong>{emitido.papel}</strong> da sua imobiliária. Se perder o
            código, revogue o convite e emita outro.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="min-w-0 break-all rounded-lg border border-border bg-surface px-2.5 py-1.5 font-mono text-xs text-foreground">
              {linkCadastro}
            </code>
            <BotaoCopiar valor={linkCadastro} rotulo="Copiar link" />
          </div>
        </div>
      )}

      {erro !== null && (
        <p role="status" className="text-sm font-medium text-gold-strong">
          {erro}
        </p>
      )}

      {/* Convites existentes */}
      {convites.length > 0 && (
        <ul className="flex flex-col gap-2">
          {convites.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-border bg-surface p-3"
            >
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                {c.email}
              </span>
              <span className="text-xs capitalize text-subtle">{c.papel}</span>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ring-1 ring-inset ${ESTILO_STATUS[c.status]}`}
              >
                {c.status}
              </span>
              <span className="text-xs text-subtle">
                {c.status === "pendente"
                  ? `expira ${tempoRelativo(c.expiraEm)}`
                  : `emitido ${tempoRelativo(c.criadoEm)}`}
              </span>
              {c.status === "pendente" && (
                <button
                  type="button"
                  onClick={() => revogar(c.id)}
                  disabled={pendente}
                  className="inline-flex items-center gap-1 rounded-full border border-border-strong px-2.5 py-1 text-xs font-semibold text-muted transition-colors hover:border-brand/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25 disabled:opacity-50"
                >
                  <UserX className="h-3 w-3" aria-hidden />
                  Revogar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
