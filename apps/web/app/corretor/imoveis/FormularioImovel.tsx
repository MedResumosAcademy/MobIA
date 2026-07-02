"use client";

import { useState } from "react";
import type { ImovelDetalhe } from "@/lib/dados/imoveis";
import { CATEGORIAS, CONDICOES, MODALIDADES, TIPOS } from "./rotulos";

type BaloForm = {
  periodicidadeMeses: string;
  base: "valor" | "percentual";
  quantia: string;
};

type Props = {
  action: (formData: FormData) => void;
  imovel?: ImovelDetalhe;
};

const rotuloClasse =
  "flex flex-col gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300";
const inputClasse =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

function centavosParaReais(v: number): string {
  return (v / 100).toFixed(2).replace(".", ",");
}

function fracaoParaPercentual(f: number | undefined): string {
  return f === undefined ? "" : String(+(f * 100).toFixed(4));
}

export function FormularioImovel({ action, imovel }: Props) {
  const esquema = imovel?.esquemaPagamento ?? null;
  const [temEsquema, setTemEsquema] = useState(Boolean(esquema));
  const [modalidadeEsquema, setModalidadeEsquema] = useState(
    esquema?.modalidade ?? "mcmv",
  );
  const [percentualAto, setPercentualAto] = useState(
    esquema ? fracaoParaPercentual(esquema.percentualMinimoAto) : "5",
  );
  const [numParcelas, setNumParcelas] = useState(
    esquema ? String(esquema.numeroParcelasMensais) : "0",
  );
  const [parcelaBase, setParcelaBase] = useState<"valor" | "percentual">(
    esquema?.parcelaMensal?.valor !== undefined ? "valor" : "percentual",
  );
  const [parcelaQuantia, setParcelaQuantia] = useState(
    esquema?.parcelaMensal?.valor !== undefined
      ? centavosParaReais(esquema.parcelaMensal.valor)
      : esquema?.parcelaMensal?.percentual !== undefined
        ? fracaoParaPercentual(esquema.parcelaMensal.percentual)
        : "",
  );
  const [baloes, setBaloes] = useState<BaloForm[]>(
    esquema?.baloes.map((b) => ({
      periodicidadeMeses: String(b.periodicidadeMeses),
      base: b.valor !== undefined ? "valor" : "percentual",
      quantia:
        b.valor !== undefined
          ? centavosParaReais(b.valor)
          : fracaoParaPercentual(b.percentual),
    })) ?? [],
  );

  // URLs de mídia (compat com seed: colar URLs). Uploads vão pelos <input file>.
  const [fotosUrls, setFotosUrls] = useState<string[]>(
    imovel ? imovel.fotos.filter((u) => /^https?:/i.test(u)) : [],
  );
  const [plantasUrls, setPlantasUrls] = useState<string[]>(
    imovel ? imovel.plantas.filter((u) => /^https?:/i.test(u)) : [],
  );
  const [novaFotoUrl, setNovaFotoUrl] = useState("");
  const [novaPlantaUrl, setNovaPlantaUrl] = useState("");

  function esquemaJson(): string {
    if (!temEsquema) {
      return "";
    }
    const num = Number.parseInt(numParcelas, 10) || 0;
    const quantia = parcelaQuantia.trim();
    let parcelaMensal: Record<string, number> | undefined;
    if (num > 0 && quantia !== "") {
      const n = Number(quantia.replace(/\./g, "").replace(",", "."));
      parcelaMensal =
        parcelaBase === "valor"
          ? { valor: Math.round(n * 100) }
          : { percentual: n / 100 };
    }
    const baloesJson = baloes
      .filter((b) => b.periodicidadeMeses.trim() !== "" && b.quantia.trim() !== "")
      .map((b) => {
        const n = Number(b.quantia.replace(/\./g, "").replace(",", "."));
        return b.base === "valor"
          ? {
              periodicidadeMeses: Number.parseInt(b.periodicidadeMeses, 10),
              valor: Math.round(n * 100),
            }
          : {
              periodicidadeMeses: Number.parseInt(b.periodicidadeMeses, 10),
              percentual: n / 100,
            };
      });
    const objeto: Record<string, unknown> = {
      modalidade: modalidadeEsquema,
      percentualMinimoAto: (Number(percentualAto.replace(",", ".")) || 0) / 100,
      numeroParcelasMensais: num,
      baloes: baloesJson,
    };
    if (parcelaMensal) {
      objeto.parcelaMensal = parcelaMensal;
    }
    return JSON.stringify(objeto);
  }

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="esquemaPagamento" value={esquemaJson()} />
      <input type="hidden" name="fotosUrls" value={JSON.stringify(fotosUrls)} />
      <input type="hidden" name="plantasUrls" value={JSON.stringify(plantasUrls)} />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className={rotuloClasse}>
          Tipo
          <select name="tipo" defaultValue={imovel?.tipo ?? ""} className={inputClasse}>
            <option value="">— selecione —</option>
            {TIPOS.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.rotulo}
              </option>
            ))}
          </select>
        </label>
        <label className={rotuloClasse}>
          Condição
          <select
            name="condicao"
            defaultValue={imovel?.condicao ?? ""}
            className={inputClasse}
          >
            <option value="">— selecione —</option>
            {CONDICOES.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.rotulo}
              </option>
            ))}
          </select>
        </label>
        <label className={rotuloClasse}>
          Cidade
          <input
            name="cidade"
            required
            defaultValue={imovel?.cidade ?? ""}
            className={inputClasse}
          />
        </label>
        <label className={rotuloClasse}>
          UF
          <input
            name="uf"
            required
            maxLength={2}
            defaultValue={imovel?.uf ?? ""}
            className={`${inputClasse} uppercase`}
          />
        </label>
        <label className={`${rotuloClasse} sm:col-span-2`}>
          Endereço
          <input
            name="endereco"
            defaultValue={imovel?.endereco ?? ""}
            className={inputClasse}
          />
        </label>
        <label className={rotuloClasse}>
          Valor (R$)
          <input
            name="valor"
            required
            inputMode="decimal"
            placeholder="1280000,00"
            defaultValue={imovel ? centavosParaReais(imovel.valor) : ""}
            className={inputClasse}
          />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className={rotuloClasse}>
            Lat
            <input
              name="lat"
              inputMode="decimal"
              defaultValue={imovel?.lat != null ? String(imovel.lat) : ""}
              className={inputClasse}
            />
          </label>
          <label className={rotuloClasse}>
            Lng
            <input
              name="lng"
              inputMode="decimal"
              defaultValue={imovel?.lng != null ? String(imovel.lng) : ""}
              className={inputClasse}
            />
          </label>
        </div>
        <label className={`${rotuloClasse} sm:col-span-2`}>
          Descrição
          <textarea
            name="descricao"
            rows={3}
            defaultValue={imovel?.descricao ?? ""}
            className={inputClasse}
          />
        </label>
      </section>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Categorias
        </legend>
        <div className="flex flex-wrap gap-3">
          {CATEGORIAS.map((c) => (
            <label key={c.valor} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                name="categorias"
                value={c.valor}
                defaultChecked={imovel?.categorias.includes(c.valor) ?? false}
              />
              {c.rotulo}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Modalidades elegíveis
        </legend>
        <div className="flex flex-wrap gap-3">
          {MODALIDADES.map((m) => (
            <label key={m.valor} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                name="modalidadesElegiveis"
                value={m.valor}
                defaultChecked={imovel?.modalidadesElegiveis.includes(m.valor) ?? false}
              />
              {m.rotulo}
            </label>
          ))}
        </div>
      </fieldset>

      <ListaUrls
        titulo="Fotos (URLs)"
        urls={fotosUrls}
        onAdicionar={(u) => setFotosUrls([...fotosUrls, u])}
        onRemover={(i) => setFotosUrls(fotosUrls.filter((_, j) => j !== i))}
        valorNovo={novaFotoUrl}
        setValorNovo={setNovaFotoUrl}
        inputName="fotosArquivos"
      />
      <ListaUrls
        titulo="Plantas (URLs)"
        urls={plantasUrls}
        onAdicionar={(u) => setPlantasUrls([...plantasUrls, u])}
        onRemover={(i) => setPlantasUrls(plantasUrls.filter((_, j) => j !== i))}
        valorNovo={novaPlantaUrl}
        setValorNovo={setNovaPlantaUrl}
        inputName="plantasArquivos"
      />

      <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={temEsquema}
            onChange={(e) => setTemEsquema(e.target.checked)}
          />
          Esquema de pagamento (imóvel na planta)
        </label>
        {temEsquema && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className={rotuloClasse}>
                Modalidade padrão
                <select
                  value={modalidadeEsquema}
                  onChange={(e) => setModalidadeEsquema(e.target.value as typeof modalidadeEsquema)}
                  className={inputClasse}
                >
                  {MODALIDADES.map((m) => (
                    <option key={m.valor} value={m.valor}>
                      {m.rotulo}
                    </option>
                  ))}
                </select>
              </label>
              <label className={rotuloClasse}>
                Ato mín. (%)
                <input
                  inputMode="decimal"
                  value={percentualAto}
                  onChange={(e) => setPercentualAto(e.target.value)}
                  className={inputClasse}
                />
              </label>
              <label className={rotuloClasse}>
                Nº parcelas mensais
                <input
                  inputMode="numeric"
                  value={numParcelas}
                  onChange={(e) => setNumParcelas(e.target.value)}
                  className={inputClasse}
                />
              </label>
            </div>
            {(Number.parseInt(numParcelas, 10) || 0) > 0 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className={rotuloClasse}>
                  Base da parcela
                  <select
                    value={parcelaBase}
                    onChange={(e) => setParcelaBase(e.target.value as "valor" | "percentual")}
                    className={inputClasse}
                  >
                    <option value="valor">Valor fixo (R$)</option>
                    <option value="percentual">Percentual do imóvel (%)</option>
                  </select>
                </label>
                <label className={rotuloClasse}>
                  {parcelaBase === "valor" ? "Valor da parcela (R$)" : "Percentual (%)"}
                  <input
                    inputMode="decimal"
                    value={parcelaQuantia}
                    onChange={(e) => setParcelaQuantia(e.target.value)}
                    className={inputClasse}
                  />
                </label>
              </div>
            )}
            <div className="flex flex-col gap-3">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Balões (reforços)
              </span>
              {baloes.map((b, i) => (
                <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                  <input
                    inputMode="numeric"
                    placeholder="Periodicidade (meses)"
                    value={b.periodicidadeMeses}
                    onChange={(e) =>
                      setBaloes(
                        baloes.map((x, j) =>
                          j === i ? { ...x, periodicidadeMeses: e.target.value } : x,
                        ),
                      )
                    }
                    className={inputClasse}
                  />
                  <select
                    value={b.base}
                    onChange={(e) =>
                      setBaloes(
                        baloes.map((x, j) =>
                          j === i ? { ...x, base: e.target.value as "valor" | "percentual" } : x,
                        ),
                      )
                    }
                    className={inputClasse}
                  >
                    <option value="valor">Valor (R$)</option>
                    <option value="percentual">Percentual (%)</option>
                  </select>
                  <input
                    inputMode="decimal"
                    placeholder={b.base === "valor" ? "R$" : "%"}
                    value={b.quantia}
                    onChange={(e) =>
                      setBaloes(
                        baloes.map((x, j) => (j === i ? { ...x, quantia: e.target.value } : x)),
                      )
                    }
                    className={inputClasse}
                  />
                  <button
                    type="button"
                    onClick={() => setBaloes(baloes.filter((_, j) => j !== i))}
                    className="rounded-lg border border-zinc-300 px-3 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
                  >
                    Remover
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setBaloes([...baloes, { periodicidadeMeses: "12", base: "percentual", quantia: "" }])
                }
                className="self-start rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
              >
                + Adicionar balão
              </button>
            </div>
          </div>
        )}
      </section>

      <button
        type="submit"
        className="self-start rounded-lg bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
      >
        Salvar imóvel
      </button>
    </form>
  );
}

function ListaUrls({
  titulo,
  urls,
  onAdicionar,
  onRemover,
  valorNovo,
  setValorNovo,
  inputName,
}: {
  titulo: string;
  urls: string[];
  onAdicionar: (u: string) => void;
  onRemover: (i: number) => void;
  valorNovo: string;
  setValorNovo: (v: string) => void;
  inputName: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{titulo}</legend>
      {urls.length > 0 && (
        <ul className="flex flex-col gap-1">
          {urls.map((u, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <span className="truncate">{u}</span>
              <button
                type="button"
                onClick={() => onRemover(i)}
                className="text-red-600 dark:text-red-400"
              >
                remover
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          value={valorNovo}
          onChange={(e) => setValorNovo(e.target.value)}
          placeholder="https://..."
          className={`${inputClasse} flex-1`}
        />
        <button
          type="button"
          onClick={() => {
            const u = valorNovo.trim();
            if (/^https?:\/\//i.test(u)) {
              onAdicionar(u);
              setValorNovo("");
            }
          }}
          className="rounded-lg border border-zinc-300 px-3 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
        >
          Adicionar
        </button>
      </div>
      <label className="text-sm text-zinc-600 dark:text-zinc-400">
        ou enviar arquivos
        <input
          type="file"
          name={inputName}
          multiple
          accept="image/*"
          className="mt-1 block w-full text-sm text-zinc-600 dark:text-zinc-400"
        />
      </label>
    </fieldset>
  );
}
