"use client";

// FORMULÁRIO do "Treinar IA" (gestor/admin): liga/desliga a assistente, dá
// nome, persona (tom/estilo), boas-vindas, FAQ (pares pergunta/resposta) e
// critérios extras de escalonamento. As REGRAS FIXAS (transparência de IA,
// nunca inventar imóvel/preço, escalar quando pedem humano) vivem no core e
// NÃO são configuráveis — o texto da tela deixa isso claro. Salva via
// salvarConfigAction (zod valida limites; upsert por org).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Trash2 } from "lucide-react";
import type { FaqItem } from "@imobia/domain";
import { Botao } from "@/components/ui/Botao";
import { Campo, CampoTextarea, GrupoCampo } from "@/components/ui/Campo";
import { salvarConfigAction } from "@/lib/dados/atendimento-config";

const MAX_FAQ = 30;

export type ConfigInicial = {
  iaAtiva: boolean;
  nomeAssistente: string;
  persona: string;
  boasVindas: string;
  faq: FaqItem[];
  escalarQuando: string;
};

export function FormTreinarIa({
  inicial,
  iaDisponivelNoAmbiente,
}: {
  inicial: ConfigInicial;
  iaDisponivelNoAmbiente: boolean;
}) {
  const router = useRouter();
  const [iaAtiva, setIaAtiva] = useState(inicial.iaAtiva);
  const [nome, setNome] = useState(inicial.nomeAssistente);
  const [persona, setPersona] = useState(inicial.persona);
  const [boasVindas, setBoasVindas] = useState(inicial.boasVindas);
  const [faq, setFaq] = useState<FaqItem[]>(inicial.faq);
  const [novaPergunta, setNovaPergunta] = useState("");
  const [novaResposta, setNovaResposta] = useState("");
  const [escalarQuando, setEscalarQuando] = useState(inicial.escalarQuando);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();

  function adicionarFaq() {
    const pergunta = novaPergunta.trim();
    const resposta = novaResposta.trim();
    if (pergunta === "" || resposta === "" || faq.length >= MAX_FAQ) {
      return;
    }
    setFaq((atual) => [...atual, { pergunta, resposta }]);
    setNovaPergunta("");
    setNovaResposta("");
  }

  function salvar() {
    setAviso(null);
    iniciar(async () => {
      const r = await salvarConfigAction({
        iaAtiva,
        nomeAssistente: nome.trim() === "" ? "Assistente" : nome.trim(),
        persona: persona.trim() === "" ? undefined : persona.trim(),
        boasVindas: boasVindas.trim() === "" ? undefined : boasVindas.trim(),
        faq,
        escalarQuando: escalarQuando.trim() === "" ? undefined : escalarQuando.trim(),
      });
      if (!r.ok) {
        setAviso({ tipo: "erro", texto: r.erro });
        return;
      }
      setAviso({ tipo: "ok", texto: "Configuração salva — o playground já usa a versão nova." });
      router.refresh();
    });
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        salvar();
      }}
    >
      {/* Toggle IA ativa */}
      <div className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-surface-card p-5 shadow-[var(--shadow-soft)]">
        <div>
          <p className="font-semibold text-foreground">IA de atendimento</p>
          <p className="mt-1 text-sm text-muted">
            Ligada, ela responde os contatos novos e escala para a equipe o que
            não souber. Desligada, tudo cai direto na fila humana.
          </p>
          {!iaDisponivelNoAmbiente && (
            <p className="mt-2 rounded-xl border border-gold/40 bg-gold-soft px-3 py-2 text-xs font-medium text-gold-strong">
              IA indisponível neste ambiente — configure a chave GROQ_API_KEY.
              Enquanto isso, TODAS as conversas caem na fila humana, mesmo com o
              interruptor ligado.
            </p>
          )}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={iaAtiva}
          aria-label="IA de atendimento ativa"
          onClick={() => setIaAtiva((v) => !v)}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25 ${
            iaAtiva ? "bg-brand" : "bg-border-strong"
          }`}
        >
          <span
            aria-hidden
            className={`absolute top-1 h-5 w-5 rounded-full bg-surface-card shadow transition-[left] ${
              iaAtiva ? "left-6" : "left-1"
            }`}
          />
        </button>
      </div>

      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-card p-5 shadow-[var(--shadow-soft)]">
        <GrupoCampo
          rotulo="Nome da assistente"
          htmlFor="ia-nome"
          auxilio="Ela sempre se apresenta como assistente virtual da imobiliária — transparência não é opcional."
        >
          <Campo
            id="ia-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Assistente"
            maxLength={80}
          />
        </GrupoCampo>
        <GrupoCampo
          rotulo="Persona (tom e estilo)"
          htmlFor="ia-persona"
          auxilio="Dicas: acolhedora e direta? Formal? Usa emoji? Fala da região que a imobiliária atende? A persona só dá o TOM — ela nunca inventa imóvel, preço ou condição."
        >
          <CampoTextarea
            id="ia-persona"
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            placeholder="Você é simpática e objetiva, especialista na zona sul de São Paulo. Responde em 2 ou 3 frases…"
            maxLength={2000}
            className="min-h-28"
          />
        </GrupoCampo>
        <GrupoCampo
          rotulo="Boas-vindas"
          htmlFor="ia-boas-vindas"
          auxilio="Enviada automaticamente como primeira mensagem quando um contato novo escreve e a IA está ativa (antes da resposta dela)."
        >
          <CampoTextarea
            id="ia-boas-vindas"
            value={boasVindas}
            onChange={(e) => setBoasVindas(e.target.value)}
            placeholder="Olá! Sou a assistente virtual da imobiliária. Como posso ajudar na busca do seu imóvel?"
            maxLength={1000}
          />
        </GrupoCampo>
      </section>

      {/* FAQ */}
      <section className="rounded-2xl border border-border bg-surface-card p-5 shadow-[var(--shadow-soft)]">
        <p className="font-semibold text-foreground">Perguntas frequentes ({faq.length}/{MAX_FAQ})</p>
        <p className="mt-1 text-sm text-muted">
          O que a IA pode responder com segurança — horário, documentação,
          formas de visita. Ela cita SÓ o que estiver aqui.
        </p>
        {faq.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2">
            {faq.map((item, i) => (
              <li
                key={`${item.pergunta}-${i}`}
                className="flex items-start justify-between gap-3 rounded-xl border border-border bg-surface p-3"
              >
                <div className="min-w-0 text-sm">
                  <p className="font-medium text-foreground">{item.pergunta}</p>
                  <p className="mt-0.5 text-muted">{item.resposta}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFaq((atual) => atual.filter((_, j) => j !== i))}
                  aria-label={`Remover pergunta: ${item.pergunta}`}
                  className="shrink-0 rounded-full p-1.5 text-subtle transition-colors hover:bg-surface-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Campo
            value={novaPergunta}
            onChange={(e) => setNovaPergunta(e.target.value)}
            placeholder="Pergunta (ex.: Vocês aceitam pet?)"
            aria-label="Nova pergunta do FAQ"
            maxLength={300}
          />
          <Campo
            value={novaResposta}
            onChange={(e) => setNovaResposta(e.target.value)}
            placeholder="Resposta que a IA pode dar"
            aria-label="Resposta da nova pergunta do FAQ"
            maxLength={1000}
          />
          <Botao
            variante="secundario"
            onClick={adicionarFaq}
            disabled={
              novaPergunta.trim() === "" ||
              novaResposta.trim() === "" ||
              faq.length >= MAX_FAQ
            }
          >
            <Plus className="h-4 w-4" aria-hidden />
            Adicionar
          </Botao>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface-card p-5 shadow-[var(--shadow-soft)]">
        <GrupoCampo
          rotulo="Escalar para a equipe quando…"
          htmlFor="ia-escalar"
          auxilio="Critérios EXTRAS. Pedido de humano, negociação de valores e assuntos jurídicos já escalam sempre, por regra fixa."
        >
          <CampoTextarea
            id="ia-escalar"
            value={escalarQuando}
            onChange={(e) => setEscalarQuando(e.target.value)}
            placeholder="Cliente quer agendar visita; interessado em imóvel de alto padrão; reclamação de qualquer tipo…"
            maxLength={2000}
          />
        </GrupoCampo>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Botao type="submit" disabled={pendente}>
          <Save className="h-4 w-4" aria-hidden />
          {pendente ? "Salvando…" : "Salvar configuração"}
        </Botao>
        {aviso !== null && (
          <p
            className={`text-sm font-medium ${aviso.tipo === "ok" ? "text-brand-strong" : "text-gold-strong"}`}
            role="status"
          >
            {aviso.texto}
          </p>
        )}
      </div>
    </form>
  );
}
