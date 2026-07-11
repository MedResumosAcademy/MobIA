"use client";

// FORMULÁRIO de novo contato (CRM 2.0). Client fino sobre criarContatoAction:
// nome, telefone, e-mail, tags (separadas por vírgula), observação e o opt-in
// de marketing (LGPD: checkbox NUNCA pré-marcado; marcou ⇒ fonte obrigatória).
// Sucesso navega direto para a ficha do contato criado.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ContatoInput } from "@imobia/domain";
import { Botao } from "@/components/ui/Botao";
import { Campo, CampoTextarea, GrupoCampo } from "@/components/ui/Campo";
import { criarContatoAction } from "@/lib/dados/contatos";

export function FormularioContato() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [tags, setTags] = useState("");
  const [observacao, setObservacao] = useState("");
  const [consentiu, setConsentiu] = useState(false);
  const [fonte, setFonte] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function aoSalvar() {
    setErro(null);
    const input: ContatoInput = {
      nome: nome.trim(),
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t !== ""),
      consentimentoMarketing: consentiu,
    };
    if (telefone.trim() !== "") {
      input.telefone = telefone.trim();
    }
    if (email.trim() !== "") {
      input.email = email.trim();
    }
    if (observacao.trim() !== "") {
      input.observacao = observacao.trim();
    }
    if (consentiu && fonte.trim() !== "") {
      input.consentimentoFonte = fonte.trim();
    }
    iniciar(async () => {
      const r = await criarContatoAction(input);
      if (r.ok) {
        router.push(`/corretor/crm/contatos/${r.id}`);
      } else {
        setErro(r.erro);
      }
    });
  }

  return (
    <form
      className="mt-6 flex flex-col gap-4 rounded-2xl border border-border bg-surface-card p-6 shadow-[var(--shadow-soft)]"
      onSubmit={(e) => {
        e.preventDefault();
        aoSalvar();
      }}
    >
      <GrupoCampo rotulo="Nome" obrigatorio htmlFor="contato-nome">
        <Campo
          id="contato-nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Maria Souza"
          required
          maxLength={160}
        />
      </GrupoCampo>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <GrupoCampo
          rotulo="Telefone (WhatsApp)"
          htmlFor="contato-telefone"
          auxilio="DDD + número — ex.: (11) 98888-7777"
        >
          <Campo
            id="contato-telefone"
            type="tel"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder="(11) 98888-7777"
          />
        </GrupoCampo>
        <GrupoCampo rotulo="E-mail" htmlFor="contato-email">
          <Campo
            id="contato-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="maria@exemplo.com.br"
          />
        </GrupoCampo>
      </div>

      <GrupoCampo
        rotulo="Tags"
        htmlFor="contato-tags"
        auxilio="Separe por vírgula — ex.: vip, investidor (até 20 tags)"
      >
        <Campo
          id="contato-tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="vip, investidor"
        />
      </GrupoCampo>

      <GrupoCampo rotulo="Observação" htmlFor="contato-observacao">
        <CampoTextarea
          id="contato-observacao"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder="Prefere apartamentos na zona sul; contato indicado pelo João."
          maxLength={2000}
        />
      </GrupoCampo>

      {/* LGPD: opt-in explícito, nunca pré-marcado; fonte obrigatória junto. */}
      <fieldset className="rounded-xl border border-border bg-surface p-4">
        <legend className="px-1 text-sm font-medium text-foreground">
          Consentimento de marketing (LGPD)
        </legend>
        <label className="flex cursor-pointer items-start gap-2.5 text-sm text-foreground">
          <input
            type="checkbox"
            checked={consentiu}
            onChange={(e) => setConsentiu(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-border-strong accent-[var(--color-brand)]"
          />
          <span>
            Este contato <strong>autorizou receber campanhas</strong> de marketing
            por WhatsApp. Sem esta marcação ele nunca entra em disparos em massa —
            só em conversas 1:1 de atendimento.
          </span>
        </label>
        {consentiu && (
          <GrupoCampo
            rotulo="Fonte do consentimento"
            obrigatorio
            htmlFor="contato-fonte"
            auxilio='Onde o opt-in foi dado — ex.: "formulário do site", "pediu por WhatsApp em 10/07/2026"'
            className="mt-3"
          >
            <Campo
              id="contato-fonte"
              value={fonte}
              onChange={(e) => setFonte(e.target.value)}
              placeholder="formulário do site"
              maxLength={200}
              required
            />
          </GrupoCampo>
        )}
      </fieldset>

      {erro && (
        <p className="text-sm font-medium text-brand-strong" role="status">
          {erro}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Botao type="submit" disabled={pendente || nome.trim() === ""}>
          {pendente ? "Salvando…" : "Salvar contato"}
        </Botao>
        <Botao variante="fantasma" onClick={() => router.push("/corretor/crm")}>
          Cancelar
        </Botao>
      </div>
    </form>
  );
}
