"use client";

// Controles interativos do detalhe de um NEGÓCIO: mover etapa (avançar/retroceder
// ou select direto), marcar ganho/perdido (perdido pede motivo) e adicionar nota
// à timeline. Fina camada client sobre as server actions de ../acoes.ts; após
// cada ação, router.refresh() re-renderiza o Server Component pai. A autoridade
// de escopo é a RLS (0011) — aqui só orquestramos a interação.

import { useEffect, useRef, useState, useTransition } from "react";
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
  /** Motivos de perda da org (central de configuração, 0033) para o select. */
  motivosPerda: string[];
};

// Sentinela do select: "Outro" abre o campo livre (nunca vira motivo gravado).
const MOTIVO_OUTRO = "__outro";

function formData(entradas: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [chave, valor] of Object.entries(entradas)) {
    fd.set(chave, valor);
  }
  return fd;
}

export function ControlesNegocio({ id, etapaAtual, fechado, motivosPerda }: Props) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [mostrarPerda, setMostrarPerda] = useState(false);
  // Motivos da org no select; "Outro" (literal da lista sai — vira a opção
  // sentinela) abre o campo livre.
  const opcoesMotivo = motivosPerda.filter((m) => m.trim().toLowerCase() !== "outro");
  const [motivoSelecionado, setMotivoSelecionado] = useState(
    opcoesMotivo[0] ?? MOTIVO_OUTRO,
  );
  const [motivoLivre, setMotivoLivre] = useState("");
  const motivo =
    motivoSelecionado === MOTIVO_OUTRO ? motivoLivre.trim() : motivoSelecionado;
  const [tipoNota, setTipoNota] = useState("nota");
  const [textoNota, setTextoNota] = useState("");
  // Mensagem da última falha de ação (sessão expirada, RLS, rede) — as actions
  // retornam { ok, erro } em vez de lançar, para não cair no error boundary.
  const [erro, setErro] = useState<string | null>(null);
  // Valor local do select de etapa com commit em debounce (a11y): atravessar
  // as opções por seta não comita cada etapa intermediária, e o campo não
  // fica disabled sob o foco durante a ação (evita perder o foco).
  const [etapaLocal, setEtapaLocal] = useState<EtapaNegocio | null>(null);
  const timerEtapa = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Quando a etapa do servidor muda (após refresh), o valor local se dissolve —
  // ajuste DURANTE o render (padrão do React; sem setState em efeito).
  const [etapaServidorAnterior, setEtapaServidorAnterior] = useState(etapaAtual);
  if (etapaServidorAnterior !== etapaAtual) {
    setEtapaServidorAnterior(etapaAtual);
    setEtapaLocal(null);
  }

  useEffect(() => {
    return () => {
      if (timerEtapa.current) clearTimeout(timerEtapa.current);
    };
  }, []);

  function aoTrocarEtapa(etapa: EtapaNegocio) {
    if (pendente) return; // ignora enquanto a ação está no ar (sem disabled)
    setEtapaLocal(etapa);
    if (timerEtapa.current) clearTimeout(timerEtapa.current);
    timerEtapa.current = setTimeout(() => {
      timerEtapa.current = null;
      if (etapa !== etapaAtual) {
        mover(etapa);
      }
    }, 300);
  }

  const indice = ETAPAS_ORDEM.indexOf(etapaAtual);

  function mover(etapa: EtapaNegocio) {
    iniciar(async () => {
      const res = await moverEtapaAction(formData({ id, etapa }));
      if (!res.ok) {
        setErro(res.erro);
        setEtapaLocal(null); // reverte o select para a etapa do servidor
        return;
      }
      setErro(null);
      router.refresh();
    });
  }

  function definir(resultado: "ganho" | "perdido") {
    iniciar(async () => {
      const res = await definirResultadoAction(
        formData(resultado === "perdido" ? { id, resultado, motivo } : { id, resultado }),
      );
      if (!res.ok) {
        // Mantém o painel e o motivo digitado — o corretor não perde o texto.
        setErro(res.erro);
        return;
      }
      setErro(null);
      setMostrarPerda(false);
      setMotivoLivre("");
      router.refresh();
    });
  }

  function adicionar() {
    if (textoNota.trim() === "") {
      return;
    }
    iniciar(async () => {
      const res = await adicionarAtividadeAction(
        formData({ id, tipo: tipoNota, descricao: textoNota }),
      );
      if (!res.ok) {
        // Mantém a descrição digitada para tentar de novo.
        setErro(res.erro);
        return;
      }
      setErro(null);
      setTextoNota("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {erro !== null && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800"
        >
          {erro}
        </p>
      )}
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
              value={etapaLocal ?? etapaAtual}
              aria-busy={pendente || undefined}
              aria-label="Etapa do negócio"
              onChange={(e) => aoTrocarEtapa(e.target.value as EtapaNegocio)}
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
                <CampoSelect
                  id="motivo-perda"
                  value={motivoSelecionado}
                  disabled={pendente}
                  onChange={(e) => setMotivoSelecionado(e.target.value)}
                >
                  {opcoesMotivo.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                  <option value={MOTIVO_OUTRO}>Outro…</option>
                </CampoSelect>
              </GrupoCampo>
              {motivoSelecionado === MOTIVO_OUTRO && (
                <GrupoCampo
                  rotulo="Qual foi o motivo?"
                  htmlFor="motivo-perda-livre"
                  className="flex-1"
                >
                  <Campo
                    id="motivo-perda-livre"
                    value={motivoLivre}
                    disabled={pendente}
                    placeholder="Ex.: comprou com outro corretor"
                    onChange={(e) => setMotivoLivre(e.target.value)}
                  />
                </GrupoCampo>
              )}
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
