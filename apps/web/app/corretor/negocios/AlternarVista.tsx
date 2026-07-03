"use client";

// Alternador de VISTA do pipeline: Kanban <-> Lista. URL-driven (?vista=…),
// preserva os demais searchParams (filtros). PURA UI. Renderiza dois botões
// segmentados com aria-pressed para acessibilidade.

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { KanbanSquare, List } from "lucide-react";

export type Vista = "kanban" | "lista";

export function AlternarVista({ vista }: { vista: Vista }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function ir(destino: Vista) {
    if (destino === vista) {
      return;
    }
    const p = new URLSearchParams(params.toString());
    if (destino === "kanban") {
      p.delete("vista"); // kanban é o default — URL limpa
    } else {
      p.set("vista", destino);
    }
    router.push(`${pathname}?${p.toString()}`, { scroll: false });
  }

  return (
    <div
      role="group"
      aria-label="Alternar vista"
      className="inline-flex items-center rounded-xl border border-border-strong bg-surface-card p-0.5 shadow-[var(--shadow-soft)]"
    >
      <Botao ativo={vista === "kanban"} onClick={() => ir("kanban")}>
        <KanbanSquare className="size-4" aria-hidden />
        Kanban
      </Botao>
      <Botao ativo={vista === "lista"} onClick={() => ir("lista")}>
        <List className="size-4" aria-hidden />
        Lista
      </Botao>
    </div>
  );
}

function Botao({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
        ativo
          ? "bg-brand text-brand-contrast shadow-[var(--shadow-soft)]"
          : "text-muted hover:bg-surface hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
