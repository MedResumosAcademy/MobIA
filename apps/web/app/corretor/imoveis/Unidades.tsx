import type { Unidade } from "@/lib/dados/imoveis";
import { formatarReais } from "@imobia/core";
import { Botao } from "@/components/ui/Botao";
import { classesCampo } from "@/components/ui/Campo";
import {
  atualizarUnidadeAction,
  criarUnidadeAction,
  removerUnidadeAction,
} from "./acoes";
import { ROTULO_STATUS, STATUS } from "./rotulos";

const rotuloClasse =
  "flex flex-col gap-1 text-xs font-medium text-muted";
const inputClasse = classesCampo("py-1.5");

function centavosParaReais(v: number): string {
  return (v / 100).toFixed(2).replace(".", ",");
}

export function Unidades({ imovelId, unidades }: { imovelId: string; unidades: Unidade[] }) {
  const criar = criarUnidadeAction.bind(null, imovelId);

  return (
    <section className="mt-10 flex flex-col gap-4 rounded-2xl border border-border bg-surface-card p-4 shadow-[var(--shadow-soft)]">
      <h2 className="text-lg font-semibold text-foreground">Unidades</h2>

      <ul className="flex flex-col gap-3">
        {unidades.length === 0 && (
          <li className="text-sm text-subtle">
            Nenhuma unidade cadastrada.
          </li>
        )}
        {unidades.map((u) => {
          const atualizar = atualizarUnidadeAction.bind(null, imovelId, u.id);
          return (
            <li
              key={u.id}
              className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3"
            >
              <p className="text-sm text-muted">
                <span className="font-medium text-foreground">{u.identificador}</span> ·{" "}
                <span className="tabular-nums">{formatarReais(u.valor)}</span> ·{" "}
                {ROTULO_STATUS[u.status]}
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
                  <Botao type="submit" variante="secundario" tamanho="sm">
                    Salvar
                  </Botao>
                </form>
                <form action={removerUnidadeAction}>
                  <input type="hidden" name="imovelId" value={imovelId} />
                  <input type="hidden" name="unidadeId" value={u.id} />
                  <button
                    type="submit"
                    className="inline-flex items-center rounded-xl border border-red-300 px-3.5 py-1.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50"
                  >
                    Remover
                  </button>
                </form>
              </div>
            </li>
          );
        })}
      </ul>

      <form action={criar} className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
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
        <Botao type="submit" tamanho="sm">
          Adicionar unidade
        </Botao>
      </form>
    </section>
  );
}
