"use client";

// Seção ✉️ E-mail da central — modo Simulado/Envio real da newsletter. Sem
// RESEND_API_KEY no ambiente o "Envio real" fica indisponível (aviso honesto):
// mesmo que o gestor quisesse, nada sairia. Salva via salvarOrgConfigAction.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, MailCheck, Save, TestTube2 } from "lucide-react";
import type { ModoEmail } from "@imobia/domain";
import { Botao } from "@/components/ui/Botao";
import { salvarOrgConfigAction } from "@/lib/dados/org-config";
import { SeletorModo } from "./SeletorModo";

export function SecaoEmail({
  modoInicial,
  envioRealDisponivel,
}: {
  modoInicial: ModoEmail;
  /** false quando RESEND_API_KEY não existe no ambiente. */
  envioRealDisponivel: boolean;
}) {
  const router = useRouter();
  const [modo, setModo] = useState<ModoEmail>(modoInicial);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();

  function salvar() {
    setAviso(null);
    iniciar(async () => {
      const r = await salvarOrgConfigAction({ emailModo: modo });
      if (!r.ok) {
        setAviso({ tipo: "erro", texto: r.erro });
        return;
      }
      setAviso({
        tipo: "ok",
        texto:
          modo === "simulado"
            ? "Salvo — envios de newsletter apenas registram, sem e-mail real."
            : "Salvo — a newsletter passa a ser enviada de verdade aos inscritos.",
      });
      router.refresh();
    });
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        salvar();
      }}
    >
      <SeletorModo<ModoEmail>
        legenda="Modo de envio de e-mail"
        valor={modo}
        aoMudar={setModo}
        disabled={pendente}
        opcoes={[
          {
            valor: "simulado",
            rotulo: "Simulado",
            icone: <TestTube2 className="h-4 w-4 text-gold-strong" aria-hidden />,
            descricao:
              "O envio da newsletter conta os inscritos e marca a edição como \"Envio simulado\" — nenhum e-mail sai de verdade.",
          },
          {
            valor: "real",
            rotulo: "Envio real",
            icone: <MailCheck className="h-4 w-4 text-brand-strong" aria-hidden />,
            descricao: "As edições da newsletter são enviadas de verdade a todos os inscritos ativos.",
            desabilitada: !envioRealDisponivel,
          },
        ]}
      />

      {!envioRealDisponivel && (
        <p className="flex items-start gap-2 rounded-xl border border-gold/40 bg-gold-soft px-3 py-2 text-xs font-medium text-gold-strong">
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Envio real indisponível neste ambiente: configure a variável
          RESEND_API_KEY na Vercel e faça um novo deploy.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Botao type="submit" tamanho="sm" disabled={pendente}>
          <Save className="h-4 w-4" aria-hidden />
          {pendente ? "Salvando…" : "Salvar e-mail"}
        </Botao>
        {aviso !== null && (
          <p
            role="status"
            className={`text-sm font-medium ${aviso.tipo === "ok" ? "text-brand-strong" : "text-gold-strong"}`}
          >
            {aviso.texto}
          </p>
        )}
      </div>
    </form>
  );
}
