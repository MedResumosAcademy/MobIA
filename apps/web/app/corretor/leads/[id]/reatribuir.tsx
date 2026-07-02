"use client";

// Controle de REATRIBUIÇÃO de lead (só gestor/admin — o Server Component pai já
// decide se renderiza). Chama reatribuirLeadAction; a RLS (policy leads_update
// do 0010) é a autoridade final. Após sucesso, revalida via router.refresh().

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Botao } from "@/components/ui/Botao";
import { CampoSelect, GrupoCampo } from "@/components/ui/Campo";
import {
  reatribuirLeadAction,
  type CorretorOpcao,
} from "@/lib/dados/gestor";

export function ReatribuirLead({
  leadId,
  corretorAtualId,
  corretores,
}: {
  leadId: string;
  /** Corretor atual do lead — pré-seleciona o select. null quando desconhecido. */
  corretorAtualId: string | null;
  corretores: CorretorOpcao[];
}) {
  const router = useRouter();
  const [selecionado, setSelecionado] = useState(corretorAtualId ?? "");
  const [pendente, iniciar] = useTransition();
  const [mensagem, setMensagem] = useState<
    { tipo: "ok" | "erro"; texto: string } | null
  >(null);

  const inalterado = selecionado === "" || selecionado === corretorAtualId;

  function aoReatribuir() {
    setMensagem(null);
    iniciar(async () => {
      const r = await reatribuirLeadAction(leadId, selecionado);
      if (r.ok) {
        setMensagem({ tipo: "ok", texto: "Lead reatribuído." });
        router.refresh();
      } else {
        setMensagem({ tipo: "erro", texto: r.erro });
      }
    });
  }

  return (
    <section className="mt-8 rounded-2xl border border-border bg-surface-card p-6 shadow-[var(--shadow-soft)]">
      <h2 className="text-lg font-semibold text-foreground">Reatribuir lead</h2>
      <p className="mt-1 text-sm text-muted">
        Transfira o atendimento deste lead para outro corretor da equipe.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <GrupoCampo rotulo="Reatribuir para" htmlFor="reatribuir-corretor" className="flex-1">
          <CampoSelect
            id="reatribuir-corretor"
            value={selecionado}
            disabled={pendente}
            onChange={(e) => setSelecionado(e.target.value)}
          >
            {corretorAtualId === null && (
              <option value="">Selecione um corretor…</option>
            )}
            {corretores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome ?? "Corretor"}
              </option>
            ))}
          </CampoSelect>
        </GrupoCampo>
        <Botao
          variante="primario"
          onClick={aoReatribuir}
          disabled={pendente || inalterado}
        >
          {pendente ? "Reatribuindo…" : "Reatribuir"}
        </Botao>
      </div>
      {mensagem && (
        <p
          className={`mt-3 text-sm ${
            mensagem.tipo === "ok" ? "text-brand-strong" : "text-brand-strong"
          }`}
        >
          {mensagem.texto}
        </p>
      )}
    </section>
  );
}
