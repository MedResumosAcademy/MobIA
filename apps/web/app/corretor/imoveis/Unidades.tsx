import type { Unidade } from "@/lib/dados/imoveis";
import { formatarReais } from "@mobia/core";
import {
  atualizarUnidadeAction,
  criarUnidadeAction,
  removerUnidadeAction,
} from "./acoes";
import { ROTULO_STATUS, STATUS } from "./rotulos";

const rotuloClasse =
  "flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400";
const inputClasse =
  "rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

function centavosParaReais(v: number): string {
  return (v / 100).toFixed(2).replace(".", ",");
}

export function Unidades({ imovelId, unidades }: { imovelId: string; unidades: Unidade[] }) {
  const criar = criarUnidadeAction.bind(null, imovelId);

  return (
    <section className="mt-10 flex flex-col gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Unidades</h2>

      <ul className="flex flex-col gap-3">
        {unidades.length === 0 && (
          <li className="text-sm text-zinc-500 dark:text-zinc-400">
            Nenhuma unidade cadastrada.
          </li>
        )}
        {unidades.map((u) => {
          const atualizar = atualizarUnidadeAction.bind(null, imovelId, u.id);
          return (
            <li
              key={u.id}
              className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
            >
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {u.identificador} · {formatarReais(u.valor)} · {ROTULO_STATUS[u.status]}
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <form action={atualizar} className="flex flex-wrap items-end gap-2">
                  <label className={rotuloClasse}>
                    Identificador
                    <input name="identificador" required defaultValue={u.identificador} className={inputClasse} />
                  </label>
                  <label className={rotuloClasse}>
                    Andar
                    <input name="andar" inputMode="numeric" defaultValue={u.andar ?? ""} className={`${inputClasse} w-20`} />
                  </label>
                  <label className={rotuloClasse}>
                    Posição
                    <input name="posicao" defaultValue={u.posicao ?? ""} className={inputClasse} />
                  </label>
                  <label className={rotuloClasse}>
                    Valor (R$)
                    <input name="valor" required inputMode="decimal" defaultValue={centavosParaReais(u.valor)} className={inputClasse} />
                  </label>
                  <label className={rotuloClasse}>
                    Status
                    <select name="status" defaultValue={u.status} className={inputClasse}>
                      {STATUS.map((s) => (
                        <option key={s.valor} value={s.valor}>
                          {s.rotulo}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="submit"
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Salvar
                  </button>
                </form>
                <form action={removerUnidadeAction}>
                  <input type="hidden" name="imovelId" value={imovelId} />
                  <input type="hidden" name="unidadeId" value={u.id} />
                  <button
                    type="submit"
                    className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
                  >
                    Remover
                  </button>
                </form>
              </div>
            </li>
          );
        })}
      </ul>

      <form action={criar} className="flex flex-wrap items-end gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <label className={rotuloClasse}>
          Identificador
          <input name="identificador" required placeholder="905" className={inputClasse} />
        </label>
        <label className={rotuloClasse}>
          Andar
          <input name="andar" inputMode="numeric" className={`${inputClasse} w-20`} />
        </label>
        <label className={rotuloClasse}>
          Posição
          <input name="posicao" placeholder="norte" className={inputClasse} />
        </label>
        <label className={rotuloClasse}>
          Valor (R$)
          <input name="valor" required inputMode="decimal" placeholder="960000,00" className={inputClasse} />
        </label>
        <label className={rotuloClasse}>
          Status
          <select name="status" defaultValue="disponivel" className={inputClasse}>
            {STATUS.map((s) => (
              <option key={s.valor} value={s.valor}>
                {s.rotulo}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-lg bg-zinc-950 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          Adicionar unidade
        </button>
      </form>
    </section>
  );
}
