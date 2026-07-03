"use client";

// BOARD (Kanban) do funil — colunas por etapa aberta, cards de negócio.
// Interatividade:
//   - ARRASTAR-E-SOLTAR nativo (HTML5): draggable + onDragStart/Over/Drop.
//     Soltar um card numa coluna chama moverEtapaCliente e revalida via
//     router.refresh() (atualização otimista do card enquanto pendente).
//   - FALLBACK ACESSÍVEL: cada card tem um <select> de etapa (teclado/mobile).
// A RLS/escopo/registro de atividade ficam no servidor (moverEtapaCliente).
// Card leva ao detalhe via <Link>; o handle de arraste não navega.

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatarReais } from "@imobia/core";
import type { EtapaNegocio } from "@imobia/domain";
import type { NegocioResumo } from "@/lib/dados/negocios";
import { CampoSelect } from "@/components/ui/Campo";
import { ChipTermometro } from "../leads/termometro";
import { moverEtapaCliente } from "./acoes";
import { SeloAtencao } from "./atencao";
import { ETAPAS_ORDEM, ROTULO_ETAPA } from "./rotulos";

function somaValores(negocios: NegocioResumo[]): number {
  return negocios.reduce((total, n) => total + (n.valor ?? 0), 0);
}

export function KanbanNegocios({
  negocios,
  mostrarResponsavel,
  nomePorResponsavel,
}: {
  negocios: NegocioResumo[];
  /** Gestor: exibe o nome do responsável no card. */
  mostrarResponsavel: boolean;
  nomePorResponsavel: Record<string, string | null>;
}) {
  const router = useRouter();
  const [, iniciar] = useTransition();
  // Pendência POR CARD (a11y): mover um card não trava o board inteiro.
  const [pendentes, setPendentes] = useState<Set<string>>(new Set());
  // Sobreposição otimista: id -> etapa destino enquanto a ação está no ar.
  const [otimista, setOtimista] = useState<Record<string, EtapaNegocio>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [colunaAlvo, setColunaAlvo] = useState<EtapaNegocio | null>(null);
  const arrastandoId = useRef<string | null>(null);

  function etapaEfetiva(n: NegocioResumo): EtapaNegocio {
    return otimista[n.id] ?? n.etapa;
  }

  function mover(id: string, destino: EtapaNegocio, atual: EtapaNegocio) {
    if (destino === atual) {
      return;
    }
    setErro(null);
    setOtimista((o) => ({ ...o, [id]: destino }));
    setPendentes((p) => new Set(p).add(id));
    iniciar(async () => {
      const r = await moverEtapaCliente(id, destino);
      if (r.ok) {
        router.refresh();
      } else {
        setErro(r.erro);
        // Desfaz o otimismo em caso de falha.
        setOtimista((o) => {
          const { [id]: _, ...resto } = o;
          return resto;
        });
      }
      setPendentes((p) => {
        const proximo = new Set(p);
        proximo.delete(id);
        return proximo;
      });
    });
  }

  const porEtapa = ETAPAS_ORDEM.map((etapa) => ({
    etapa,
    itens: negocios.filter((n) => etapaEfetiva(n) === etapa),
  }));

  return (
    <div>
      {erro && (
        <p role="alert" className="mt-4 text-sm text-brand-strong">
          {erro}
        </p>
      )}
      <div className="mt-6 flex gap-4 overflow-x-auto pb-4">
        {porEtapa.map(({ etapa, itens }) => (
          <section
            key={etapa}
            onDragOver={(e) => {
              e.preventDefault();
              setColunaAlvo(etapa);
            }}
            onDragLeave={() => setColunaAlvo((a) => (a === etapa ? null : a))}
            onDrop={(e) => {
              e.preventDefault();
              setColunaAlvo(null);
              const id = arrastandoId.current;
              arrastandoId.current = null;
              if (!id) {
                return;
              }
              const alvo = negocios.find((n) => n.id === id);
              if (alvo) {
                mover(id, etapa, etapaEfetiva(alvo));
              }
            }}
            className={`flex w-72 shrink-0 flex-col rounded-2xl border bg-surface p-3 transition-colors ${
              colunaAlvo === etapa
                ? "border-brand bg-brand-soft/40"
                : "border-border"
            }`}
          >
            <header className="flex items-baseline justify-between gap-2 px-1 pb-3">
              <h2 className="text-sm font-semibold text-foreground">
                {ROTULO_ETAPA[etapa]}
              </h2>
              <span className="text-xs text-subtle tabular-nums">
                {itens.length} · {formatarReais(somaValores(itens))}
              </span>
            </header>
            <div className="flex flex-col gap-2.5">
              {itens.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-subtle">
                  Sem negócios
                </p>
              ) : (
                itens.map((n) => (
                  <CartaoNegocio
                    key={n.id}
                    negocio={n}
                    etapaEfetiva={etapaEfetiva(n)}
                    pendente={pendentes.has(n.id)}
                    mostrarResponsavel={mostrarResponsavel}
                    nomeResponsavel={nomePorResponsavel[n.corretorId] ?? null}
                    aoIniciarArraste={() => {
                      arrastandoId.current = n.id;
                    }}
                    aoMover={(destino) => mover(n.id, destino, etapaEfetiva(n))}
                  />
                ))
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function CartaoNegocio({
  negocio,
  etapaEfetiva,
  pendente,
  mostrarResponsavel,
  nomeResponsavel,
  aoIniciarArraste,
  aoMover,
}: {
  negocio: NegocioResumo;
  etapaEfetiva: EtapaNegocio;
  pendente: boolean;
  mostrarResponsavel: boolean;
  nomeResponsavel: string | null;
  aoIniciarArraste: () => void;
  aoMover: (destino: EtapaNegocio) => void;
}) {
  // Valor local do <select> com commit em debounce (a11y): atravessar as
  // opções por seta no teclado não comita cada etapa intermediária, e o
  // campo não fica disabled sob o foco durante a ação (evita perder o foco).
  const [etapaLocal, setEtapaLocal] = useState<EtapaNegocio | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Quando a etapa efetiva muda (otimismo/servidor), o valor local se dissolve.
  useEffect(() => {
    setEtapaLocal(null);
  }, [etapaEfetiva]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function aoTrocarEtapa(destino: EtapaNegocio) {
    if (pendente) return; // ignora enquanto ESTE card está no ar (sem disabled)
    setEtapaLocal(destino);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      aoMover(destino);
    }, 300);
  }

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", negocio.id);
        aoIniciarArraste();
      }}
      className="group flex cursor-grab flex-col gap-2 rounded-xl border border-border bg-surface-card p-3 shadow-[var(--shadow-soft)] transition-[border-color,box-shadow,opacity] hover:border-brand/40 hover:shadow-[var(--shadow-card)] active:cursor-grabbing aria-busy:opacity-60"
      aria-busy={pendente || undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/corretor/negocios/${negocio.id}`}
          className="min-w-0 truncate font-semibold text-foreground hover:text-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          {negocio.nomeContato}
        </Link>
        {negocio.temperatura && (
          <ChipTermometro temperatura={negocio.temperatura} />
        )}
      </div>
      {negocio.imovelTitulo && (
        <p className="truncate text-xs text-muted">{negocio.imovelTitulo}</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {negocio.valor !== null && (
          <p className="text-sm font-semibold tabular-nums text-foreground">
            {formatarReais(negocio.valor)}
          </p>
        )}
        <SeloAtencao atencao={negocio.atencao} dias={negocio.diasSemMovimento} />
      </div>
      {mostrarResponsavel && nomeResponsavel && (
        <p className="truncate text-xs text-subtle">{nomeResponsavel}</p>
      )}
      {/* Fallback acessível (teclado/mobile): move a etapa via <select>. */}
      <label className="mt-0.5 flex items-center gap-1.5 text-[11px] text-subtle">
        <span className="sr-only">Mover {negocio.nomeContato} para etapa</span>
        <CampoSelect
          value={etapaLocal ?? etapaEfetiva}
          aria-busy={pendente || undefined}
          onChange={(e) => aoTrocarEtapa(e.target.value as EtapaNegocio)}
          className="w-auto py-1 text-xs"
          aria-label={`Etapa de ${negocio.nomeContato}`}
        >
          {ETAPAS_ORDEM.map((et) => (
            <option key={et} value={et}>
              {ROTULO_ETAPA[et]}
            </option>
          ))}
        </CampoSelect>
      </label>
    </div>
  );
}
