// Formulário guiado do Sonhômetro (E5 — H-16/H-17). Client Component: coleta
// renda/FGTS/idade/estado civil/dependentes/cidade, valida em pt-BR, chama a
// Server Action `calcularESalvarCapacidade` (converte reais→centavos, persiste
// perfil/cookie/evento) e exibe o RESULTADO — "Você consegue comprar até R$ X",
// a melhor modalidade e o detalhamento por modalidade. Tudo é ESTIMATIVA.
"use client";

import type { ResultadoSonhometro } from "@mobia/core";
import { ESTADOS_CIVIS, type EstadoCivil } from "@mobia/domain";
import Link from "next/link";
import { useState, useTransition } from "react";
import { calcularESalvarCapacidade } from "@/lib/dados/sonhometro";
import { ResultadoSonhometroPainel } from "@/components/ResultadoSonhometro";

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

const CLASSE_CAMPO =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";

const CLASSE_LABEL =
  "flex flex-col gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300";

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
          className="self-start text-sm font-medium text-zinc-600 underline underline-offset-4 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          Refazer o cálculo
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-6" noValidate>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <label className={CLASSE_LABEL}>
          Renda mensal (R$)
          <input
            inputMode="decimal"
            className={CLASSE_CAMPO}
            placeholder="Ex.: 3.500"
            value={form.rendaMensal}
            onChange={(e) => set("rendaMensal", e.target.value)}
          />
          {erros.rendaMensal && <span className="text-xs text-red-600">{erros.rendaMensal}</span>}
        </label>

        <label className={CLASSE_LABEL}>
          Saldo de FGTS (R$)
          <input
            inputMode="decimal"
            className={CLASSE_CAMPO}
            placeholder="Ex.: 12.000"
            value={form.fgts}
            onChange={(e) => set("fgts", e.target.value)}
          />
          {erros.fgts && <span className="text-xs text-red-600">{erros.fgts}</span>}
        </label>

        <label className={CLASSE_LABEL}>
          Data de nascimento
          <input
            type="date"
            className={CLASSE_CAMPO}
            max={new Date().toISOString().slice(0, 10)}
            value={form.dataNascimento}
            onChange={(e) => set("dataNascimento", e.target.value)}
          />
          {erros.dataNascimento && (
            <span className="text-xs text-red-600">{erros.dataNascimento}</span>
          )}
        </label>

        <label className={CLASSE_LABEL}>
          Estado civil
          <select
            className={CLASSE_CAMPO}
            value={form.estadoCivil}
            onChange={(e) => set("estadoCivil", e.target.value as EstadoCivil)}
          >
            {ESTADOS_CIVIS.map((ec) => (
              <option key={ec} value={ec}>
                {ROTULO_ESTADO_CIVIL[ec]}
              </option>
            ))}
          </select>
        </label>

        <label className={CLASSE_LABEL}>
          Dependentes
          <input
            type="number"
            min="0"
            step="1"
            className={CLASSE_CAMPO}
            value={form.dependentes}
            onChange={(e) => set("dependentes", e.target.value)}
          />
          {erros.dependentes && <span className="text-xs text-red-600">{erros.dependentes}</span>}
        </label>

        <div className="grid grid-cols-[1fr_5rem] gap-3">
          <label className={CLASSE_LABEL}>
            Cidade
            <input
              type="text"
              className={CLASSE_CAMPO}
              placeholder="Ex.: Fortaleza"
              value={form.cidade}
              onChange={(e) => set("cidade", e.target.value)}
            />
            {erros.cidade && <span className="text-xs text-red-600">{erros.cidade}</span>}
          </label>
          <label className={CLASSE_LABEL}>
            UF
            <select
              className={CLASSE_CAMPO}
              value={form.uf}
              onChange={(e) => set("uf", e.target.value)}
            >
              <option value="">—</option>
              {UFS.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
            {erros.uf && <span className="text-xs text-red-600">{erros.uf}</span>}
          </label>
        </div>
      </div>

      <fieldset className="flex flex-col gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <legend className="px-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Composição de renda (opcional)
        </legend>
        <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
          O Minha Casa Minha Vida usa a renda <strong>familiar</strong> — some a renda de todos os
          moradores para o enquadramento correto de faixa e subsídio.
        </p>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <label className={CLASSE_LABEL}>
            Renda do cônjuge (R$)
            <input
              inputMode="decimal"
              className={CLASSE_CAMPO}
              placeholder="Opcional"
              value={form.rendaConjuge}
              onChange={(e) => set("rendaConjuge", e.target.value)}
            />
            {erros.rendaConjuge && (
              <span className="text-xs text-red-600">{erros.rendaConjuge}</span>
            )}
          </label>
          <label className={CLASSE_LABEL}>
            Renda de outros membros (R$)
            <input
              inputMode="decimal"
              className={CLASSE_CAMPO}
              placeholder="Opcional"
              value={form.rendaOutrosMembros}
              onChange={(e) => set("rendaOutrosMembros", e.target.value)}
            />
            {erros.rendaOutrosMembros && (
              <span className="text-xs text-red-600">{erros.rendaOutrosMembros}</span>
            )}
          </label>
        </div>
      </fieldset>

      {erroServidor && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">
          {erroServidor}
        </p>
      )}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pendente}
          className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pendente ? "Calculando…" : "Calcular meu limite"}
        </button>
        <Link
          href="/imoveis"
          className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          Ver catálogo
        </Link>
      </div>
    </form>
  );
}
