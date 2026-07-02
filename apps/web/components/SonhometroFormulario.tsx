// Formulário guiado do Sonhômetro (E5 — H-16/H-17). Client Component: coleta
// renda/FGTS/idade/estado civil/dependentes/cidade, valida em pt-BR, chama a
// Server Action `calcularESalvarCapacidade` (converte reais→centavos, persiste
// perfil/cookie/evento) e exibe o RESULTADO — "Você consegue comprar até R$ X",
// a melhor modalidade e o detalhamento por modalidade. Tudo é ESTIMATIVA.
"use client";

import type { ResultadoSonhometro } from "@imobia/core";
import { ESTADOS_CIVIS, type EstadoCivil } from "@imobia/domain";
import Link from "next/link";
import { useState, useTransition } from "react";
import { calcularESalvarCapacidade } from "@/lib/dados/sonhometro";
import { ResultadoSonhometroPainel } from "@/components/ResultadoSonhometro";
import { Campo, CampoSelect } from "@/components/ui/Campo";
import { Botao, classesBotao } from "@/components/ui/Botao";

// Unidades federativas (siglas) — a UF alimenta os tetos por estado do motor.
const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
] as const;

const ROTULO_ESTADO_CIVIL: Record<EstadoCivil, string> = {
  solteiro: "Solteiro(a)",
  casado: "Casado(a)",
  uniao_estavel: "União estável",
  divorciado: "Divorciado(a)",
  viuvo: "Viúvo(a)",
};

const CLASSE_LABEL = "flex flex-col gap-1.5 text-sm font-medium text-foreground";

const CLASSE_ERRO = "text-xs text-brand-strong";

// Estado bruto do formulário — tudo string (inputs). Convertemos na submissão.
type EstadoForm = {
  rendaMensal: string;
  fgts: string;
  dataNascimento: string;
  estadoCivil: EstadoCivil;
  dependentes: string;
  cidade: string;
  uf: string;
  rendaConjuge: string;
  rendaOutrosMembros: string;
};

const INICIAL: EstadoForm = {
  rendaMensal: "",
  fgts: "",
  dataNascimento: "",
  estadoCivil: "solteiro",
  dependentes: "0",
  cidade: "",
  uf: "",
  rendaConjuge: "",
  rendaOutrosMembros: "",
};

/** Reais em string (aceita "1.234,56" ou "1234.56") → número em reais, ou null. */
function reais(valor: string): number | null {
  const limpo = valor.trim().replace(/\./g, "").replace(",", ".");
  if (limpo === "") return null;
  const n = Number(limpo);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

type Erros = Partial<Record<keyof EstadoForm, string>>;

function validar(form: EstadoForm): Erros {
  const erros: Erros = {};
  if (reais(form.rendaMensal) === null || reais(form.rendaMensal) === 0) {
    erros.rendaMensal = "Informe sua renda mensal.";
  }
  if (reais(form.fgts) === null) {
    erros.fgts = "Informe o saldo de FGTS (0 se não tiver).";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.dataNascimento)) {
    erros.dataNascimento = "Informe sua data de nascimento.";
  } else if (form.dataNascimento > new Date().toISOString().slice(0, 10)) {
    erros.dataNascimento = "A data não pode estar no futuro.";
  }
  const dep = Number(form.dependentes);
  if (!Number.isInteger(dep) || dep < 0) {
    erros.dependentes = "Número de dependentes inválido.";
  }
  if (form.cidade.trim() === "") {
    erros.cidade = "Informe a cidade.";
  }
  if (form.uf === "") {
    erros.uf = "Selecione o estado (UF).";
  }
  if (form.rendaConjuge.trim() !== "" && reais(form.rendaConjuge) === null) {
    erros.rendaConjuge = "Valor inválido.";
  }
  if (form.rendaOutrosMembros.trim() !== "" && reais(form.rendaOutrosMembros) === null) {
    erros.rendaOutrosMembros = "Valor inválido.";
  }
  return erros;
}

