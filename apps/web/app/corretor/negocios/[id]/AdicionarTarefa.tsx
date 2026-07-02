"use client";

// Formulário compacto para adicionar uma TAREFA (título + vencimento opcional) a
// um negócio. Fina camada client sobre criarTarefaAction; após a ação,
// router.refresh() re-renderiza o Server Component pai (a nova tarefa aparece na
// seção). org_id/corretor_id são derivados da SESSÃO na camada de dados.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Botao } from "@/components/ui/Botao";
import { Campo, GrupoCampo } from "@/components/ui/Campo";
import { criarTarefaAction } from "../../tarefas/acoes";

export function AdicionarTarefa({ negocioId }: { negocioId: string }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [titulo, setTitulo] = useState("");
  const [venceEm, setVenceEm] = useState("");

  function adicionar() {
    if (titulo.trim() === "") {
      return;
    }
    iniciar(async () => {
      const fd = new FormData();
      fd.set("negocioId", negocioId);
      fd.set("titulo", titulo);
      fd.set("venceEm", venceEm);
      await criarTarefaAction(fd);
      setTitulo("");
      setVenceEm("");
      router.refresh();
    });
  }

  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
      <GrupoCampo rotulo="Nova tarefa" htmlFor="tarefa-titulo" className="flex-1">
        <Campo
          id="tarefa-titulo"
          value={titulo}
          disabled={pendente}
          placeholder="Ex.: ligar para confirmar visita"
          onChange={(e) => setTitulo(e.target.value)}
        />
      </GrupoCampo>
      <GrupoCampo rotulo="Vencimento" htmlFor="tarefa-vence">
        <Campo
          id="tarefa-vence"
          type="date"
          value={venceEm}
          disabled={pendente}
          onChange={(e) => setVenceEm(e.target.value)}
          className="w-auto"
        />
      </GrupoCampo>
      <Botao
        variante="primario"
        disabled={pendente || titulo.trim() === ""}
        onClick={adicionar}
      >
        {pendente ? "Salvando…" : "Adicionar"}
      </Botao>
    </div>
  );
}
