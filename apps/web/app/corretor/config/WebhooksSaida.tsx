"use client";

// 🔔 WEBHOOKS DE SAÍDA — avisa Zapier/Make/RD quando algo acontece no CRM.
// Lista (url truncada, eventos, última entrega, ativo/desativado), cadastro
// (URL https + eventos em checkboxes → SEGREDO mostrado uma única vez com a
// doc do header x-imobia-signature), entrega de teste (ping) e remoção.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CircleCheck,
  CircleX,
  Plus,
  RefreshCcw,
  Send,
  Trash2,
  TriangleAlert,
  Webhook,
} from "lucide-react";
import { EVENTOS_WEBHOOK, type EventoWebhook } from "@imobia/domain";
import { Botao } from "@/components/ui/Botao";
import { Campo, GrupoCampo } from "@/components/ui/Campo";
import {
  criarWebhookSaidaAction,
  reativarWebhookSaidaAction,
  removerWebhookSaidaAction,
  testarWebhookSaidaAction,
  type WebhookSaidaResumo,
} from "@/lib/dados/config-central";
import { tempoRelativo } from "../leads/tempo";
import { BotaoCopiar } from "./BotaoCopiar";

const ROTULO_EVENTO: Record<EventoWebhook, string> = {
  "contato.criado": "Contato criado",
  "contato.mudou_etapa": "Contato mudou de etapa",
  "negocio.ganho": "Negócio ganho",
};

