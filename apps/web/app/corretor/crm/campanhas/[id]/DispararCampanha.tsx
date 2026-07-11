"use client";

// DISPARO da campanha (gestor/admin) em DOIS PASSOS honestos:
//   1. "Disparar campanha" → preverAlcanceAction (mesma segmentação do envio)
//      e mostra a confirmação com o número real: alvo + excluídos LGPD/telefone;
//   2. "Confirmar disparo" → dispararCampanhaAction (claim anti-corrida na
//      action; a Meta nunca é chamada para excluídos).
// Sem Meta conectada o botão fica desabilitado com aviso e link para Conexão.

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Send } from "lucide-react";
import { Botao } from "@/components/ui/Botao";
import { dispararCampanhaAction, preverAlcanceAction } from "@/lib/dados/campanhas";
import type { Segmento } from "@imobia/domain";
import { plural } from "@/lib/plural";

type Previsao = {
  alvo: number;
  excluidos: { semConsentimento: number; semTelefone: number };
};

export function DispararCampanha({
  campanhaId,
  segmento,
  metaConectada,
  temTemplate,
}: {
  campanhaId: string;
  segmento: Segmento;
  metaConectada: boolean;
  temTemplate: boolean;
}) {
  const router = useRouter();
  const [previsao, setPrevisao] = useState<Previsao | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();

  function prever() {
    setAviso(null);
    iniciar(async () => {
      const r = await preverAlcanceAction(segmento);
      if (r.ok) {
        setPrevisao({ alvo: r.alvo, excluidos: r.excluidos });
      } else {
        setAviso({ tipo: "erro", texto: r.erro });
      }
    });
  }

  function disparar() {
    setAviso(null);
    iniciar(async () => {
      const r = await dispararCampanhaAction(campanhaId);
      setPrevisao(null);
      if (r.ok) {
        setAviso({
          tipo: "ok",
          texto: `Disparo concluído: ${r.enviados} ${plural(r.enviados, "mensagem enviada", "mensagens enviadas")}, ${r.falhas} ${plural(r.falhas, "falha", "falhas")}, ${r.excluidos} ${plural(r.excluidos, "excluído", "excluídos")}.`,
        });
      } else {
        setAviso({ tipo: "erro", texto: r.erro });
      }
      router.refresh();
    });
  }

  if (!metaConectada) {
    return (
      <div className="rounded-2xl border border-gold/40 bg-gold-soft p-5">
        <p className="flex items-start gap-2 text-sm text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gold-strong" aria-hidden />
          <span>
            <strong>WhatsApp não conectado</strong> — campanhas só saem pela API
            oficial da Meta. Configure a integração para liberar o disparo.
          </span>
        </p>
        <div className="mt-3 flex items-center gap-3">
          <Botao disabled>
            <Send className="h-4 w-4" aria-hidden />
            Disparar campanha
          </Botao>
          <Link
            href="/corretor/crm/conexao"
            className="text-sm font-medium text-brand-strong underline-offset-2 hover:underline"
          >
            Ver conexão
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-brand/30 bg-surface-card p-5 shadow-[var(--shadow-soft)]">
      <h2 className="text-lg font-semibold text-foreground">Disparar</h2>
      {!temTemplate && (
        <p className="mt-2 flex items-start gap-2 text-sm text-gold-strong">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Defina o nome de um template aprovado na Meta antes de disparar —
          campanha inicia conversa fora da janela de 24h.
        </p>
      )}

      {previsao === null ? (
        <div className="mt-3">
          <Botao onClick={prever} disabled={pendente || !temTemplate}>
            <Send className="h-4 w-4" aria-hidden />
            {pendente ? "Calculando alcance…" : "Disparar campanha"}
          </Botao>
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-border bg-surface p-4">
          <p className="text-sm text-foreground" role="status">
            A campanha vai para{" "}
            <strong>
              {previsao.alvo} {plural(previsao.alvo, "contato", "contatos")}
            </strong>
            . Ficam de fora: {previsao.excluidos.semConsentimento} sem consentimento
            de marketing (LGPD) e {previsao.excluidos.semTelefone} sem telefone.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Botao onClick={disparar} disabled={pendente || previsao.alvo === 0}>
              {pendente ? "Disparando…" : "Confirmar disparo"}
            </Botao>
            <Botao
              variante="fantasma"
              onClick={() => setPrevisao(null)}
              disabled={pendente}
            >
              Cancelar
            </Botao>
          </div>
          {previsao.alvo === 0 && (
            <p className="mt-2 text-xs text-subtle">
              Nenhum contato apto — ajuste o segmento ou registre consentimentos.
            </p>
          )}
        </div>
      )}

      {aviso && (
        <p
          className={`mt-3 text-sm font-medium ${aviso.tipo === "ok" ? "text-brand-strong" : "text-gold-strong"}`}
          role="status"
        >
          {aviso.texto}
        </p>
      )}
    </div>
  );
}
