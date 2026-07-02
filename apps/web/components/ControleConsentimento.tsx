// Controle de consentimento de leads (LGPD / Decisão 6). OPT-IN, default off,
// revogável a qualquer momento. Client Component: mostra o estado atual e um
// toggle Ativar/Desativar que chama a Server Action definirConsentimento.
// `inicial` = obterConsentimento() no servidor: null (nunca decidiu) ou boolean.
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { definirConsentimento } from "@/lib/dados/consentimento";

export function ControleConsentimento({ inicial }: { inicial: boolean | null }) {
  const router = useRouter();
  const [ativo, setAtivo] = useState(inicial === true);
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState(false);

  function alternar(proximo: boolean) {
    setErro(false);
    setAtivo(proximo); // otimista
    iniciar(async () => {
      try {
        await definirConsentimento(proximo);
        router.refresh();
      } catch {
        setAtivo(!proximo); // reverte
        setErro(true);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Atendimento personalizado
          </h2>
          <span
            className={
              ativo
                ? "rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                : "rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400"
            }
          >
            {ativo ? "Ativado" : "Desativado"}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          Ao ativar, os corretores dos imóveis que você favoritar ou simular poderão ver seu
          interesse e falar com você para ajudar na sua compra. É você quem decide: nada é
          compartilhado enquanto você não ativar, e você pode desativar quando quiser.
        </p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={ativo}
        aria-label="Ativar atendimento personalizado"
        onClick={() => alternar(!ativo)}
        disabled={pendente}
        className={
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 " +
          (ativo ? "bg-emerald-600" : "bg-zinc-300 dark:bg-zinc-700")
        }
      >
        <span
          className={
            "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform " +
            (ativo ? "translate-x-6" : "translate-x-1")
          }
        />
      </button>

      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => alternar(!ativo)}
          disabled={pendente}
          className="w-fit text-sm font-medium text-zinc-950 underline underline-offset-2 disabled:opacity-60 dark:text-zinc-50"
        >
          {pendente ? "Salvando…" : ativo ? "Desativar" : "Ativar agora"}
        </button>
        {erro && (
          <p className="text-sm text-rose-600 dark:text-rose-400">
            Não foi possível salvar. Tente novamente.
          </p>
        )}
      </div>

      <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-500">
        Transparência (LGPD): esta opção é opcional (opt-in) e reversível. Enquanto estiver
        desativada, seu comportamento no app permanece privado e nenhum corretor tem acesso aos
        seus dados de interesse.
      </p>
    </div>
  );
}
