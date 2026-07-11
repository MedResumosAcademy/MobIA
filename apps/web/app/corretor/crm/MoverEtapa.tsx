"use client";

// MOVER CONTATO DE ETAPA/FUNIL — client folha reutilizada pelo kanban, pela
// lista e pela ficha. Chama moverContatoDeEtapaAction (RPC 0028: qualquer
// membro da equipe move, sem afrouxar a policy de edição do contato).
//
// Trocar de FUNIL (quando mostrarFunil) leva o contato para a PRIMEIRA etapa
// do funil escolhido. O valor local segue o padrão do repo: ajuste DURANTE o
// render comparando a prop anterior (sem setState em efeito — lint 0/0).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moverContatoDeEtapaAction } from "@/lib/dados/funis";

type FunilOpcao = {
  id: string;
  nome: string;
  emoji: string | null;
  etapas: { chave: string; nome: string }[];
};

export function MoverEtapa({
  contatoId,
  funis,
  funilAtual,
  etapaAtual,
  mostrarFunil = false,
  compacto = false,
}: {
  contatoId: string;
  /** No kanban/lista: só o funil da vista. Na ficha: todos os ativos. */
  funis: FunilOpcao[];
  funilAtual: string | null;
  etapaAtual: string | null;
  mostrarFunil?: boolean;
  compacto?: boolean;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  // Otimismo local que se dissolve quando o servidor confirma (props mudam).
  const [local, setLocal] = useState<{ funil: string | null; etapa: string | null }>({
    funil: funilAtual,
    etapa: etapaAtual,
  });
  const [propAnterior, setPropAnterior] = useState({ funil: funilAtual, etapa: etapaAtual });
  if (propAnterior.funil !== funilAtual || propAnterior.etapa !== etapaAtual) {
    setPropAnterior({ funil: funilAtual, etapa: etapaAtual });
    setLocal({ funil: funilAtual, etapa: etapaAtual });
  }

  const funilSelecionado = funis.find((f) => f.id === local.funil) ?? funis[0] ?? null;

  function mover(funilId: string, etapaChave: string) {
    setErro(null);
    setLocal({ funil: funilId, etapa: etapaChave });
    iniciar(async () => {
      const r = await moverContatoDeEtapaAction(contatoId, funilId, etapaChave);
      if (!r.ok) {
        setErro(r.erro);
        setLocal({ funil: funilAtual, etapa: etapaAtual });
        return;
      }
      router.refresh();
    });
  }

  const classeSelect = compacto
    ? "w-full rounded-lg border border-border bg-surface-card px-2 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
    : "rounded-xl border border-border bg-surface-card px-3 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]";

  return (
    <div className={compacto ? "flex flex-col gap-1" : "flex flex-wrap items-center gap-2"}>
      {mostrarFunil && (
        <select
          aria-label="Funil de relacionamento"
          className={classeSelect}
          value={funilSelecionado?.id ?? ""}
          disabled={pendente || funis.length === 0}
          onChange={(e) => {
            const destino = funis.find((f) => f.id === e.target.value);
            if (destino && destino.etapas.length > 0) {
              mover(destino.id, destino.etapas[0].chave);
            }
          }}
        >
          {funis.map((f) => (
            <option key={f.id} value={f.id}>
              {f.emoji ? `${f.emoji} ` : ""}
              {f.nome}
            </option>
          ))}
        </select>
      )}
      <select
        aria-label="Etapa no funil"
        className={classeSelect}
        value={local.etapa ?? ""}
        disabled={pendente || !funilSelecionado}
        onChange={(e) => {
          if (funilSelecionado && e.target.value !== "") {
            mover(funilSelecionado.id, e.target.value);
          }
        }}
      >
        {local.etapa === null && <option value="">Sem etapa</option>}
        {(funilSelecionado?.etapas ?? []).map((et) => (
          <option key={et.chave} value={et.chave}>
            {et.nome}
          </option>
        ))}
      </select>
      {erro !== null && (
        <p role="alert" className="w-full text-xs font-medium text-red-700">
          {erro}
        </p>
      )}
    </div>
  );
}
