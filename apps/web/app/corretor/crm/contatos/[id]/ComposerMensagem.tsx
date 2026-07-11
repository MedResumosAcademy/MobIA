"use client";

// COMPOSER de mensagem da ficha do contato — três modos HONESTOS:
//   1. Meta conectada + janela de 24h ABERTA  → texto livre (enviarMensagemAction);
//   2. Meta conectada + janela FECHADA        → só template aprovado
//      (enviarTemplateAction — regra da Meta para iniciar conversa);
//   3. Meta NÃO conectada                     → fallback wa.me: o texto abre no
//      WhatsApp do aparelho (nada fica registrado aqui — aviso explícito).
// A action revalida a rota; ainda assim chamamos router.refresh() para a
// timeline refletir a mensagem na hora.

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Info, Send } from "lucide-react";
import { montarLinkWhatsApp } from "@imobia/core";
import { Botao, classesBotao } from "@/components/ui/Botao";
import { Campo, CampoTextarea } from "@/components/ui/Campo";
import { enviarMensagemAction, enviarTemplateAction } from "@/lib/dados/conversas";

export function ComposerMensagem({
  contatoId,
  telefone,
  janelaAberta,
  metaConectada,
}: {
  contatoId: string;
  /** Telefone em dígitos (DDI 55) — null desabilita tudo com aviso. */
  telefone: string | null;
  janelaAberta: boolean;
  metaConectada: boolean;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [template, setTemplate] = useState("");
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [waUrl, setWaUrl] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  if (telefone === null) {
    return (
      <p className="flex items-start gap-2 rounded-xl border border-dashed border-border-strong bg-surface p-4 text-sm text-subtle">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        Este contato não tem telefone cadastrado — adicione um número para
        conversar por WhatsApp.
      </p>
    );
  }

  function enviarTexto() {
    setAviso(null);
    setWaUrl(null);
    iniciar(async () => {
      const r = await enviarMensagemAction(contatoId, texto);
      if (r.ok) {
        setTexto("");
        setAviso({ tipo: "ok", texto: "Mensagem enviada." });
        router.refresh();
      } else {
        setAviso({ tipo: "erro", texto: r.erro });
        setWaUrl(r.waUrl ?? null);
      }
    });
  }

  function enviarTemplate() {
    setAviso(null);
    iniciar(async () => {
      const r = await enviarTemplateAction(contatoId, template);
      if (r.ok) {
        setTemplate("");
        setAviso({ tipo: "ok", texto: "Template enviado." });
        router.refresh();
      } else {
        setAviso({ tipo: "erro", texto: r.erro });
      }
    });
  }

  // Modo 3 — sem Meta: degrade honesto para o wa.me com o texto digitado.
  if (!metaConectada) {
    const link = texto.trim() === "" ? null : montarLinkWhatsApp(telefone, texto.trim());
    return (
      <div className="flex flex-col gap-3">
        <CampoTextarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escreva a mensagem…"
          aria-label="Mensagem para o contato"
          maxLength={4096}
        />
        {link !== null ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className={classesBotao("primario", "md", "self-start")}
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
            Abrir no WhatsApp
          </a>
        ) : (
          <Botao disabled className="self-start">
            <ExternalLink className="h-4 w-4" aria-hidden />
            Abrir no WhatsApp
          </Botao>
        )}
        <p className="flex items-start gap-2 text-xs text-subtle">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            WhatsApp ainda não conectado: a mensagem abre no seu aparelho e não
            fica registrada aqui.{" "}
            <Link
              href="/corretor/crm/conexao"
              className="font-medium text-brand-strong underline-offset-2 hover:underline"
            >
              Ver conexão
            </Link>
          </span>
        </p>
      </div>
    );
  }

  // Modo 2 — Meta ok, janela fechada: só template aprovado.
  if (!janelaAberta) {
    return (
      <div className="flex flex-col gap-3">
        <p className="flex items-start gap-2 rounded-xl border border-gold/40 bg-gold-soft p-3 text-xs text-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-strong" aria-hidden />
          Fora da janela de 24h, a Meta só permite iniciar conversa com um
          template aprovado. O texto livre volta quando o contato responder.
        </p>
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            enviarTemplate();
          }}
        >
          <Campo
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            placeholder="nome_do_template_aprovado"
            aria-label="Nome do template aprovado na Meta"
            maxLength={120}
            className="flex-1"
          />
          <Botao type="submit" disabled={pendente || template.trim() === ""}>
            <Send className="h-4 w-4" aria-hidden />
            {pendente ? "Enviando…" : "Enviar template"}
          </Botao>
        </form>
        {aviso && (
          <p
            className={`text-xs font-medium ${aviso.tipo === "ok" ? "text-brand-strong" : "text-gold-strong"}`}
            role="status"
          >
            {aviso.texto}
          </p>
        )}
      </div>
    );
  }

  // Modo 1 — Meta ok, janela aberta: texto livre.
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        enviarTexto();
      }}
    >
      <CampoTextarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Escreva a mensagem…"
        aria-label="Mensagem para o contato"
        maxLength={4096}
        disabled={pendente}
      />
      <Botao type="submit" disabled={pendente || texto.trim() === ""} className="self-start">
        <Send className="h-4 w-4" aria-hidden />
        {pendente ? "Enviando…" : "Enviar"}
      </Botao>
      {aviso && (
        <p
          className={`text-xs font-medium ${aviso.tipo === "ok" ? "text-brand-strong" : "text-gold-strong"}`}
          role="status"
        >
          {aviso.texto}
        </p>
      )}
      {waUrl !== null && (
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={classesBotao("secundario", "sm", "self-start")}
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
          Abrir no WhatsApp do aparelho
        </a>
      )}
    </form>
  );
}
