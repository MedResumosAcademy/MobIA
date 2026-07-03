"use client";

// MENSAGEM POR WHATSAPP na ficha do negócio: o corretor escolhe o OBJETIVO
// (pílulas), gera a mensagem (IA com fallback no motor puro — tudo na Server
// Action gerarMensagemNegocioAction) e recebe um texto EDITÁVEL pronto para
// abrir no WhatsApp ou copiar. O link wa.me é recalculado com o texto editado.
// Sem telefone no negócio, o botão do WhatsApp fica desabilitado com dica.

import { useState, useTransition } from "react";
import { Check, Copy, MessageCircle, RefreshCw, Sparkles } from "lucide-react";
import type { NivelAtencao, ResultadoNegocio } from "@imobia/domain";
import type { ObjetivoMensagem } from "@imobia/core";
import { Botao, classesBotao } from "@/components/ui/Botao";
import { gerarMensagemNegocioAction } from "@/lib/dados/whatsapp";

const ROTULO_OBJETIVO: Record<ObjetivoMensagem, string> = {
  followup: "Follow-up",
  visita: "Marcar visita",
  proposta: "Avançar proposta",
  reativacao: "Reativar",
  pos_venda: "Pós-venda",
};

/** Objetivos que fazem sentido para o estado do negócio. */
function objetivosDisponiveis(
  resultado: ResultadoNegocio | null,
  atencao: NivelAtencao,
): readonly ObjetivoMensagem[] {
  if (resultado === "ganho") {
    return ["pos_venda", "followup"];
  }
  if (resultado === "perdido") {
    return ["reativacao", "followup"];
  }
  // Aberto: reativação primeiro quando o negócio está parado.
  return atencao === "parado"
    ? ["reativacao", "followup", "visita", "proposta"]
    : ["followup", "visita", "proposta", "reativacao"];
}

/** Troca o texto do link wa.me pelo texto editado no textarea. */
function linkComTexto(waUrl: string, mensagem: string): string {
  const base = waUrl.split("?")[0];
  return `${base}?text=${encodeURIComponent(mensagem)}`;
}

type Gerada = { mensagem: string; waUrl: string | null; viaIa: boolean };

export function MensagemWhatsApp({
  negocioId,
  resultado,
  atencao,
}: {
  negocioId: string;
  resultado: ResultadoNegocio | null;
  atencao: NivelAtencao;
}) {
  const objetivos = objetivosDisponiveis(resultado, atencao);
  const [objetivoSelecionado, setObjetivo] = useState<ObjetivoMensagem>(objetivos[0]);
  // Se o negócio mudar de estado na mesma sessão (ex.: virar ganho), a seleção
  // antiga pode sair da lista — cai no primeiro objetivo válido.
  const objetivo = objetivos.includes(objetivoSelecionado) ? objetivoSelecionado : objetivos[0];
  const [gerada, setGerada] = useState<Gerada | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [pendente, iniciar] = useTransition();

  function gerar() {
    setErro(null);
    setCopiado(false);
    iniciar(async () => {
      try {
        const r = await gerarMensagemNegocioAction(negocioId, objetivo);
        if (!r.ok) {
          setErro(r.erro);
          return;
        }
        setGerada({ mensagem: r.mensagem, waUrl: r.waUrl, viaIa: r.viaIa });
        setMensagem(r.mensagem);
      } catch {
        setErro("Não consegui montar a mensagem agora — tente de novo em instantes.");
      }
    });
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(mensagem);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setErro("Não consegui copiar — selecione o texto e copie manualmente.");
    }
  }

  const waHref =
    gerada?.waUrl && mensagem.trim() !== "" ? linkComTexto(gerada.waUrl, mensagem) : null;

  return (
    <section className="mt-6 rounded-2xl border border-border bg-surface-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-brand-strong" aria-hidden />
        <h2 className="text-lg font-semibold text-foreground">Mensagem por WhatsApp</h2>
      </div>
      <p className="mt-1 text-sm text-subtle">
        Escolha o objetivo e eu escrevo a mensagem para você revisar e enviar.
      </p>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Objetivo da mensagem">
        {objetivos.map((o) => {
          const ativo = o === objetivo;
          const destaque = o === "reativacao" && atencao === "parado";
          return (
            <button
              key={o}
              type="button"
              disabled={pendente}
              aria-pressed={ativo}
              onClick={() => setObjetivo(o)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                ativo
                  ? "border-transparent bg-brand text-brand-contrast shadow-[var(--shadow-soft)]"
                  : destaque
                    ? "border-gold/40 bg-gold-soft text-gold-strong hover:bg-gold-soft/70"
                    : "border-border-strong bg-surface text-muted hover:border-brand/40 hover:text-foreground"
              }`}
            >
              {ROTULO_OBJETIVO[o]}
              {destaque && !ativo && " · parado"}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        <Botao variante={gerada ? "secundario" : "primario"} tamanho="sm" disabled={pendente} onClick={gerar}>
          {gerada ? <RefreshCw className="h-4 w-4" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
          {pendente ? "Escrevendo…" : gerada ? "Gerar outra" : "Gerar mensagem"}
        </Botao>
      </div>

      {erro && (
        <p className="mt-3 text-sm text-brand-strong" role="alert">
          {erro}
        </p>
      )}

      {gerada && (
        <div className="mt-4">
          {gerada.viaIa && (
            <span
              className="mb-2 inline-flex items-center rounded-full border border-gold/40 bg-gold-soft px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-gold-strong"
              title="Mensagem escrita com ajuda de IA — revise antes de enviar"
            >
              IA
            </span>
          )}
          <textarea
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            rows={5}
            aria-label="Mensagem gerada — edite à vontade"
            className="w-full rounded-xl border border-border-strong bg-surface-card px-3.5 py-2.5 text-sm text-foreground shadow-[var(--shadow-soft)] transition-[border-color,box-shadow] duration-200 hover:border-brand/40 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
          />
          <div className="mt-3 flex flex-wrap gap-3">
            {waHref ? (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className={classesBotao("primario", "sm")}
              >
                <MessageCircle className="h-4 w-4" aria-hidden />
                Abrir no WhatsApp
              </a>
            ) : (
              <Botao
                variante="primario"
                tamanho="sm"
                disabled
                title="sem telefone — cadastre no negócio"
              >
                <MessageCircle className="h-4 w-4" aria-hidden />
                Abrir no WhatsApp
              </Botao>
            )}
            <Botao variante="secundario" tamanho="sm" onClick={copiar} disabled={mensagem.trim() === ""}>
              {copiado ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
              {copiado ? "Copiado!" : "Copiar"}
            </Botao>
          </div>
          {gerada.waUrl === null && (
            <p className="mt-2 text-xs text-subtle">
              Este negócio não tem telefone cadastrado — copie a mensagem ou cadastre o telefone em
              “Editar dados”.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
