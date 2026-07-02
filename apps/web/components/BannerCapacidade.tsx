// Banner do catálogo (H-18) quando o filtro de capacidade do Sonhômetro está
// ativo: "Mostrando imóveis até R$ X compatíveis com sua renda · [Ver todos]".
// [Ver todos] apaga o cookie (Server Action limparCapacidade) e recarrega o
// catálogo sem o teto. Client Component só pela interação do botão.
"use client";

import { formatarReais } from "@mobia/core";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { limparCapacidade } from "@/lib/capacidade";

export function BannerCapacidade({ capacidade }: { capacidade: number }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();

  function verTodos() {
    iniciar(async () => {
      await limparCapacidade();
      router.push("/imoveis");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-brand-soft px-4 py-3">
      <p className="text-sm text-brand-soft-fg">
        Mostrando imóveis até <strong>{formatarReais(capacidade)}</strong>, compatíveis com sua
        renda.
      </p>
      <button
        type="button"
        onClick={verTodos}
        disabled={pendente}
        className="rounded-lg border border-brand/30 px-3 py-1.5 text-sm font-medium text-brand transition-colors hover:bg-brand/10 disabled:opacity-60"
      >
        {pendente ? "Carregando…" : "Ver todos"}
      </button>
    </div>
  );
}
