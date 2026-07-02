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
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-card p-6 shadow-soft">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-foreground">
            Atendimento personalizado
          </h2>
          <span
            className={
              ativo
                ? "rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand-strong"
                : "rounded-full bg-surface-strong px-2.5 py-0.5 text-xs font-medium text-subtle"
            }
          >
            {ativo ? "Ativado" : "Desativado"}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-muted">
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
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-60 " +
          (ativo ? "bg-brand" : "bg-border-strong")
        }
      >
        <span
          className={
            "inline-block h-5 w-5 transform rounded-full bg-surface-card shadow-soft transition-transform " +
            (ativo ? "translate-x-6" : "translate-x-1")
          }
        />
      </button>

      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => alternar(!ativo)}
          disabled={pendente}
          className="w-fit text-sm font-semibold text-brand-strong underline underline-offset-2 transition-colors hover:text-brand-hover disabled:opacity-60"
        >
          {pendente ? "Salvando…" : ativo ? "Desativar" : "Ativar agora"}
        </button>
        {erro && (
          <p className="text-sm text-brand-strong">
            Não foi possível salvar. Tente novamente.
          </p>
        )}
      </div>

      <p className="text-xs leading-relaxed text-subtle">
        Transparência (LGPD): esta opção é opcional (opt-in) e reversível. Enquanto estiver
        desativada, seu comportamento no app permanece privado e nenhum corretor tem acesso aos
        seus dados de interesse.
      </p>
    </div>
  );
}
