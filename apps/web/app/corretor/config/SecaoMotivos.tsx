"use client";

// Seção 📉 Motivos de perda — textarea "um por linha", como no irmão MRA.
// Os motivos alimentam o seletor "Motivo da perda" nos controles do negócio
// (marcar como perdido) e o relatório de perdas por funil.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Botao } from "@/components/ui/Botao";
import { CampoTextarea, GrupoCampo } from "@/components/ui/Campo";
import { salvarOrgConfigAction } from "@/lib/dados/org-config";

const MAX_MOTIVOS = 30;
const MAX_TAMANHO = 80;

export function SecaoMotivos({ motivosIniciais }: { motivosIniciais: string[] }) {
  const router = useRouter();
  const [texto, setTexto] = useState(motivosIniciais.join("\n"));
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();

  function salvar() {
    setAviso(null);
    const motivos = texto
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l !== "");
    if (motivos.length === 0) {
      setAviso({ tipo: "erro", texto: "Mantenha ao menos um motivo de perda." });
      return;
    }
    if (motivos.length > MAX_MOTIVOS) {
      setAviso({ tipo: "erro", texto: `Use no máximo ${MAX_MOTIVOS} motivos.` });
      return;
    }
    if (motivos.some((m) => m.length > MAX_TAMANHO)) {
      setAviso({ tipo: "erro", texto: `Cada motivo pode ter até ${MAX_TAMANHO} caracteres.` });
      return;
    }
    iniciar(async () => {
      const r = await salvarOrgConfigAction({ motivosPerda: motivos });
      if (!r.ok) {
        setAviso({ tipo: "erro", texto: r.erro });
        return;
      }
      setAviso({ tipo: "ok", texto: "Motivos salvos." });
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
      <GrupoCampo
        rotulo="Motivos de perda"
        htmlFor="config-motivos-perda"
        auxilio={`Um por linha (até ${MAX_MOTIVOS}). Aparecem no seletor "Motivo da perda" quando alguém marca um negócio como perdido.`}
      >
        <CampoTextarea
          id="config-motivos-perda"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={"Sem resposta / esfriou\nPreço\nComprou concorrente"}
          className="min-h-36"
          disabled={pendente}
        />
      </GrupoCampo>

      <div className="flex flex-wrap items-center gap-3">
        <Botao type="submit" tamanho="sm" disabled={pendente}>
          <Save className="h-4 w-4" aria-hidden />
          {pendente ? "Salvando…" : "Salvar motivos"}
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
