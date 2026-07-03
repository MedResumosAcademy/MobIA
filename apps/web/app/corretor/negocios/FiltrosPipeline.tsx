"use client";

// Barra de FILTROS do pipeline (URL-driven). Cada controle escreve nos
// searchParams e navega — o Server Component pai relê e refiltra via
// listarNegocios. Preserva os demais params (inclusive ?vista). PURA UI de
// filtro: nenhuma regra de negócio; a RLS/escopo ficam no servidor.
//
//   etapa       — pílulas (single-select) das etapas abertas do funil
//   origem      — select das origens distintas (listarOrigens)
//   responsavel — select dos corretores da org (SÓ gestor/admin)
//   busca       — input por contato/imóvel, com debounce (empurra a URL)
//   limpar      — remove todos os filtros (mantém a vista atual)

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { EtapaNegocio } from "@imobia/domain";
import type { CorretorOpcao } from "@/lib/dados/gestor";
import { Botao } from "@/components/ui/Botao";
import { Campo, CampoSelect } from "@/components/ui/Campo";
import { PilulasCategoria } from "@/components/ui/PilulasCategoria";
import { ETAPAS_ORDEM, ROTULO_ETAPA } from "./rotulos";

// Chaves de filtro que esta barra controla (as demais, ex. vista/ordem, ficam).
const CHAVES_FILTRO = ["etapa", "origem", "responsavel", "busca"] as const;

export function FiltrosPipeline({
  origens,
  responsaveis,
  ehGestor,
}: {
  origens: string[];
  responsaveis: CorretorOpcao[];
  /** Quando true, mostra o filtro de responsável (gestor/admin). */
  ehGestor: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, iniciar] = useTransition();

  const etapaAtual = (params.get("etapa") ?? "") as EtapaNegocio | "";
  const origemAtual = params.get("origem") ?? "";
  const responsavelAtual = params.get("responsavel") ?? "";
  const buscaAtual = params.get("busca") ?? "";

  // Input de busca controlado localmente + debounce para não navegar a cada tecla.
  const [busca, setBusca] = useState(buscaAtual);
  const primeiroRender = useRef(true);

  // Mantém o input sincronizado se a URL mudar por fora (ex.: botão limpar).
  useEffect(() => {
    setBusca(buscaAtual);
  }, [buscaAtual]);

  function navegarCom(mut: (p: URLSearchParams) => void) {
    const p = new URLSearchParams(params.toString());
    mut(p);
    iniciar(() => {
      router.push(`${pathname}?${p.toString()}`, { scroll: false });
    });
  }

  function definir(chave: string, valor: string) {
    navegarCom((p) => {
      if (valor) {
        p.set(chave, valor);
      } else {
        p.delete(chave);
      }
    });
  }

  // Debounce da busca (350ms). Ignora o primeiro efeito (hidratação).
  useEffect(() => {
    if (primeiroRender.current) {
      primeiroRender.current = false;
      return;
    }
    if (busca === buscaAtual) {
      return;
    }
    const t = setTimeout(() => definir("busca", busca.trim()), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  function limpar() {
    setBusca("");
    navegarCom((p) => {
      for (const chave of CHAVES_FILTRO) {
        p.delete(chave);
      }
    });
  }

  const temFiltro =
    etapaAtual !== "" ||
    origemAtual !== "" ||
    responsavelAtual !== "" ||
    buscaAtual !== "";

  const opcoesEtapa = ETAPAS_ORDEM.map((e) => ({
    valor: e,
    rotulo: ROTULO_ETAPA[e],
  }));

  return (
    <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-border bg-surface-card p-4 shadow-[var(--shadow-soft)]">
      {/* Etapa (pílulas single-select) */}
      <PilulasCategoria
        aria="Filtrar por etapa"
        opcoes={opcoesEtapa}
        selecionado={etapaAtual || null}
        aoSelecionar={(valor) =>
          definir("etapa", valor === etapaAtual ? "" : valor)
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        {/* Busca por contato/imóvel */}
        <form
          className="flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            definir("busca", busca.trim());
          }}
        >
          <Campo
            type="search"
            name="busca"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por contato ou imóvel…"
            aria-label="Buscar por contato ou imóvel"
          />
        </form>

        {/* Origem */}
        <CampoSelect
          aria-label="Filtrar por origem"
          className="w-full py-2.5 sm:w-48"
          value={origemAtual}
          onChange={(e) => definir("origem", e.target.value)}
        >
          <option value="">Todas as origens</option>
          {origens.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </CampoSelect>

        {/* Responsável — só gestor/admin */}
        {ehGestor && (
          <CampoSelect
            aria-label="Filtrar por responsável"
            className="w-full py-2.5 sm:w-52"
            value={responsavelAtual}
            onChange={(e) => definir("responsavel", e.target.value)}
          >
            <option value="">Todos os responsáveis</option>
            {responsaveis.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome ?? "Corretor"}
              </option>
            ))}
          </CampoSelect>
        )}

        {temFiltro && (
          <Botao variante="secundario" tamanho="md" onClick={limpar}>
            Limpar
          </Botao>
        )}
      </div>
    </div>
  );
}
