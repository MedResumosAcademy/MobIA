"use client";

import { CATEGORIAS_IMOVEL, TIPOS_IMOVEL } from "@mobia/domain";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

const ROTULOS_TIPO: Record<(typeof TIPOS_IMOVEL)[number], string> = {
  casa: "Casa",
  apartamento: "Apartamento",
  terreno: "Terreno",
};

const ROTULOS_CATEGORIA: Record<(typeof CATEGORIAS_IMOVEL)[number], string> = {
  lancamento: "Lançamento",
  alto_padrao: "Alto padrão",
  mcmv: "Minha Casa Minha Vida",
};

const CLASSE_CAMPO =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";

export function FiltrosCatalogo() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const atualizar = useCallback(
    (chave: string, valor: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (valor) {
        params.set(chave, valor);
      } else {
        params.delete(chave);
      }
      const consulta = params.toString();
      router.push(consulta ? `${pathname}?${consulta}` : pathname);
    },
    [pathname, router, searchParams],
  );

  const limpar = useCallback(() => {
    router.push(pathname);
  }, [pathname, router]);

  const temFiltros = Array.from(searchParams.keys()).length > 0;

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => e.preventDefault()}
    >
      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        Tipo
        <select
          className={CLASSE_CAMPO}
          value={searchParams.get("tipo") ?? ""}
          onChange={(e) => atualizar("tipo", e.target.value)}
        >
          <option value="">Todos</option>
          {TIPOS_IMOVEL.map((t) => (
            <option key={t} value={t}>
              {ROTULOS_TIPO[t]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        Categoria
        <select
          className={CLASSE_CAMPO}
          value={searchParams.get("categoria") ?? ""}
          onChange={(e) => atualizar("categoria", e.target.value)}
        >
          <option value="">Todas</option>
          {CATEGORIAS_IMOVEL.map((c) => (
            <option key={c} value={c}>
              {ROTULOS_CATEGORIA[c]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        Cidade
        <input
          type="text"
          className={CLASSE_CAMPO}
          placeholder="Buscar cidade"
          defaultValue={searchParams.get("cidade") ?? ""}
          onBlur={(e) => atualizar("cidade", e.target.value.trim())}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              atualizar("cidade", (e.target as HTMLInputElement).value.trim());
            }
          }}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        Preço mín. (R$)
        <input
          type="number"
          min="0"
          step="1000"
          className={`${CLASSE_CAMPO} w-32`}
          placeholder="0"
          defaultValue={searchParams.get("precoMin") ?? ""}
          onBlur={(e) => atualizar("precoMin", e.target.value.trim())}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        Preço máx. (R$)
        <input
          type="number"
          min="0"
          step="1000"
          className={`${CLASSE_CAMPO} w-32`}
          placeholder="Sem limite"
          defaultValue={searchParams.get("precoMax") ?? ""}
          onBlur={(e) => atualizar("precoMax", e.target.value.trim())}
        />
      </label>

      {temFiltros && (
        <button
          type="button"
          onClick={limpar}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          Limpar
        </button>
      )}
    </form>
  );
}
