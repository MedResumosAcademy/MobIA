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

const OPCOES_QUARTOS = [1, 2, 3, 4];

const CLASSE_ROTULO =
  "flex flex-col gap-1 text-xs font-medium text-muted";

const CLASSE_CAMPO =
  "rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-brand";

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

  const temFiltros = Array.from(searchParams.keys()).some((k) => k !== "todos");

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => e.preventDefault()}
    >
      <label className={CLASSE_ROTULO}>
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

      <label className={CLASSE_ROTULO}>
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

      <label className={CLASSE_ROTULO}>
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

      <label className={CLASSE_ROTULO}>
        Quartos (mín.)
        <select
          className={CLASSE_CAMPO}
          value={searchParams.get("quartosMin") ?? ""}
          onChange={(e) => atualizar("quartosMin", e.target.value)}
        >
          <option value="">Qualquer</option>
          {OPCOES_QUARTOS.map((q) => (
            <option key={q} value={q}>
              {q}+
            </option>
          ))}
        </select>
      </label>

      <label className={CLASSE_ROTULO}>
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

      <label className={CLASSE_ROTULO}>
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
          className="rounded-lg border border-border-strong px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
        >
          Limpar
        </button>
      )}
    </form>
  );
}
