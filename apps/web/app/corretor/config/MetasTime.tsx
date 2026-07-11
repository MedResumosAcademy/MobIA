"use client";

// 🎯 METAS DO TIME — tabela de corretores/gestores com alvo individual de
// vendas/mês e receita/mês. Upsert em LOTE (salvarMetasTimeAction). Dinheiro
// em CENTAVOS no banco; aqui o gestor digita em REAIS inteiros (×100 no
// envio, ÷100 para preencher) — mesmo padrão do EditorMetas da equipe.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Save } from "lucide-react";
import { Botao } from "@/components/ui/Botao";
import { classesCampo } from "@/components/ui/Campo";
import {
  salvarMetasTimeAction,
  type MetaCorretorLinha,
} from "@/lib/dados/config-central";

type ValoresLinha = { vendas: string; receitaReais: string };

export function MetasTime({ linhas }: { linhas: MetaCorretorLinha[] }) {
  const router = useRouter();
  const [valores, setValores] = useState<Record<string, ValoresLinha>>(() =>
    Object.fromEntries(
      linhas.map((l) => [
        l.corretorId,
        {
          vendas: String(l.vendasMes),
          receitaReais: String(Math.round(l.receitaMesCentavos / 100)),
        },
      ]),
    ),
  );
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();

  function mudar(id: string, campo: keyof ValoresLinha, valor: string) {
    setValores((v) => ({ ...v, [id]: { ...v[id], [campo]: valor } }));
  }

  function salvar() {
    setAviso(null);
    const itens: { corretorId: string; vendasMes: number; receitaMesCentavos: number }[] = [];
    for (const l of linhas) {
      const v = valores[l.corretorId];
      const vendas = Number(v?.vendas ?? "");
      const receitaReais = Number(v?.receitaReais ?? "");
      if (!Number.isFinite(vendas) || vendas < 0 || !Number.isFinite(receitaReais) || receitaReais < 0) {
        setAviso({
          tipo: "erro",
          texto: `Confira as metas de ${l.nome ?? "corretor sem nome"}: use números não negativos.`,
        });
        return;
      }
      itens.push({
        corretorId: l.corretorId,
        vendasMes: Math.round(vendas),
        receitaMesCentavos: Math.round(receitaReais * 100),
      });
    }
    if (itens.length === 0) {
      return;
    }
    iniciar(async () => {
      const r = await salvarMetasTimeAction(itens);
      if (!r.ok) {
        setAviso({ tipo: "erro", texto: r.erro });
        return;
      }
      setAviso({ tipo: "ok", texto: "Metas do time salvas." });
      router.refresh();
    });
  }

  if (linhas.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border-strong bg-surface p-4 text-sm text-subtle">
        Nenhum corretor na equipe ainda — convide alguém na seção Equipe &
        acessos acima.
      </p>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        salvar();
      }}
    >
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[28rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-left text-xs font-semibold uppercase tracking-[0.08em] text-subtle">
              <th scope="col" className="px-4 py-2.5">
                Pessoa
              </th>
              <th scope="col" className="px-4 py-2.5">
                Vendas/mês
              </th>
              <th scope="col" className="px-4 py-2.5">
                Receita/mês (R$)
              </th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.corretorId} className="border-b border-border last:border-b-0">
                <td className="px-4 py-2.5">
                  <span className="font-medium text-foreground">
                    {l.nome ?? "Sem nome"}
                  </span>
                  <span className="ml-2 text-xs capitalize text-subtle">{l.papel}</span>
                </td>
                <td className="px-4 py-2.5">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    aria-label={`Meta de vendas por mês de ${l.nome ?? "corretor sem nome"}`}
                    value={valores[l.corretorId]?.vendas ?? "0"}
                    onChange={(e) => mudar(l.corretorId, "vendas", e.target.value)}
                    disabled={pendente}
                    className={classesCampo("max-w-24 px-2.5 py-1.5 tabular-nums")}
                  />
                </td>
                <td className="px-4 py-2.5">
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    inputMode="numeric"
                    aria-label={`Meta de receita por mês (em reais) de ${l.nome ?? "corretor sem nome"}`}
                    value={valores[l.corretorId]?.receitaReais ?? "0"}
                    onChange={(e) => mudar(l.corretorId, "receitaReais", e.target.value)}
                    disabled={pendente}
                    className={classesCampo("max-w-36 px-2.5 py-1.5 tabular-nums")}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Botao type="submit" tamanho="sm" disabled={pendente}>
          <Save className="h-4 w-4" aria-hidden />
          {pendente ? "Salvando…" : "Salvar metas do time"}
        </Botao>
        {aviso !== null && (
          <p
            role="status"
            className={`inline-flex items-center gap-1.5 text-sm font-medium ${
              aviso.tipo === "ok" ? "text-brand-strong" : "text-gold-strong"
            }`}
          >
            {aviso.tipo === "ok" && <Check className="h-4 w-4" aria-hidden />}
            {aviso.texto}
          </p>
        )}
      </div>
    </form>
  );
}
