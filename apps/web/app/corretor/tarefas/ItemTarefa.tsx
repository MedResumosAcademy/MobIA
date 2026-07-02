// Linha de uma TAREFA na lista "Minhas tarefas" / "Tarefas da equipe": botão de
// concluir, título, link ao negócio e prazo (atrasada destacada). O botão é
// client (BotaoConcluir); o resto é apresentação pura. `mostrarCorretor` liga o
// nome do responsável (útil no escopo do gestor). pt-BR.

import Link from "next/link";
import type { TarefaResumo } from "@/lib/dados/tarefas";
import { BotaoConcluir } from "./BotaoConcluir";
import { formatarVencimento } from "./data";

export function ItemTarefa({
  tarefa,
  mostrarCorretor = false,
}: {
  tarefa: TarefaResumo;
  mostrarCorretor?: boolean;
}) {
  return (
    <li
      className={`flex items-start gap-3 rounded-2xl border p-4 shadow-[var(--shadow-soft)] ${
        tarefa.atrasada ? "border-brand/40 bg-brand-soft" : "border-border bg-surface-card"
      }`}
    >
      <BotaoConcluir id={tarefa.id} negocioId={tarefa.negocioId} concluida={tarefa.concluida} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{tarefa.titulo}</p>
        <p className="mt-0.5 text-xs text-subtle">
          {tarefa.atrasada && (
            <span className="font-semibold text-brand-strong">Atrasada · </span>
          )}
          {formatarVencimento(tarefa.venceEm)}
          {tarefa.negocioNomeContato && <> · {tarefa.negocioNomeContato}</>}
          {mostrarCorretor && tarefa.corretorNome && (
            <> · <span className="text-muted">{tarefa.corretorNome}</span></>
          )}
        </p>
      </div>
      <Link
        href={`/corretor/negocios/${tarefa.negocioId}`}
        className="flex-shrink-0 text-xs font-medium text-brand-strong transition-colors hover:text-brand"
      >
        Ver negócio →
      </Link>
    </li>
  );
}
