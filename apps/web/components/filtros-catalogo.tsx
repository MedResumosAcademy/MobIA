"use client";

import { CATEGORIAS_IMOVEL, TIPOS_IMOVEL } from "@mobia/domain";
import {
  Building2,
  Home,
  Sparkles,
  TreePine,
  Gem,
  KeyRound,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, type ReactNode } from "react";
import { Campo, CampoSelect } from "@/components/ui/Campo";
import { PilulasCategoria } from "@/components/ui/PilulasCategoria";

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

// Ícones para as pílulas estilo Airbnb (âmbar/laranja herdados pelo componente).
const ICONE_TIPO: Record<(typeof TIPOS_IMOVEL)[number], ReactNode> = {
  casa: <Home aria-hidden className="size-4" />,
  apartamento: <Building2 aria-hidden className="size-4" />,
  terreno: <TreePine aria-hidden className="size-4" />,
};

const ICONE_CATEGORIA: Record<(typeof CATEGORIAS_IMOVEL)[number], ReactNode> = {
  lancamento: <Sparkles aria-hidden className="size-4" />,
  alto_padrao: <Gem aria-hidden className="size-4" />,
  mcmv: <KeyRound aria-hidden className="size-4" />,
};

const OPCOES_QUARTOS = [1, 2, 3, 4];

const CLASSE_ROTULO =
  "flex flex-col gap-1.5 text-[0.7rem] font-medium uppercase tracking-[0.1em] text-subtle";

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

  const tipoAtual = searchParams.get("tipo");
  const categoriaAtual = searchParams.get("categoria");

  // Pílulas estilo Airbnb: tipo + categoria em uma trilha só, single-select por
  // eixo. Clicar na pílula já ativa alterna liga/desliga aquele filtro na URL.
  const pilulasTipo = TIPOS_IMOVEL.map((t) => ({
    valor: `tipo:${t}`,
    rotulo: ROTULOS_TIPO[t],
    icone: ICONE_TIPO[t],
  }));
  const pilulasCategoria = CATEGORIAS_IMOVEL.map((c) => ({
    valor: `categoria:${c}`,
    rotulo: c === "mcmv" ? "MCMV" : ROTULOS_CATEGORIA[c],
    icone: ICONE_CATEGORIA[c],
  }));
  const opcoesPilula = [...pilulasTipo, ...pilulasCategoria];

  const ativos: string[] = [];
  if (tipoAtual) ativos.push(`tipo:${tipoAtual}`);
  if (categoriaAtual) ativos.push(`categoria:${categoriaAtual}`);

  const alternarPilula = useCallback(
    (valor: string) => {
      const [chave, sub] = valor.split(":");
      const atual = searchParams.get(chave);
      atualizar(chave, atual === sub ? "" : sub);
    },
    [atualizar, searchParams],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Trilha de pílulas de categoria/tipo (foto-forward, estilo Airbnb). */}
      <PilulasCategoria
        opcoes={opcoesPilula}
        selecionados={ativos}
        aoAlternar={alternarPilula}
        aria="Filtrar por tipo e categoria"
        className="-mx-1 px-1"
      />

      <div aria-hidden className="h-px bg-border" />

      {/* Barra de filtros refinada: cidade, preço, quartos. */}
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => e.preventDefault()}
      >
        <label className={`${CLASSE_ROTULO} min-w-52 flex-1`}>
          Cidade
          <Campo
            type="text"
            placeholder="Buscar cidade"
            defaultValue={searchParams.get("cidade") ?? ""}
            onBlur={(e) => atualizar("cidade", e.target.value.trim())}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                atualizar(
                  "cidade",
                  (e.target as HTMLInputElement).value.trim(),
                );
              }
            }}
          />
        </label>

        <label className={CLASSE_ROTULO}>
          Quartos (mín.)
          <CampoSelect
            className="w-40"
            value={searchParams.get("quartosMin") ?? ""}
            onChange={(e) => atualizar("quartosMin", e.target.value)}
          >
            <option value="">Qualquer</option>
            {OPCOES_QUARTOS.map((q) => (
              <option key={q} value={q}>
                {q}+
              </option>
            ))}
          </CampoSelect>
        </label>

        <label className={CLASSE_ROTULO}>
          Preço mín. (R$)
          <Campo
            type="number"
            min="0"
            step="1000"
            className="w-32"
            placeholder="0"
            defaultValue={searchParams.get("precoMin") ?? ""}
            onBlur={(e) => atualizar("precoMin", e.target.value.trim())}
          />
        </label>

        <label className={CLASSE_ROTULO}>
          Preço máx. (R$)
          <Campo
            type="number"
            min="0"
            step="1000"
            className="w-32"
            placeholder="Sem limite"
            defaultValue={searchParams.get("precoMax") ?? ""}
            onBlur={(e) => atualizar("precoMax", e.target.value.trim())}
          />
        </label>

        {temFiltros && (
          <button
            type="button"
            onClick={limpar}
            className="rounded-full px-3.5 py-2.5 text-sm font-medium text-muted underline-offset-4 outline-none transition-colors hover:text-brand-strong hover:underline focus-visible:ring-2 focus-visible:ring-brand/25"
          >
            Limpar filtros
          </button>
        )}
      </form>
    </div>
  );
}
