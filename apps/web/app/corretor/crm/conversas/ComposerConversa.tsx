"use client";

// COMPOSER da thread do inbox — a resposta da EQUIPE. Mesmos modos honestos do
// composer da ficha do contato, mais o modo SIMULAÇÃO:
//   0. contato de simulação → texto livre sempre (enviarMensagemAction registra
//      como 'enviada' SEM tocar a Meta — invariante do simulador);
//   1. Meta conectada + janela de 24h ABERTA → texto livre;
//   2. Meta conectada + janela FECHADA → só template aprovado (select do
//      espelho local quando houver; senão o slug digitado — a Meta decide);
//   3. Meta NÃO conectada → fallback wa.me (nada fica registrado — aviso).
// A action revalida a rota; router.refresh() atualiza a thread na hora.

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Info, Send } from "lucide-react";
import { montarLinkWhatsApp } from "@imobia/core";
import { Botao, classesBotao } from "@/components/ui/Botao";
import { Campo, CampoSelect, CampoTextarea } from "@/components/ui/Campo";
import { enviarMensagemAction, enviarTemplateAction } from "@/lib/dados/conversas";

export function ComposerConversa({
  contatoId,
  telefone,
  janelaAberta,
  metaConectada,
  simulacao,
  templatesAprovados,
}: {
  contatoId: string;
  /** Dígitos com DDI 55 — null desabilita (exceto na simulação). */
  telefone: string | null;
  janelaAberta: boolean;
  metaConectada: boolean;
  /** Contato de teste do simulador — texto livre sempre, Meta nunca. */
  simulacao: boolean;
  /** Nomes dos templates 'aprovado' no espelho local (select fora da janela). */
  templatesAprovados: string[];
}) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [template, setTemplate] = useState("");
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [waUrl, setWaUrl] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

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

  const feedback = aviso && (
    <p
      className={`text-xs font-medium ${aviso.tipo === "ok" ? "text-brand-strong" : "text-gold-strong"}`}
      role="status"
    >
      {aviso.texto}
    </p>
  );

  // Modo 0 — SIMULAÇÃO: texto livre sempre; nada sai para o WhatsApp.
  // Modo 1 — Meta ok, janela aberta: texto livre de verdade.
  if (simulacao || (metaConectada && janelaAberta && telefone !== null)) {
    return (
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          enviarTexto();
        }}
      >
        <CampoTextarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={simulacao ? "Responder como equipe…" : "Escreva a mensagem…"}
          aria-label="Mensagem para o contato"
          maxLength={4096}
          disabled={pendente}
          className="min-h-16"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Botao type="submit" tamanho="sm" disabled={pendente || texto.trim() === ""}>
            <Send className="h-4 w-4" aria-hidden />
            {pendente ? "Enviando…" : "Enviar"}
          </Botao>
          {feedback}
          {waUrl !== null && (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={classesBotao("secundario", "sm")}
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              Abrir no WhatsApp do aparelho
            </a>
          )}
        </div>
      </form>
    );
  }

  if (telefone === null) {
    return (
      <p className="flex items-start gap-2 rounded-xl border border-dashed border-border-strong bg-surface p-3 text-xs text-subtle">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        Este contato não tem telefone cadastrado — adicione um número na ficha
        para conversar por WhatsApp.
      </p>
    );
  }

  // Modo 3 — sem Meta: degrade honesto para o wa.me com o texto digitado.
  if (!metaConectada) {
    const link = texto.trim() === "" ? null : montarLinkWhatsApp(telefone, texto.trim());
    return (
      <div className="flex flex-col gap-2">
        <CampoTextarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escreva a mensagem…"
          aria-label="Mensagem para o contato"
          maxLength={4096}
          className="min-h-16"
        />
        <div className="flex flex-wrap items-center gap-3">
          {link !== null ? (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className={classesBotao("primario", "sm")}
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              Abrir no WhatsApp
            </a>
          ) : (
            <Botao disabled tamanho="sm">
              <ExternalLink className="h-4 w-4" aria-hidden />
              Abrir no WhatsApp
            </Botao>
          )}
          <p className="flex items-start gap-1.5 text-xs text-subtle">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              WhatsApp não conectado: a mensagem abre no seu aparelho e não fica
              registrada aqui.{" "}
              <Link
                href="/corretor/crm/conexao"
                className="font-medium text-brand-strong underline-offset-2 hover:underline"
              >
                Ver conexão
              </Link>
            </span>
          </p>
        </div>
      </div>
    );
  }

  // Modo 2 — Meta ok, janela fechada: só template aprovado.
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-start gap-2 rounded-xl border border-gold/40 bg-gold-soft p-3 text-xs text-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-strong" aria-hidden />
        Fora da janela de 24h, a Meta só permite template aprovado. O texto livre
        volta quando o contato responder.
      </p>
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          enviarTemplate();
        }}
      >
        {templatesAprovados.length > 0 ? (
          <CampoSelect
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            aria-label="Template aprovado na Meta"
            className="flex-1"
          >
            <option value="">Escolha um template aprovado…</option>
            {templatesAprovados.map((nome) => (
              <option key={nome} value={nome}>
                {nome}
              </option>
            ))}
          </CampoSelect>
        ) : (
          <Campo
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            placeholder="nome_do_template_aprovado"
            aria-label="Nome do template aprovado na Meta"
            maxLength={120}
            className="flex-1"
          />
        )}
        <Botao type="submit" tamanho="sm" disabled={pendente || template.trim() === ""}>
          <Send className="h-4 w-4" aria-hidden />
          {pendente ? "Enviando…" : "Enviar template"}
        </Botao>
      </form>
      {feedback}
    </div>
  );
}
