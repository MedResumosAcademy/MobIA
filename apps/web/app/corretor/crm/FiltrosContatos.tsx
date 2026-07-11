"use client";

// Barra de FILTROS da agenda de contatos (URL-driven, mesmo padrão do
// pipeline): busca com debounce, tag e "só meus". O Server Component pai relê
// os searchParams e refiltra. PURA UI — escopo/RLS ficam no servidor.

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Botao } from "@/components/ui/Botao";
import { Campo, CampoSelect } from "@/components/ui/Campo";

const CHAVES_FILTRO = ["busca", "tag", "meus"] as const;

export function FiltrosContatos({ tags }: { tags: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, iniciar] = useTransition();

  const buscaAtual = params.get("busca") ?? "";
  const tagAtual = params.get("tag") ?? "";
  const soMeus = params.get("meus") === "1";

  // Input de busca controlado localmente + debounce (não navega a cada tecla).
  const [busca, setBusca] = useState(buscaAtual);
  const primeiroRender = useRef(true);

  // Sincroniza o input se a URL mudar por fora (ex.: limpar) — ajuste DURANTE
  // o render (setState em efeito dispararia render em cascata).
  const [buscaDaUrlAnterior, setBuscaDaUrlAnterior] = useState(buscaAtual);
  if (buscaDaUrlAnterior !== buscaAtual) {
    setBuscaDaUrlAnterior(buscaAtual);
    setBusca(buscaAtual);
  }

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

  const temFiltro = buscaAtual !== "" || tagAtual !== "" || soMeus;

  return (
    <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-border bg-surface-card p-4 shadow-[var(--shadow-soft)] sm:flex-row sm:items-center">
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
          placeholder="Buscar por nome, telefone ou e-mail…"
          aria-label="Buscar contato por nome, telefone ou e-mail"
        />
      </form>

      <CampoSelect
        aria-label="Filtrar por tag"
        className="w-full py-2.5 sm:w-44"
        value={tagAtual}
        onChange={(e) => definir("tag", e.target.value)}
      >
        <option value="">Todas as tags</option>
        {tags.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </CampoSelect>

      <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
        <input
          type="checkbox"
          checked={soMeus}
          onChange={(e) => definir("meus", e.target.checked ? "1" : "")}
          className="h-4 w-4 rounded border-border-strong accent-[var(--color-brand)]"
        />
        Só meus contatos
      </label>

      {temFiltro && (
        <Botao variante="secundario" tamanho="sm" onClick={limpar}>
          Limpar
        </Botao>
      )}
    </div>
  );
}