export function SonhometroFormulario() {
  const [form, setForm] = useState<EstadoForm>(INICIAL);
  const [erros, setErros] = useState<Erros>({});
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoSonhometro | null>(null);
  const [pendente, iniciar] = useTransition();

  function set<K extends keyof EstadoForm>(chave: K, valor: EstadoForm[K]) {
    setForm((f) => ({ ...f, [chave]: valor }));
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErroServidor(null);
    const novosErros = validar(form);
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) {
      return;
    }
    const conjuge = reais(form.rendaConjuge);
    const outros = reais(form.rendaOutrosMembros);
    iniciar(async () => {
      try {
        const res = await calcularESalvarCapacidade({
          rendaMensalReais: reais(form.rendaMensal) ?? 0,
          fgtsReais: reais(form.fgts) ?? 0,
          dataNascimento: form.dataNascimento,
          estadoCivil: form.estadoCivil,
          dependentes: Number(form.dependentes),
          cidade: form.cidade.trim(),
          uf: form.uf,
          rendaConjugeReais: conjuge !== null && conjuge > 0 ? conjuge : undefined,
          rendaOutrosMembrosReais: outros !== null && outros > 0 ? outros : undefined,
        });
        setResultado(res);
      } catch {
        setErroServidor(
          "Não foi possível calcular agora. Confira os dados e tente novamente.",
        );
      }
    });
  }

  if (resultado) {
    return (
      <div className="flex flex-col gap-6">
        <ResultadoSonhometroPainel resultado={resultado} />
        <button
          type="button"
          onClick={() => setResultado(null)}
          className="self-start text-sm font-medium text-muted underline underline-offset-4 transition-colors hover:text-foreground"
        >
          Refazer o cálculo
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-8" noValidate>
      <fieldset className="flex flex-col gap-5">
        <legend className="mb-1 flex items-center gap-2.5 text-sm font-semibold text-foreground">
          <PassoBolha n={1} />
          Sua renda e reservas
        </legend>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <label className={CLASSE_LABEL}>
            Renda mensal (R$)
            <Campo
              inputMode="decimal"
              placeholder="Ex.: 3.500"
              value={form.rendaMensal}
              onChange={(e) => set("rendaMensal", e.target.value)}
            />
            {erros.rendaMensal && <span className={CLASSE_ERRO}>{erros.rendaMensal}</span>}
          </label>

          <label className={CLASSE_LABEL}>
            Saldo de FGTS (R$)
            <Campo
              inputMode="decimal"
              placeholder="Ex.: 12.000"
              value={form.fgts}
              onChange={(e) => set("fgts", e.target.value)}
            />
            {erros.fgts && <span className={CLASSE_ERRO}>{erros.fgts}</span>}
          </label>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-5">
        <legend className="mb-1 flex items-center gap-2.5 text-sm font-semibold text-foreground">
          <PassoBolha n={2} />
          Seu perfil
        </legend>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <label className={CLASSE_LABEL}>
            Data de nascimento
            <Campo
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              value={form.dataNascimento}
              onChange={(e) => set("dataNascimento", e.target.value)}
            />
            {erros.dataNascimento && <span className={CLASSE_ERRO}>{erros.dataNascimento}</span>}
          </label>

          <label className={CLASSE_LABEL}>
            Estado civil
            <CampoSelect
              value={form.estadoCivil}
              onChange={(e) => set("estadoCivil", e.target.value as EstadoCivil)}
            >
              {ESTADOS_CIVIS.map((ec) => (
                <option key={ec} value={ec}>
                  {ROTULO_ESTADO_CIVIL[ec]}
                </option>
              ))}
            </CampoSelect>
          </label>

          <label className={CLASSE_LABEL}>
            Dependentes
            <Campo
              type="number"
              min="0"
              step="1"
              value={form.dependentes}
              onChange={(e) => set("dependentes", e.target.value)}
            />
            {erros.dependentes && <span className={CLASSE_ERRO}>{erros.dependentes}</span>}
          </label>

          <div className="grid grid-cols-[1fr_5rem] gap-3">
            <label className={CLASSE_LABEL}>
              Cidade
              <Campo
                type="text"
                placeholder="Ex.: Fortaleza"
                value={form.cidade}
                onChange={(e) => set("cidade", e.target.value)}
              />
              {erros.cidade && <span className={CLASSE_ERRO}>{erros.cidade}</span>}
            </label>
            <label className={CLASSE_LABEL}>
              UF
              <CampoSelect value={form.uf} onChange={(e) => set("uf", e.target.value)}>
                <option value="">—</option>
                {UFS.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </CampoSelect>
              {erros.uf && <span className={CLASSE_ERRO}>{erros.uf}</span>}
            </label>
          </div>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
        <legend className="flex items-center gap-2.5 px-1 text-sm font-semibold text-foreground">
          <PassoBolha n={3} />
          Composição de renda
          <span className="font-normal text-subtle">(opcional)</span>
        </legend>
        <p className="text-xs leading-5 text-muted">
          O Minha Casa Minha Vida usa a renda <strong className="text-foreground">familiar</strong> —
          some a renda de todos os moradores para o enquadramento correto de faixa e subsídio.
        </p>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <label className={CLASSE_LABEL}>
            Renda do cônjuge (R$)
            <Campo
              inputMode="decimal"
              placeholder="Opcional"
              value={form.rendaConjuge}
              onChange={(e) => set("rendaConjuge", e.target.value)}
            />
            {erros.rendaConjuge && <span className={CLASSE_ERRO}>{erros.rendaConjuge}</span>}
          </label>
          <label className={CLASSE_LABEL}>
            Renda de outros membros (R$)
            <Campo
              inputMode="decimal"
              placeholder="Opcional"
              value={form.rendaOutrosMembros}
              onChange={(e) => set("rendaOutrosMembros", e.target.value)}
            />
            {erros.rendaOutrosMembros && (
              <span className={CLASSE_ERRO}>{erros.rendaOutrosMembros}</span>
            )}
          </label>
        </div>
      </fieldset>

      {erroServidor && (
        <p className="rounded-xl border border-brand/20 bg-brand-soft px-4 py-3 text-sm text-brand-strong">
          {erroServidor}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <Botao type="submit" tamanho="lg" disabled={pendente}>
          {pendente ? "Calculando…" : "Calcular meu limite"}
        </Botao>
        <Link href="/imoveis" className={classesBotao("fantasma", "lg")}>
          Ver catálogo
        </Link>
      </div>
    </form>
  );
}

/** Bolha numerada âmbar que marca cada passo do formulário. */
function PassoBolha({ n }: { n: number }) {
  return (
    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-soft text-xs font-bold text-gold-strong">
      {n}
    </span>
  );
}
