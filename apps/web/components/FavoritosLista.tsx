"use client";

// Grade dos favoritos com seleção para comparar (E6 / H-19 + ponte p/ H-20).
// Cliente: mantém o Set de ids marcados e monta o link /comparar?ids=a,b,c
// (2 a 3). A remoção é feita pelo próprio coração do card (atualizarAoAlternar),
// que recarrega a página server-side — aqui só gerimos a seleção de comparação.

import Link from "next/link";
import { useState } from "react";
import { CardImovel } from "@/components/card-imovel";
import type { CardImovel as DadosCardImovel } from "@/lib/dados/imoveis";

const MAX_COMPARAR = 3;
const MIN_COMPARAR = 2;

export function FavoritosLista({ imoveis }: { imoveis: DadosCardImovel[] }) {
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  function alternar(id: string) {
    setSelecionados((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) {
        proximo.delete(id);
      } else if (proximo.size < MAX_COMPARAR) {
        proximo.add(id);
      }
      return proximo;
    });
  }

  const quantidade = selecionados.size;
  const podeComparar = quantidade >= MIN_COMPARAR && quantidade <= MAX_COMPARAR;
  const idsQuery = [...selecionados].join(",");
  const atingiuMax = quantidade >= MAX_COMPARAR;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Selecione de {MIN_COMPARAR} a {MAX_COMPARAR} imóveis para comparar lado a
          lado.
          {quantidade > 0 && (
            <span className="ml-1 font-medium text-zinc-900 dark:text-zinc-100">
              {quantidade} selecionado{quantidade > 1 ? "s" : ""}.
            </span>
          )}
        </p>
        {podeComparar ? (
          <Link
            href={`/comparar?ids=${idsQuery}`}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Comparar selecionados
          </Link>
        ) : (
          <span
            className="cursor-not-allowed rounded-lg bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600"
            aria-disabled
          >
            Comparar selecionados
          </span>
        )}
      </div>

      <section
        aria-label="Imóveis favoritados"
        className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
      >
        {imoveis.map((imovel) => {
          const marcado = selecionados.has(imovel.id);
          const bloqueado = !marcado && atingiuMax;
          return (
            <div key={imovel.id} className="flex flex-col gap-2">
              <label
                className={`flex items-center gap-2 text-sm ${
                  bloqueado
                    ? "cursor-not-allowed text-zinc-400 dark:text-zinc-600"
                    : "cursor-pointer text-zinc-700 dark:text-zinc-300"
                }`}
              >
                <input
                  type="checkbox"
                  checked={marcado}
                  disabled={bloqueado}
                  onChange={() => alternar(imovel.id)}
                  className="h-4 w-4 rounded border-zinc-300 accent-zinc-900 dark:accent-zinc-100"
                />
                Comparar
              </label>
              <CardImovel imovel={imovel} favoritado aoAlternar />
            </div>
          );
        })}
      </section>
    </div>
  );
}
