"use client";

// Seção 💬 WhatsApp da central — modo de envio Teste/Produção + números de
// teste (um por linha, com DDD). Em modo TESTE nada sai para cliente real:
// conversas, campanhas e a IA só entregam para os números listados (gate
// único em lib/dados/envio-whatsapp.ts). Salva via salvarOrgConfigAction
// (parcial: só os campos desta seção).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, Rocket, Save, ShieldAlert } from "lucide-react";
import type { ModoWhatsapp } from "@imobia/domain";
import { Botao } from "@/components/ui/Botao";
import { CampoTextarea, GrupoCampo } from "@/components/ui/Campo";
import { salvarOrgConfigAction } from "@/lib/dados/org-config";
import { SeletorModo } from "./SeletorModo";

export function SecaoWhatsapp({
  modoInicial,
  numerosIniciais,
}: {
  modoInicial: ModoWhatsapp;
  numerosIniciais: string[];
}) {
  const router = useRouter();
  const [modo, setModo] = useState<ModoWhatsapp>(modoInicial);
  const [numeros, setNumeros] = useState(numerosIniciais.join("\n"));
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();

  function salvar() {
    setAviso(null);
    iniciar(async () => {
      const r = await salvarOrgConfigAction({
        whatsappModo: modo,
        whatsappNumerosTeste: numeros
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l !== ""),
      });
      if (!r.ok) {
        setAviso({ tipo: "erro", texto: r.erro });
        return;
      }
      setAviso({
        tipo: "ok",
        texto:
          modo === "teste"
            ? "Salvo — modo teste ativo: nenhum cliente real recebe mensagens."
            : "Salvo — modo PRODUÇÃO ativo: as mensagens saem para clientes reais.",
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
      <SeletorModo<ModoWhatsapp>
        legenda="Modo de envio do WhatsApp"
        valor={modo}
        aoMudar={setModo}
        disabled={pendente}
        opcoes={[
          {
            valor: "teste",
            rotulo: "Teste",
            icone: <FlaskConical className="h-4 w-4 text-gold-strong" aria-hidden />,
            descricao:
              "Só envia para os números de teste abaixo — protege contra mandar mensagem para cliente real enquanto você ajusta campanhas e a IA.",
          },
          {
            valor: "producao",
            rotulo: "Produção",
            icone: <Rocket className="h-4 w-4 text-brand-strong" aria-hidden />,
            descricao:
              "Envia de verdade para todos os contatos: conversas, campanhas e respostas da IA chegam ao cliente.",
          },
        ]}
      />

      {modo === "producao" && (
        <p className="flex items-start gap-2 rounded-xl border border-gold/40 bg-gold-soft px-3 py-2 text-xs font-medium text-gold-strong">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Em produção as mensagens saem para clientes reais — confira os
          templates e a IA antes de salvar.
        </p>
      )}

      <GrupoCampo
        rotulo="Números de teste"
        htmlFor="config-numeros-teste"
        auxilio="Um por linha, com DDD (ex.: 11 98888-7777). São os únicos que recebem mensagens no modo teste — normalizamos para o DDI 55 automaticamente."
      >
        <CampoTextarea
          id="config-numeros-teste"
          value={numeros}
          onChange={(e) => setNumeros(e.target.value)}
          placeholder={"11 98888-7777\n21 97777-6666"}
          className="min-h-24 font-mono text-xs"
          disabled={pendente}
        />
      </GrupoCampo>

      <div className="flex flex-wrap items-center gap-3">
        <Botao type="submit" tamanho="sm" disabled={pendente}>
          <Save className="h-4 w-4" aria-hidden />
          {pendente ? "Salvando…" : "Salvar WhatsApp"}
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
