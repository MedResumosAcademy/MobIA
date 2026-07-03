// Telefone de contato do cliente (LGPD / Decisão 6). Client Component: campo
// que o cliente grava para que o corretor consiga falar com ele QUANDO o
// atendimento personalizado estiver ativado (consentimento). Chama a Server
// Action atualizarMeuTelefone. `inicial` = obterMeuTelefone() no servidor:
// dígitos (ex.: "5511988887777") ou null.
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Botao } from "@/components/ui/Botao";
import { Campo, GrupoCampo } from "@/components/ui/Campo";
import { atualizarMeuTelefone } from "@/lib/dados/consentimento";

export function ControleTelefone({ inicial }: { inicial: string | null }) {
  const router = useRouter();
  const [valor, setValor] = useState(inicial ?? "");
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  const salvoInicial = inicial ?? "";
  const alterado = valor.trim() !== salvoInicial;

  function salvar() {
    setErro(null);
    setSalvo(false);
    // Validação leve no cliente (o schema no servidor é a fonte da verdade).
    const digitos = valor.replace(/\D/g, "");
    if (digitos.length !== 0 && (digitos.length < 10 || digitos.length > 15)) {
      setErro("Informe DDD + número (ex.: 11 98888-7777).");
      return;
    }
    iniciar(async () => {
      try {
        await atualizarMeuTelefone(valor);
        setSalvo(true);
        router.refresh();
      } catch {
        setErro("Não foi possível salvar. Tente novamente.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-card p-6 shadow-soft">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-foreground">
          Telefone de contato
        </h2>
        <p className="text-sm leading-relaxed text-muted">
          Deixe seu telefone para o corretor entrar em contato quando você ativar o
          atendimento personalizado. Ele só é compartilhado enquanto o atendimento
          estiver ativado (consentimento) — sem isso, ninguém vê seu número.
        </p>
      </div>

      <GrupoCampo
        htmlFor="telefone-contato"
        rotulo="Telefone (com DDD)"
        erro={erro}
        auxilio={salvo && !alterado ? "Telefone salvo." : "Opcional. WhatsApp de preferência."}
      >
        <Campo
          id="telefone-contato"
          name="telefone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="(11) 98888-7777"
          value={valor}
          onChange={(e) => {
            setValor(e.target.value);
            setSalvo(false);
          }}
          disabled={pendente}
        />
      </GrupoCampo>

      <Botao
        type="button"
        variante="primario"
        tamanho="sm"
        onClick={salvar}
        disabled={pendente || !alterado}
        className="w-fit"
      >
        {pendente ? "Salvando…" : "Salvar telefone"}
      </Botao>
    </div>
  );
}
