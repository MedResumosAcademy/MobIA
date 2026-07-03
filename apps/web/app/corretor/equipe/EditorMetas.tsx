"use client";

// Editor de METAS da empresa (togglável) — só gestor/admin renderiza este bloco.
// Fina camada client sobre `definirMeta` (Server Action): um campo de alvo por
// tipo, salva individualmente e faz router.refresh() para o Server Component pai
// recarregar as barras de progresso com os alvos novos.
//
// UNIDADES: metas monetárias (valor_vendido_mes) são guardadas em CENTAVOS na
// base; aqui o gestor digita em REAIS (inteiros) e convertemos ×100 no envio, e
// ÷100 para preencher o campo. As de contagem vão como inteiro puro.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Target } from "lucide-react";
import type { TipoMeta } from "@imobia/domain";
import { Botao } from "@/components/ui/Botao";
import { Campo, GrupoCampo } from "@/components/ui/Campo";
import { definirMetaAction } from "./acoes";

type ItemEditor = {
  tipo: TipoMeta;
  rotulo: string;
  monetaria: boolean;
  /** Alvo atual em REAIS (monetária) ou contagem — string do <input>. */
  valorInicial: number;
};

export function EditorMetas({ itens }: { itens: ItemEditor[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [valores, setValores] = useState<Record<TipoMeta, string>>(
    () =>
      Object.fromEntries(itens.map((i) => [i.tipo, String(i.valorInicial)])) as Record<
        TipoMeta,
        string
      >,
  );

  function salvarTudo() {
    setErro(null);
    setSalvo(false);
    iniciar(async () => {
      for (const item of itens) {
        const bruto = Number(valores[item.tipo]);
        if (!Number.isFinite(bruto) || bruto < 0) {
          setErro(`Informe um alvo válido para “${item.rotulo}”.`);
          return;
        }
        // Reais → centavos para metas monetárias; contagem vai inteira.
        const alvo = item.monetaria ? Math.round(bruto * 100) : Math.round(bruto);
        const resultado = await definirMetaAction(item.tipo, alvo);
        if (!resultado.ok) {
          setErro(resultado.erro);
          return;
        }
      }
      setSalvo(true);
      router.refresh();
    });
  }

  if (!aberto) {
    return (
      <Botao
        variante="secundario"
        tamanho="sm"
        onClick={() => setAberto(true)}
        aria-expanded={false}
      >
        <Target className="h-4 w-4" aria-hidden />
        Definir metas
      </Botao>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-brand/30 bg-brand-soft/50 p-6 shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-2 text-brand-strong">
        <Target className="h-4 w-4" aria-hidden />
        <h3 className="text-sm font-semibold uppercase tracking-[0.08em]">
          Definir metas do período
        </h3>
      </div>
      <p className="mt-1 text-xs text-subtle">
        Alvos da imobiliária para o mês. Valores monetários em reais.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {itens.map((item) => (
          <GrupoCampo
            key={item.tipo}
            rotulo={item.rotulo}
            htmlFor={`meta-${item.tipo}`}
            auxilio={item.monetaria ? "Em reais (R$)" : "Quantidade"}
          >
            <Campo
              id={`meta-${item.tipo}`}
              type="number"
              min={0}
              step={item.monetaria ? 1000 : 1}
              inputMode="numeric"
              value={valores[item.tipo]}
              disabled={pendente}
              onChange={(e) =>
                setValores((v) => ({ ...v, [item.tipo]: e.target.value }))
              }
            />
          </GrupoCampo>
        ))}
      </div>

      {erro && <p className="mt-4 text-sm text-brand-strong">{erro}</p>}
      {salvo && !erro && (
        <p className="mt-4 inline-flex items-center gap-1.5 text-sm text-gold-strong">
          <Check className="h-4 w-4" aria-hidden />
          Metas atualizadas.
        </p>
      )}

      <div className="mt-5 flex items-center gap-3">
        <Botao variante="primario" tamanho="sm" onClick={salvarTudo} disabled={pendente}>
          {pendente ? "Salvando…" : "Salvar metas"}
        </Botao>
        <Botao
          variante="fantasma"
          tamanho="sm"
          onClick={() => setAberto(false)}
          disabled={pendente}
        >
          Fechar
        </Botao>
      </div>
    </div>
  );
}
