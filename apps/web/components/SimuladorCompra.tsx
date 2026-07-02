// Simulador interativo "Compre do seu jeito" (E3/E4 — H-12/13/14/15).
// Client Component: recebe do Server Component tudo serializável (valores em
// centavos, esquema completo, opções de modalidade) e recalcula o plano EM
// TEMPO REAL no browser via @imobia/core (TS puro, síncrono, sem ida ao
// servidor). O usuário arrasta a barra de entrada / troca a modalidade e os
// números + a timeline (PlanoPagamentoVisual) reagem instantaneamente.
"use client";

import { formatarReais, recalcularPlano } from "@imobia/core";
import type { EsquemaPagamento, Modalidade, SistemaAmortizacao } from "@imobia/domain";
import { useEffect, useMemo, useRef, useState } from "react";
import { registrarSimulacaoAction } from "@/app/imoveis/[id]/acoes";
import { PlanoPagamentoVisual } from "@/components/PlanoPagamentoVisual";

export type OpcaoModalidade = {
  modalidade: Modalidade;
  rotulo: string;
  taxaAnual: number;
  prazoMeses: number;
  sistema: SistemaAmortizacao;
};

export type RotuloParametros = {
  vigenciaInicio: string;
  versao: number;
};

export type SimuladorCompraProps = {
  valorImovel: number;
  esquema: EsquemaPagamento;
  entradaMinima: number;
  entradaMaxima: number;
  opcoesModalidade: OpcaoModalidade[];
  rotuloParametros: RotuloParametros;
  imovelId: string;
};

// Passo da barra: R$ 1.000 (em centavos). Presets de atalho, em reais.
const PASSO_CENTAVOS = 1000_00;
const PRESETS_REAIS = [10_000, 20_000, 30_000, 50_000];

function clamp(valor: number, min: number, max: number): number {
  return Math.min(Math.max(valor, min), max);
}

/** Alinha a entrada ao passo, mantendo-a dentro de [min, max]. */
function alinharAoPasso(valor: number, min: number, max: number): number {
  const alinhado = min + Math.round((valor - min) / PASSO_CENTAVOS) * PASSO_CENTAVOS;
  return clamp(alinhado, min, max);
}

