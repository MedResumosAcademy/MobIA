"use client";

// Coringa (client) — formulário do cenário + apresentação do baseline e das
// estratégias ranqueadas. A INTELIGÊNCIA vive no motor (@imobia/core); aqui só
// coletamos o cenário, chamamos a Server Action e renderizamos o resultado.

import type { Estrategia, ResultadoCoringa } from "@imobia/domain";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { Botao } from "@/components/ui/Botao";
import { classesCampo, CampoSelect, GrupoCampo } from "@/components/ui/Campo";
import {
  gerarEstrategiasAction,
  type EntradaCoringa,
  type ImovelParaCoringa,
  type RespostaCoringa,
} from "@/lib/dados/coringa";
import { ROTULO_MODALIDADE } from "./rotulos";

type Props = { imoveis: ImovelParaCoringa[] };

// —— Helpers de formatação (centavos → pt-BR) ————————————————————————————
function formatarReais(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatarPct(fracao: number): string {
  if (!Number.isFinite(fracao)) {
    return "—";
  }
  return `${(fracao * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function reaisParaNumero(texto: string): number {
  const t = texto.trim();
  if (t === "") {
    return 0;
  }
  // Aceita "1.280.000,00" ou "1280000.00" ou "1280000".
  const normalizado = t.replace(/\./g, "").replace(",", ".");
  const n = Number(normalizado);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function prazoLegivel(meses: number): string {
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  if (anos === 0) {
    return `${meses} meses`;
  }
  if (resto === 0) {
    return `${anos} anos`;
  }
  return `${anos} anos e ${resto} m`;
}

export function FormularioCoringa({ imoveis }: Props) {
  const [imovelId, setImovelId] = useState(imoveis[0]?.id ?? "");
  const [unidadeAtualId, setUnidadeAtualId] = useState("");
  const [rendaMensal, setRendaMensal] = useState("");
  const [rendaConjuge, setRendaConjuge] = useState("");
  const [fgts, setFgts] = useState("");
  const [entradaPropria, setEntradaPropria] = useState("");
  const [idadeAnos, setIdadeAnos] = useState("");

  const [resposta, setResposta] = useState<RespostaCoringa | null>(null);
  const [pendente, iniciar] = useTransition();

  const imovelSelecionado = imoveis.find((i) => i.id === imovelId);
  const temUnidades = (imovelSelecionado?.unidades.length ?? 0) > 0;

  function aoTrocarImovel(id: string) {
    setImovelId(id);
    setUnidadeAtualId("");
  }

  function aoEnviar(e: React.FormEvent) {
    e.preventDefault();
    if (!imovelId) {
      return;
    }
    const entrada: EntradaCoringa = {
      imovelId,
      unidadeAtualId: unidadeAtualId || undefined,
      rendaMensal: reaisParaNumero(rendaMensal),
      rendaConjuge: rendaConjuge.trim() ? reaisParaNumero(rendaConjuge) : undefined,
      fgts: reaisParaNumero(fgts),
      entradaPropria: reaisParaNumero(entradaPropria),
      idadeAnos: Number(idadeAnos.replace(",", ".")) || 0,
    };
    iniciar(async () => {
      const r = await gerarEstrategiasAction(entrada);
      setResposta(r);
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <form
        onSubmit={aoEnviar}
        className="rounded-2xl border border-border bg-surface-card p-6 shadow-[var(--shadow-soft)]"
      >
        <h2 className="text-lg font-semibold text-foreground">Cenário do cliente</h2>
        <p className="mt-1 text-sm text-muted">
          Informe a situação financeira e o imóvel-alvo. O Coringa calcula o
          enquadramento e sugere as melhores jogadas.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <GrupoCampo
            rotulo="Imóvel-alvo"
            htmlFor="imovel"
            obrigatorio
            className="sm:col-span-2"
          >
            <CampoSelect
              id="imovel"
              value={imovelId}
              onChange={(e) => aoTrocarImovel(e.target.value)}
              required
            >
              {imoveis.length === 0 && <option value="">Nenhum imóvel elegível</option>}
              {imoveis.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.titulo} — {formatarReais(i.valor)}
                </option>
              ))}
            </CampoSelect>
          </GrupoCampo>

          {temUnidades && (
            <GrupoCampo
              rotulo="Unidade atual (opcional)"
              htmlFor="unidade"
              auxilio="Habilita a jogada de trocar por uma unidade mais barata."
              className="sm:col-span-2"
            >
              <CampoSelect
                id="unidade"
                value={unidadeAtualId}
                onChange={(e) => setUnidadeAtualId(e.target.value)}
              >
                <option value="">Usar o valor do imóvel</option>
                {imovelSelecionado?.unidades.map((u) => (
                  <option key={u.id} value={u.id}>
                    Unidade {u.identificador} — {formatarReais(u.valor)}
                  </option>
                ))}
              </CampoSelect>
            </GrupoCampo>
          )}

          <GrupoCampo rotulo="Renda mensal (R$)" htmlFor="rendaMensal" obrigatorio>
            <input
              id="rendaMensal"
              inputMode="decimal"
              className={classesCampo()}
              placeholder="8.000,00"
              value={rendaMensal}
              onChange={(e) => setRendaMensal(e.target.value)}
              required
            />
          </GrupoCampo>

          <GrupoCampo rotulo="Renda do cônjuge (R$)" htmlFor="rendaConjuge">
            <input
              id="rendaConjuge"
              inputMode="decimal"
              className={classesCampo()}
              placeholder="opcional"
              value={rendaConjuge}
              onChange={(e) => setRendaConjuge(e.target.value)}
            />
          </GrupoCampo>

          <GrupoCampo rotulo="FGTS disponível (R$)" htmlFor="fgts">
            <input
              id="fgts"
              inputMode="decimal"
              className={classesCampo()}
              placeholder="0,00"
              value={fgts}
              onChange={(e) => setFgts(e.target.value)}
            />
          </GrupoCampo>

          <GrupoCampo rotulo="Entrada própria (R$)" htmlFor="entradaPropria">
            <input
              id="entradaPropria"
              inputMode="decimal"
              className={classesCampo()}
              placeholder="0,00"
              value={entradaPropria}
              onChange={(e) => setEntradaPropria(e.target.value)}
            />
          </GrupoCampo>

          <GrupoCampo rotulo="Idade (anos)" htmlFor="idade" obrigatorio>
            <input
              id="idade"
              inputMode="numeric"
              className={classesCampo()}
              placeholder="35"
              value={idadeAnos}
              onChange={(e) => setIdadeAnos(e.target.value)}
              required
            />
          </GrupoCampo>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Botao type="submit" disabled={pendente || imoveis.length === 0}>
            {pendente ? "Calculando…" : "Gerar estratégias"}
          </Botao>
          <span className="text-xs text-subtle">
            Resultados são estimativas, não proposta formal.
          </span>
        </div>
      </form>

      {resposta && !resposta.ok && (
        <p className="rounded-xl border border-brand/30 bg-brand-soft/40 px-4 py-3 text-sm text-brand-strong">
          {resposta.erro}
        </p>
      )}

      {resposta && resposta.ok && (
        <Resultado
          resultado={resposta.resultado}
          imovel={resposta.imovel}
        />
      )}
    </div>
  );
}

// —— Baseline + estratégias ————————————————————————————————————————————————
function Resultado({
  resultado,
  imovel,
}: {
  resultado: ResultadoCoringa;
  imovel: { titulo: string; valorAlvo: number };
}) {
  const { baseline, estrategias } = resultado;

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-border bg-surface-card p-6 shadow-[var(--shadow-soft)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">
              Cenário atual (baseline)
            </p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">
              {imovel.titulo}
            </h2>
            <p className="text-sm text-muted">
              Valor-alvo {formatarReais(imovel.valorAlvo)} ·{" "}
              {ROTULO_MODALIDADE[baseline.modalidade] ?? baseline.modalidade}
            </p>
          </div>
          {baseline.viavel ? (
            <Badge variante="mcmv">Viável</Badge>
          ) : (
            <Badge variante="destaque">Inviável hoje</Badge>
          )}
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Metrica rotulo="Parcela estimada" valor={formatarReais(baseline.parcelaEstimada)} destaque />
          <Metrica rotulo="Financiado" valor={formatarReais(baseline.valorFinanciado)} />
          <Metrica rotulo="Prazo" valor={prazoLegivel(baseline.prazoMeses)} />
          <Metrica
            rotulo="Comprometimento"
            valor={formatarPct(baseline.comprometimentoPct)}
          />
        </dl>
      </section>

      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Estratégias ({estrategias.length})
        </h2>
        <p className="mt-1 text-sm text-muted">
          Ranqueadas: primeiro as que viabilizam a compra, depois as de maior
          alívio na parcela e economia total.
        </p>

        {estrategias.length === 0 ? (
          <p className="mt-4 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">
            Nenhuma jogada melhora este cenário. {baseline.viavel
              ? "O cenário atual já está bem enquadrado."
              : "Reveja renda, entrada ou o imóvel-alvo."}
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            {estrategias.map((e, indice) => (
              <CardEstrategia key={e.id} estrategia={e} recomendada={indice === 0} />
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-subtle">
        Estimativas geradas pelo motor determinístico da ImobIA a partir dos
        parâmetros vigentes. Não constituem proposta formal nem garantia de
        aprovação de crédito.
      </p>
    </div>
  );
}

function Metrica({
  rotulo,
  valor,
  destaque = false,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-subtle">{rotulo}</dt>
      <dd
        className={`mt-0.5 font-semibold ${destaque ? "text-lg text-brand-strong" : "text-base text-foreground"}`}
      >
        {valor}
      </dd>
    </div>
  );
}

function CardEstrategia({
  estrategia,
  recomendada,
}: {
  estrategia: Estrategia;
  recomendada: boolean;
}) {
  const { impacto } = estrategia;
  const reduzParcela = impacto.deltaParcela < 0;
  const economia = -impacto.deltaTotal;

  return (
    <article
      className={`rounded-2xl border bg-surface-card p-5 shadow-[var(--shadow-soft)] transition-shadow ${
        recomendada
          ? "border-brand/50 ring-1 ring-brand/20"
          : "border-border"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold text-foreground">{estrategia.titulo}</h3>
        {estrategia.viabilizou && <Badge variante="mcmv">Viabiliza a compra</Badge>}
        {recomendada && <Badge variante="marca">Recomendada</Badge>}
      </div>

      <p className="mt-2 text-sm text-muted">{estrategia.descricao}</p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-surface px-3 py-2">
          <p className="text-xs text-subtle">Parcela</p>
          <p className="mt-0.5 text-sm font-medium text-foreground">
            {formatarReais(impacto.parcelaAntes)}{" "}
            <span className="text-subtle">→</span>{" "}
            <span className={reduzParcela ? "text-brand-strong" : "text-foreground"}>
              {formatarReais(impacto.parcelaDepois)}
            </span>
          </p>
          {impacto.deltaParcela !== 0 && (
            <p className={`text-xs ${reduzParcela ? "text-brand-strong" : "text-subtle"}`}>
              {reduzParcela ? "−" : "+"}
              {formatarReais(Math.abs(impacto.deltaParcela))}
            </p>
          )}
        </div>

        <div className="rounded-xl bg-surface px-3 py-2">
          <p className="text-xs text-subtle">Economia total</p>
          <p className="mt-0.5 text-sm font-medium text-foreground">
            {economia > 0 ? formatarReais(economia) : "—"}
          </p>
        </div>

        <div className="rounded-xl bg-surface px-3 py-2">
          <p className="text-xs text-subtle">Prazo</p>
          <p className="mt-0.5 text-sm font-medium text-foreground">
            {prazoLegivel(impacto.prazoDepois)}
          </p>
        </div>
      </div>
    </article>
  );
}
