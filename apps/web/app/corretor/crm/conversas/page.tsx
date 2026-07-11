// INBOX DE CONVERSAS (CRM 2.0). Server Component: threads da org via
// listarConversas (última mensagem, não respondidas e janela de 24h por
// contato). Clicar leva à FICHA do contato — a timeline unificada É a
// conversa. Estado vazio honesto: aponta a conexão Meta quando falta.

import type { Metadata } from "next";
import Link from "next/link";
import { Clock, MessagesSquare } from "lucide-react";
import { EstadoVazio } from "@/components/EstadoVazio";
import { listarConversas } from "@/lib/dados/conversas";
import { statusConexaoMeta } from "@/lib/dados/meta-config";
import { plural } from "@/lib/plural";
import { tempoRelativo } from "../../leads/tempo";
import { TicksMensagem } from "../StatusMensagem";

export const metadata: Metadata = { title: "CRM — Conversas" };
export const dynamic = "force-dynamic";

export default async function PaginaConversas() {
  const conversas = await listarConversas();
  const meta = statusConexaoMeta();

  return (
    <>
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Conversas
        </h1>
        <p className="mt-1 text-muted">
          As conversas de WhatsApp da organização — clique para abrir a ficha do
          contato e responder por lá.
        </p>
      </header>

      {conversas.length === 0 ? (
        <div className="mt-8">
          {meta.webhookPronto ? (
            <EstadoVazio
              icone={<MessagesSquare className="h-6 w-6" aria-hidden />}
              titulo="Nenhuma conversa ainda"
              descricao="Quando um contato mandar mensagem no número conectado, a conversa aparece aqui na hora."
              cta={{ href: "/corretor/crm", rotulo: "Ver contatos" }}
            />
          ) : (
            <EstadoVazio
              icone={<MessagesSquare className="h-6 w-6" aria-hidden />}
              titulo="As conversas do WhatsApp aparecem aqui"
              descricao="Assim que a integração com a Meta estiver conectada, as mensagens recebidas viram conversas nesta tela — com janela de 24h e status de entrega."
              cta={{ href: "/corretor/crm/conexao", rotulo: "Ver conexão" }}
            />
          )}
        </div>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {conversas.map((c) => (
            <li key={c.contatoId}>
              <Link
                href={`/corretor/crm/contatos/${c.contatoId}`}
                className="flex items-center gap-3 rounded-2xl border border-border bg-surface-card p-4 shadow-[var(--shadow-soft)] transition-[border-color,box-shadow] hover:border-brand/30 hover:shadow-[var(--shadow-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                <span
                  aria-hidden
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand-strong"
                >
                  {c.contatoNome.trim().charAt(0).toUpperCase() || "?"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-semibold text-foreground">
                      {c.contatoNome}
                    </span>
                    {c.janela.aberta && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand-strong">
                        <Clock className="h-3 w-3" aria-hidden />
                        Janela aberta
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
                    {c.ultimaMensagem.direcao === "saida" && (
                      <span className="shrink-0 text-subtle">Você:</span>
                    )}
                    <span className="truncate">{c.ultimaMensagem.corpo}</span>
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-xs text-subtle">
                    {tempoRelativo(c.ultimaMensagem.criadoEm)}
                  </span>
                  {c.naoRespondidas > 0 ? (
                    <span
                      className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand px-1.5 py-0.5 text-[11px] font-bold text-brand-contrast"
                      aria-label={`${c.naoRespondidas} ${plural(c.naoRespondidas, "mensagem não respondida", "mensagens não respondidas")}`}
                    >
                      {c.naoRespondidas}
                    </span>
                  ) : (
                    c.ultimaMensagem.direcao === "saida" && (
                      <TicksMensagem status={c.ultimaMensagem.status} />
                    )
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
