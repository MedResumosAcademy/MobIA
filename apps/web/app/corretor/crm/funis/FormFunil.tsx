"use client";

// EDITOR DE FUNIL (client) — criar/editar funil de relacionamento: nome,
// emoji, descrição, dias para esfriar (🔥) e as ETAPAS (2..15) com renomear,
// recolorir, reordenar (▲▼), adicionar e remover. A CHAVE da etapa é imutável
// depois de criada (o banco referencia contatos por ela); etapas novas ganham
// chave derivada do nome. Remover etapa com contatos é bloqueado pela action
// com erro gentil (guarda no servidor).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { classesBotao } from "@/components/ui/Botao";
import { salvarFunilAction } from "@/lib/dados/funis";

type EtapaLocal = { chave: string; nome: string; cor: string };

type FunilInicial = {
  id?: string;
  nome: string;
  emoji: string;
  descricao: string;
  diasParaEsfriar: number;
  etapas: EtapaLocal[];
};

const COR_PADRAO = "#DB6414";

/** Slug curto e único para a chave de uma etapa nova. */
function chaveDoNome(nome: string, usadas: Set<string>): string {
  const base =
    nome
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 32) || "etapa";
  let chave = base;
  let n = 2;
  while (usadas.has(chave)) {
    chave = `${base}_${n}`;
    n += 1;
  }
  return chave;
}

export function FormFunil({ inicial }: { inicial: FunilInicial }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [nome, setNome] = useState(inicial.nome);
  const [emoji, setEmoji] = useState(inicial.emoji);
  const [descricao, setDescricao] = useState(inicial.descricao);
  const [dias, setDias] = useState(inicial.diasParaEsfriar);
  const [etapas, setEtapas] = useState<EtapaLocal[]>(inicial.etapas);

  function atualizarEtapa(i: number, patch: Partial<EtapaLocal>) {
    setEtapas((atual) => atual.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  }

  function moverEtapa(i: number, delta: -1 | 1) {
    setEtapas((atual) => {
      const destino = i + delta;
      if (destino < 0 || destino >= atual.length) {
        return atual;
      }
      const copia = [...atual];
      [copia[i], copia[destino]] = [copia[destino], copia[i]];
      return copia;
    });
  }

  function adicionarEtapa() {
    setEtapas((atual) => {
      if (atual.length >= 15) {
        return atual;
      }
      const usadas = new Set(atual.map((e) => e.chave));
      return [...atual, { chave: chaveDoNome("nova etapa", usadas), nome: "Nova etapa", cor: COR_PADRAO }];
    });
  }

  function salvar() {
    setErro(null);
    iniciar(async () => {
      const r = await salvarFunilAction({
        id: inicial.id,
        nome,
        emoji: emoji.trim() === "" ? undefined : emoji.trim(),
        descricao: descricao.trim() === "" ? undefined : descricao.trim(),
        diasParaEsfriar: dias,
        etapas: etapas.map((e) => ({
          chave: e.chave,
          nome: e.nome,
          cor: e.cor === "" ? undefined : e.cor,
        })),
      });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      router.push("/corretor/crm/funis");
      router.refresh();
    });
  }

  const classeCampo =
    "w-full rounded-xl border border-border bg-surface-card px-3 py-2 text-sm text-foreground placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]";

  return (
    <form
      className="mt-4 flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        salvar();
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[5rem_1fr_10rem]">
        <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
          Emoji
          <input
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            maxLength={8}
            placeholder="🤝"
            className={`${classeCampo} text-center`}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
          Nome do funil *
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            maxLength={80}
            placeholder="Ex.: Captação Instagram"
            className={classeCampo}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
          🔥 esfriar após (dias)
          <input
            type="number"
            min={1}
            max={365}
            value={dias}
            onChange={(e) => setDias(Math.max(1, Math.min(365, Number(e.target.value) || 1)))}
            className={classeCampo}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Descrição
        <input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          maxLength={500}
          placeholder="Para que serve este funil (opcional)"
          className={classeCampo}
        />
      </label>

      <fieldset className="rounded-2xl border border-border bg-surface p-3">
        <legend className="px-1 text-sm font-semibold text-foreground">
          Etapas (na ordem da jornada — a última é a final)
        </legend>
        <ol className="flex flex-col gap-2">
          {etapas.map((e, i) => (
            <li key={e.chave} className="flex items-center gap-2">
              <span className="w-6 text-center text-xs tabular-nums text-subtle">{i + 1}.</span>
              <input
                type="color"
                aria-label={`Cor da etapa ${e.nome}`}
                value={e.cor || COR_PADRAO}
                onChange={(ev) => atualizarEtapa(i, { cor: ev.target.value })}
                className="h-8 w-9 shrink-0 cursor-pointer rounded-lg border border-border bg-surface-card p-0.5"
              />
              <input
                aria-label={`Nome da etapa ${i + 1}`}
                value={e.nome}
                onChange={(ev) => atualizarEtapa(i, { nome: ev.target.value })}
                maxLength={60}
                required
                className={classeCampo}
              />
              <button
                type="button"
                aria-label={`Subir etapa ${e.nome}`}
                disabled={i === 0}
                onClick={() => moverEtapa(i, -1)}
                className="rounded-lg border border-border bg-surface-card p-1.5 text-muted transition-colors hover:text-foreground disabled:opacity-40"
              >
                <ArrowUp className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                aria-label={`Descer etapa ${e.nome}`}
                disabled={i === etapas.length - 1}
                onClick={() => moverEtapa(i, 1)}
                className="rounded-lg border border-border bg-surface-card p-1.5 text-muted transition-colors hover:text-foreground disabled:opacity-40"
              >
                <ArrowDown className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                aria-label={`Remover etapa ${e.nome}`}
                disabled={etapas.length <= 2}
                onClick={() => setEtapas((atual) => atual.filter((_, j) => j !== i))}
                className="rounded-lg border border-border bg-surface-card p-1.5 text-muted transition-colors hover:text-red-700 disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={adicionarEtapa}
          disabled={etapas.length >= 15}
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-dashed border-border-strong px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:border-brand/40 hover:text-foreground disabled:opacity-40"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Adicionar etapa
        </button>
        <p className="mt-2 text-xs text-subtle">
          Etapa com contatos não pode ser removida — mova os contatos antes. A última
          etapa é tratada como final (quem chega nela não acende 🔥).
        </p>
      </fieldset>

      {erro !== null && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          {erro}
        </p>
      )}

      <div className="flex items-center gap-2">
        <button type="submit" disabled={pendente} className={classesBotao("primario", "md")}>
          {pendente ? "Salvando…" : inicial.id ? "Salvar funil" : "Criar funil"}
        </button>
      </div>
    </form>
  );
}
