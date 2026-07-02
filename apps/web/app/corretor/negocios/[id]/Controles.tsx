"use client";

// Controles interativos do detalhe de um NEGÓCIO: mover etapa (avançar/retroceder
// ou select direto), marcar ganho/perdido (perdido pede motivo) e adicionar nota
// à timeline. Fina camada client sobre as server actions de ../acoes.ts; após
// cada ação, router.refresh() re-renderiza o Server Component pai. A autoridade
// de escopo é a RLS (0011) — aqui só orquestramos a interação.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { EtapaNegocio } from "@imobia/domain";
import { Botao } from "@/components/ui/Botao";
import { Campo, CampoSelect, CampoTextarea, GrupoCampo } from "@/components/ui/Campo";
import {
  adicionarAtividadeAction,
  definirResultadoAction,
  moverEtapaAction,
} from "../acoes";
import { ETAPAS_ORDEM, ROTULO_ETAPA } from "../rotulos";

type Props = {
  id: string;
  etapaAtual: EtapaNegocio;
  /** true quando o negócio já foi fechado (ganho/perdido) — some com os botões. */
  fechado: boolean;
};

function formData(entradas: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [chave, valor] of Object.entries(entradas)) {
    fd.set(chave, valor);
  }
  return fd;
}

export function ControlesNegocio({ id, etapaAtual, fechado }: Props) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [mostrarPerda, setMostrarPerda] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [tipoNota, setTipoNota] = useState("nota");
  const [textoNota, setTextoNota] = useState("");

  const indice = ETAPAS_ORDEM.indexOf(etapaAtual);

  function mover(etapa: EtapaNegocio) {
    iniciar(async () => {
      await moverEtapaAction(formData({ id, etapa }));
      router.refresh();
    });
  }

  function definir(resultado: "ganho" | "perdido") {
    iniciar(async () => {
      await definirResultadoAction(
        formData(resultado === "perdido" ? { id, resultado, motivo } : { id, resultado }),
      );
      setMostrarPerda(false);
      setMotivo("");
      router.refresh();
    });
  }

  function adicionar() {
    if (textoNota.trim() === "") {
      return;
    }
    iniciar(async () => {
      await adicionarAtividadeAction(formData({ id, tipo: tipoNota, descricao: textoNota }));
      setTextoNota("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {!fechado && (
        <section className="rounded-2xl border border-border bg-surface-card p-6 shadow-[var(--shadow-soft)]">
          <h2 className="text-lg font-semibold text-foreground">Etapa</h2>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Botao
              variante="secundario"
              tamanho="sm"
              disabled={pendente || indice <= 0}
              onClick={() => mover(ETAPAS_ORDEM[indice - 1])}
            >
              ← Retroceder
            </Botao>
            <CampoSelect
              value={etapaAtual}
              disabled={pendente}
              onChange={(e) => mover(e.target.value as EtapaNegocio)}
              className="w-auto py-2"
            >
              {ETAPAS_ORDEM.map((etapa) => (
                <option key={etapa} value={etapa}>
                  {ROTULO_ETAPA[etapa]}
                </option>
              ))}
            </CampoSelect>
            <Botao
              variante="secundario"
              tamanho="sm"
              disabled={pendente || indice >= ETAPAS_ORDEM.length - 1}
              onClick={() => mover(ETAPAS_ORDEM[indice + 1])}
            >
              Avançar →
            </Botao>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-5">
            <Botao variante="primario" disabled={pendente} onClick={() => definir("ganho")}>
              Marcar ganho
            </Botao>
            <Botao
              variante="secundario"
              disabled={pendente}
              onClick={() => setMostrarPerda((v) => !v)}
            >
              Marcar perdido
            </Botao>
          </div>

          {mostrarPerda && (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <GrupoCampo rotulo="Motivo da perda" htmlFor="motivo-perda" className="flex-1">
                <Campo
                  id="motivo-perda"
                  value={motivo}
                  disabled={pendente}
                  placeholder="Ex.: comprou com outro corretor"
                  onChange={(e) => setMotivo(e.target.value)}
                />
              </GrupoCampo>
              <Botao variante="secundario" disabled={pendente} onClick={() => definir("perdido")}>
                {pendente ? "Salvando…" : "Confirmar perda"}
              </Botao>
            </div>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-border bg-surface-card p-6 shadow-[var(--shadow-soft)]">
        <h2 className="text-lg font-semibold text-foreground">Registrar atividade</h2>
        <div className="mt-4 flex flex-col gap-3">
          <GrupoCampo rotulo="Tipo" htmlFor="tipo-nota">
            <CampoSelect
              id="tipo-nota"
              value={tipoNota}
              disabled={pendente}
              onChange={(e) => setTipoNota(e.target.value)}
              className="w-auto py-2"
            >
              <option value="nota">Nota</option>
              <option value="ligacao">Ligação</option>
              <option value="email">E-mail</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="visita">Visita</option>
            </CampoSelect>
          </GrupoCampo>
          <GrupoCampo rotulo="Descrição" htmlFor="texto-nota">
            <CampoTextarea
              id="texto-nota"
              value={textoNota}
              disabled={pendente}
              placeholder="O que aconteceu neste contato?"
              onChange={(e) => setTextoNota(e.target.value)}
            />
          </GrupoCampo>
          <div>
            <Botao
              variante="primario"
              disabled={pendente || textoNota.trim() === ""}
              onClick={adicionar}
            >
              {pendente ? "Salvando…" : "Adicionar"}
            </Botao>
          </div>
        </div>
      </section>
    </div>
  );
}
