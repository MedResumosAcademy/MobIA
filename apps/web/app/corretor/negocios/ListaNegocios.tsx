"use client";

// VISTA em LISTA (tabela) do funil — contato, imóvel, etapa (Badge), valor,
// responsável (só gestor), "parado há Xd" e data. Cada linha leva ao detalhe.
// ORDENÁVEL via ?ordem= (URL-driven, preserva os demais params):
//   parado  — mais parado primeiro (dias sem movimento desc) [padrão]
//   valor   — maior valor primeiro (nulos por último)
// Os cabeçalhos clicáveis alternam o critério. A ordenação é feita aqui (sobre
// os negócios já filtrados/escopados pelo servidor).

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { formatarReais } from "@imobia/core";
import type { NegocioResumo } from "@/lib/dados/negocios";
import { Badge } from "@/components/ui/Badge";
import { SeloAtencao } from "./atencao";
import { ROTULO_ETAPA } from "./rotulos";

export type OrdemLista = "parado" | "valor";

export function ListaNegocios({
  negocios,
  ordem,
  mostrarResponsavel,
  nomePorResponsavel,
}: {
  negocios: NegocioResumo[];
  ordem: OrdemLista;
  mostrarResponsavel: boolean;
  nomePorResponsavel: Record<string, string | null>;
}) {
  const pathname = usePathname();
  const params = useSearchParams();

  function hrefOrdem(destino: OrdemLista): string {
    const p = new URLSearchParams(params.toString());
    if (destino === "parado") {
      p.delete("ordem"); // parado é o padrão — URL limpa
    } else {
      p.set("ordem", destino);
    }
    const qs = p.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  const ordenados = [...negocios].sort((a, b) => {
    if (ordem === "valor") {
      // Maior valor primeiro; nulos por último.
      const va = a.valor ?? -1;
      const vb = b.valor ?? -1;
      return vb - va;
    }
    // parado: mais dias sem movimento primeiro.
    return b.diasSemMovimento - a.diasSemMovimento;
  });

  return (
    <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-surface-card shadow-[var(--shadow-soft)]">
      <table className="w-full min-w-[46rem] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-subtle">
            <th className="px-4 py-3 font-semibold">Contato</th>
            <th className="px-4 py-3 font-semibold">Imóvel</th>
            <th className="px-4 py-3 font-semibold">Etapa</th>
            {mostrarResponsavel && (
              <th className="px-4 py-3 font-semibold">Responsável</th>
            )}
            <th className="px-4 py-3 font-semibold">
              <LinkOrdem ativo={ordem === "valor"} href={hrefOrdem("valor")}>
                Valor
              </LinkOrdem>
            </th>
            <th className="px-4 py-3 font-semibold">
              <LinkOrdem ativo={ordem === "parado"} href={hrefOrdem("parado")}>
                Parado
              </LinkOrdem>
            </th>
          </tr>
        </thead>
        <tbody>
          {ordenados.map((n) => (
            <tr
              key={n.id}
              className="border-b border-border/60 transition-colors last:border-0 hover:bg-surface"
            >
              <td className="px-4 py-3">
                <Link
                  href={`/corretor/negocios/${n.id}`}
                  className="font-semibold text-foreground hover:text-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                >
                  {n.nomeContato}
                </Link>
              </td>
              <td className="px-4 py-3 text-muted">
                {n.imovelTitulo ?? "—"}
              </td>
              <td className="px-4 py-3">
                <Badge variante="neutro">{ROTULO_ETAPA[n.etapa]}</Badge>
              </td>
              {mostrarResponsavel && (
                <td className="px-4 py-3 text-muted">
                  {nomePorResponsavel[n.corretorId] ?? "—"}
                </td>
              )}
              <td className="px-4 py-3 font-semibold tabular-nums text-foreground">
                {n.valor !== null ? formatarReais(n.valor) : "—"}
              </td>
              <td className="px-4 py-3">
                {n.atencao === "ok" ? (
                  <span className="text-xs text-subtle tabular-nums">
                    {n.diasSemMovimento}d
                  </span>
                ) : (
                  <SeloAtencao atencao={n.atencao} dias={n.diasSemMovimento} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LinkOrdem({
  ativo,
  href,
  children,
}: {
  ativo: boolean;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-sort={ativo ? "descending" : "none"}
      className={`inline-flex items-center gap-1 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
        ativo ? "text-brand-strong" : "hover:text-foreground"
      }`}
    >
      {children}
      <span aria-hidden>{ativo ? "↓" : ""}</span>
    </Link>
  );
}