export function SimuladorCompra({
  valorImovel,
  esquema,
  entradaMinima,
  entradaMaxima,
  opcoesModalidade,
  rotuloParametros,
  imovelId,
}: SimuladorCompraProps) {
  const opcaoInicial = opcoesModalidade[0]!;
  const [entrada, setEntrada] = useState<number>(entradaMinima);
  const [modalidade, setModalidade] = useState<Modalidade>(opcaoInicial.modalidade);

  const opcaoSelecionada =
    opcoesModalidade.find((o) => o.modalidade === modalidade) ?? opcaoInicial;

  // RECÁLCULO EM TEMPO REAL: síncrono, trivial (< 200ms). Reexecuta a cada
  // mudança de entrada ou modalidade.
  const resultado = useMemo(
    () =>
      recalcularPlano({
        valorImovel,
        esquema,
        entradaEscolhida: entrada,
        financiamento: {
          taxaAnual: opcaoSelecionada.taxaAnual,
          prazoMeses: opcaoSelecionada.prazoMeses,
          sistema: opcaoSelecionada.sistema,
        },
      }),
    [valorImovel, esquema, entrada, opcaoSelecionada],
  );

  // EVENTO (E7): dispara ao ESTABILIZAR a barra (debounce ~500ms) ou trocar
  // modalidade. Fire-and-forget — não bloqueia a UI. O primeiro render
  // (estado inicial) NÃO dispara: só interações do usuário.
  const primeiraRenderizacao = useRef(true);
  useEffect(() => {
    if (primeiraRenderizacao.current) {
      primeiraRenderizacao.current = false;
      return;
    }
    const timer = setTimeout(() => {
      void registrarSimulacaoAction(imovelId, entrada, modalidade);
    }, 500);
    return () => clearTimeout(timer);
  }, [entrada, modalidade, imovelId]);

  const percentualEntrada = valorImovel > 0 ? (entrada / valorImovel) * 100 : 0;
  const faixaDisponivel = entradaMaxima > entradaMinima;

  return (
    <div className="mt-4 flex flex-col gap-6">
      <p className="text-sm text-muted">
        Ajuste a entrada e escolha a modalidade — os números recalculam na hora.
      </p>

      {/* H-13: abas de modalidade (só quando há mais de uma elegível). */}
      {opcoesModalidade.length > 1 && (
        <div
          role="tablist"
          aria-label="Modalidade de financiamento"
          className="flex flex-wrap gap-2"
        >
          {opcoesModalidade.map((o) => {
            const ativa = o.modalidade === modalidade;
            return (
              <button
                key={o.modalidade}
                type="button"
                role="tab"
                aria-selected={ativa}
                onClick={() => setModalidade(o.modalidade)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  ativa
                    ? "bg-brand text-brand-contrast"
                    : "bg-surface text-muted hover:bg-surface-strong"
                }`}
              >
                {o.rotulo}
              </button>
            );
          })}
        </div>
      )}

      {/* Barra de entrada + presets de atalho. */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <label
            htmlFor="entrada-slider"
            className="text-sm font-medium text-muted"
          >
            Entrada (ato)
          </label>
          <span className="text-right">
            <span className="font-serif text-xl font-semibold tabular-nums text-brand">
              {formatarReais(entrada)}
            </span>
            <span className="ml-2 text-xs tabular-nums text-subtle">
              {percentualEntrada.toFixed(1)}% do imóvel
            </span>
          </span>
        </div>

        <input
          id="entrada-slider"
          type="range"
          min={entradaMinima}
          max={faixaDisponivel ? entradaMaxima : entradaMinima}
          step={PASSO_CENTAVOS}
          value={entrada}
          disabled={!faixaDisponivel}
          onChange={(e) =>
            setEntrada(alinharAoPasso(Number(e.target.value), entradaMinima, entradaMaxima))
          }
          aria-label="Valor da entrada"
          aria-valuemin={entradaMinima}
          aria-valuemax={entradaMaxima}
          aria-valuenow={entrada}
          aria-valuetext={`${formatarReais(entrada)}, ${percentualEntrada.toFixed(1)} por cento do imóvel`}
          className="w-full accent-[var(--brand)] disabled:opacity-50"
        />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs tabular-nums text-subtle">
            mín. {formatarReais(entradaMinima)}
          </span>
          <span className="text-xs tabular-nums text-subtle">
            máx. {formatarReais(entradaMaxima)}
          </span>
        </div>

        {faixaDisponivel && (
          <div className="flex flex-wrap gap-2" aria-label="Atalhos de entrada">
            {PRESETS_REAIS.map((reais) => {
              const alvo = alinharAoPasso(
                entradaMinima + reais * 100,
                entradaMinima,
                entradaMaxima,
              );
              return (
                <button
                  key={reais}
                  type="button"
                  onClick={() => setEntrada(alvo)}
                  className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:border-brand hover:text-brand"
                >
                  mín. + R$ {reais.toLocaleString("pt-BR")}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setEntrada(entradaMaxima)}
              className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:border-brand hover:text-brand"
            >
              máx.
            </button>
          </div>
        )}
      </div>

      {/* Recálculo. Dentro da faixa nunca retorna erro — a mensagem é só um
          guarda amigável de defesa. */}
      {!resultado.ok ? (
        <p className="text-sm text-gold-strong">
          Não foi possível montar o plano com essa entrada. Ajuste a barra ou fale
          com o corretor.
        </p>
      ) : (
        <PlanoResultado
          plano={resultado.plano}
          numeroParcelas={esquema.numeroParcelasMensais}
        />
      )}

      {/* H-14: disclaimer de estimativa. */}
      <p className="text-xs leading-5 text-subtle">
        Estimativa (parâmetros {rotuloParametros.vigenciaInicio}, v
        {rotuloParametros.versao}) — não constitui proposta formal.
      </p>
    </div>
  );
}

function PlanoResultado({
  plano,
  numeroParcelas,
}: {
  plano: import("@imobia/domain").PlanoPagamentoRecalculado;
  numeroParcelas: number;
}) {
  const { financiamentoPosChaves } = plano;
  const primeiraParcela = plano.cronograma.find((i) => i.tipo === "parcela")?.valor ?? 0;

  const linhas: Array<{ rotulo: string; valor: string }> = [
    { rotulo: "Ato (entrada)", valor: formatarReais(plano.resumo.totalAto) },
    {
      rotulo: "Parcelas mensais até as chaves",
      valor:
        numeroParcelas > 0
          ? `${numeroParcelas}× de ${formatarReais(primeiraParcela)}`
          : "—",
    },
    { rotulo: "Financiado nas chaves", valor: formatarReais(plano.valorFinanciado) },
    {
      rotulo: `Parcela estimada pós-chaves (${financiamentoPosChaves.sistema.toUpperCase()}, ${financiamentoPosChaves.prazoMeses} meses)`,
      valor: formatarReais(financiamentoPosChaves.parcelaEstimada),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PlanoPagamentoVisual plano={plano} />

      <dl className="flex flex-col divide-y divide-border">
        {linhas.map((linha) => (
          <div
            key={linha.rotulo}
            className="flex items-baseline justify-between gap-4 py-3"
          >
            <dt className="text-sm text-subtle">{linha.rotulo}</dt>
            <dd className="text-base font-medium tabular-nums text-foreground">
              {linha.valor}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