export function WebhooksSaida({ webhooks }: { webhooks: WebhookSaidaResumo[] }) {
  const router = useRouter();
  const [formAberto, setFormAberto] = useState(false);
  const [url, setUrl] = useState("");
  const [eventos, setEventos] = useState<EventoWebhook[]>([...EVENTOS_WEBHOOK]);
  const [segredoNovo, setSegredoNovo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [statusTeste, setStatusTeste] = useState<{ id: string; status: number | null } | null>(
    null,
  );
  const [pendente, iniciar] = useTransition();

  function alternarEvento(e: EventoWebhook) {
    setEventos((atual) =>
      atual.includes(e) ? atual.filter((x) => x !== e) : [...atual, e],
    );
  }

  function criar() {
    setAviso(null);
    iniciar(async () => {
      const r = await criarWebhookSaidaAction({ url: url.trim(), eventos });
      if (!r.ok) {
        setAviso(r.erro);
        return;
      }
      setSegredoNovo(r.segredo);
      setUrl("");
      setEventos([...EVENTOS_WEBHOOK]);
      setFormAberto(false);
      router.refresh();
    });
  }

  function testar(id: string) {
    setAviso(null);
    setStatusTeste(null);
    iniciar(async () => {
      const r = await testarWebhookSaidaAction(id);
      if (!r.ok) {
        setAviso(r.erro);
        return;
      }
      setStatusTeste({ id, status: r.status });
      router.refresh();
    });
  }

  function remover(id: string) {
    setAviso(null);
    iniciar(async () => {
      const r = await removerWebhookSaidaAction(id);
      if (!r.ok) {
        setAviso(r.erro);
        return;
      }
      router.refresh();
    });
  }

  function reativar(id: string) {
    setAviso(null);
    iniciar(async () => {
      const r = await reativarWebhookSaidaAction(id);
      if (!r.ok) {
        setAviso(r.erro);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Segredo recém-criado — única vez que aparece */}
      {segredoNovo !== null && (
        <div className="rounded-xl border border-gold/40 bg-gold-soft p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-gold-strong">
            <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
            Copie o segredo agora — ele não será mostrado de novo.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="min-w-0 break-all rounded-lg border border-border bg-surface px-2.5 py-1.5 font-mono text-xs text-foreground">
              {segredoNovo}
            </code>
            <BotaoCopiar valor={segredoNovo} rotulo="Copiar segredo" />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-foreground">
            Cada entrega é um <strong>POST JSON</strong>{" "}
            <code className="rounded bg-surface px-1 py-0.5">
              {"{ evento, dados, emitidoEm }"}
            </code>{" "}
            com o header{" "}
            <code className="rounded bg-surface px-1 py-0.5">x-imobia-signature</code> ={" "}
            HMAC-SHA256 (hex) do corpo bruto, assinado com este segredo — valide
            no destino recalculando sobre o corpo exato.
          </p>
        </div>
      )}

      {aviso !== null && (
        <p role="status" className="text-sm font-medium text-gold-strong">
          {aviso}
        </p>
      )}

      {/* Lista */}
      {webhooks.length === 0 ? (
        <p className="flex items-center gap-2 rounded-xl border border-dashed border-border-strong bg-surface p-4 text-sm text-subtle">
          <Webhook className="h-4 w-4 shrink-0" aria-hidden />
          Nenhum webhook ainda — cadastre um destino https:// para avisar
          Zapier, Make ou RD quando um lead entrar ou mudar de etapa.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {webhooks.map((w) => (
            <li key={w.id} className="rounded-xl border border-border bg-surface p-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <code
                  className="min-w-0 max-w-full flex-1 truncate font-mono text-xs text-foreground"
                  title={w.url}
                >
                  {w.url}
                </code>
                {w.ativo ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-strong ring-1 ring-inset ring-brand/15">
                    <CircleCheck className="h-3 w-3" aria-hidden />
                    Ativo
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gold-soft px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-gold-strong ring-1 ring-inset ring-gold/40">
                    <CircleX className="h-3 w-3" aria-hidden />
                    Desativado{w.falhasSeguidas >= 5 ? " (5 falhas seguidas)" : ""}
                  </span>
                )}
              </div>
              <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {w.eventos.map((e) => (
                  <span
                    key={e}
                    className="rounded-full bg-badge-neutro-bg px-2 py-0.5 text-[11px] font-medium text-badge-neutro-fg ring-1 ring-inset ring-border-strong/60"
                  >
                    {ROTULO_EVENTO[e]}
                  </span>
                ))}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-subtle">
                <span>
                  {w.ultimaEntregaEm
                    ? `última entrega ${tempoRelativo(w.ultimaEntregaEm)} · ${
                        w.ultimaEntregaStatus === null
                          ? "sem resposta"
                          : `HTTP ${w.ultimaEntregaStatus}`
                      }`
                    : "nenhuma entrega ainda"}
                </span>
                {statusTeste?.id === w.id && (
                  <span role="status" className="font-semibold text-foreground">
                    Teste:{" "}
                    {statusTeste.status === null
                      ? "sem resposta (timeout/rede)"
                      : `HTTP ${statusTeste.status}`}
                  </span>
                )}
                <span className="ml-auto flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => testar(w.id)}
                    disabled={pendente}
                    className="inline-flex items-center gap-1 rounded-full border border-border-strong px-2.5 py-1 text-xs font-semibold text-muted transition-colors hover:border-brand/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25 disabled:opacity-50"
                  >
                    <Send className="h-3 w-3" aria-hidden />
                    Testar entrega
                  </button>
                  {!w.ativo && (
                    <button
                      type="button"
                      onClick={() => reativar(w.id)}
                      disabled={pendente}
                      className="inline-flex items-center gap-1 rounded-full border border-border-strong px-2.5 py-1 text-xs font-semibold text-muted transition-colors hover:border-brand/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25 disabled:opacity-50"
                    >
                      <RefreshCcw className="h-3 w-3" aria-hidden />
                      Reativar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => remover(w.id)}
                    disabled={pendente}
                    aria-label={`Remover webhook ${w.url}`}
                    className="inline-flex items-center gap-1 rounded-full border border-border-strong px-2.5 py-1 text-xs font-semibold text-muted transition-colors hover:border-brand/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25 disabled:opacity-50"
                  >
                    <Trash2 className="h-3 w-3" aria-hidden />
                    Remover
                  </button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Novo webhook */}
      {formAberto ? (
        <form
          className="flex flex-col gap-3 rounded-xl border border-brand/30 bg-brand-soft/50 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            criar();
          }}
        >
          <GrupoCampo
            rotulo="URL de destino"
            htmlFor="webhook-url"
            auxilio="Apenas https:// — o endpoint do seu Zapier/Make/RD que recebe o POST."
          >
            <Campo
              id="webhook-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://hooks.zapier.com/…"
              maxLength={500}
              disabled={pendente}
            />
          </GrupoCampo>
          <fieldset>
            <legend className="text-sm font-medium text-foreground">Eventos assinados</legend>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
              {EVENTOS_WEBHOOK.map((e) => (
                <label key={e} className="inline-flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={eventos.includes(e)}
                    onChange={() => alternarEvento(e)}
                    disabled={pendente}
                    className="h-4 w-4 rounded border-border-strong accent-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25"
                  />
                  {ROTULO_EVENTO[e]}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap items-center gap-2">
            <Botao
              type="submit"
              tamanho="sm"
              disabled={pendente || url.trim() === "" || eventos.length === 0}
            >
              <Plus className="h-4 w-4" aria-hidden />
              {pendente ? "Cadastrando…" : "Cadastrar webhook"}
            </Botao>
            <Botao
              variante="fantasma"
              tamanho="sm"
              onClick={() => setFormAberto(false)}
              disabled={pendente}
            >
              Cancelar
            </Botao>
          </div>
        </form>
      ) : (
        <div>
          <Botao variante="secundario" tamanho="sm" onClick={() => setFormAberto(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            Novo webhook
          </Botao>
        </div>
      )}
    </div>
  );
}
