// TREINAR IA (gestor/admin) — a assistente virtual da imobiliária: toggle
// liga/desliga, nome, persona, boas-vindas, FAQ e critérios de escalonamento,
// com o PLAYGROUND ao lado testando a config SALVA na hora. Corretor é
// redirecionado (mesmo gate das áreas de gestão). As regras fixas de
// segurança (transparência, nunca inventar dados, escalar pedido de humano)
// vivem no core e não são editáveis por aqui.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { obterConfigAtendimento } from "@/lib/dados/atendimento-config";
import { obterPapelEOrg } from "@/lib/dados/gestor";
import { FormTreinarIa } from "./FormTreinarIa";
import { PlaygroundIa } from "./PlaygroundIa";

export const metadata: Metadata = { title: "CRM — Treinar IA" };
export const dynamic = "force-dynamic";

export default async function PaginaTreinarIa() {
  const contexto = await obterPapelEOrg();
  if (contexto === null) {
    redirect("/entrar");
  }
  if (contexto.papel !== "gestor" && contexto.papel !== "admin") {
    redirect("/corretor/crm?aviso=area-restrita-gestor");
  }

  const dados = await obterConfigAtendimento();
  if (dados === null) {
    redirect("/entrar");
  }
  const { config, iaDisponivelNoAmbiente } = dados;

  return (
    <>
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Treinar IA
        </h1>
        <p className="mt-1 text-muted">
          Configure a assistente virtual que responde os contatos no WhatsApp —
          e teste ao lado, antes de qualquer cliente ver.
        </p>
      </header>

      <div className="mt-8 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <FormTreinarIa
          inicial={{
            iaAtiva: config.iaAtiva,
            nomeAssistente: config.nomeAssistente,
            persona: config.persona ?? "",
            boasVindas: config.boasVindas ?? "",
            faq: config.faq,
            escalarQuando: config.escalarQuando ?? "",
          }}
          iaDisponivelNoAmbiente={iaDisponivelNoAmbiente}
        />

        <div className="flex flex-col gap-4 lg:sticky lg:top-6">
          <PlaygroundIa nomeAssistente={config.nomeAssistente} />
          <p className="flex items-start gap-2 rounded-2xl border border-border bg-surface p-4 text-xs leading-relaxed text-subtle">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-strong" aria-hidden />
            <span>
              Regras fixas (não configuráveis): a IA sempre se apresenta como
              assistente virtual, nunca inventa imóvel, preço ou condição, e
              escala imediatamente quando o cliente pede um atendente humano.
            </span>
          </p>
        </div>
      </div>
    </>
  );
}
