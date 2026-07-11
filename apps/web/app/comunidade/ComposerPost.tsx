"use client";

// ComposerPost — caixa de publicação no topo do feed da Comunidade. Textarea
// livre + seletor de tipo (pílulas Geral/Conquista/Dica) + contador de chars
// (máx 2000). Ao publicar, chama publicarPostAction; no sucesso limpa e dá
// router.refresh() para trazer o post novo. Desabilita botão quando vazio ou
// enquanto publica; mostra erro amigável se a action falhar. Não trava a UI.

import { useState, useTransition } from "react";
import { Send, PartyPopper, Lightbulb, MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import type { TipoPublicacao } from "@imobia/domain";
import { publicarPostAction } from "./acoes";
import { Botao } from "@/components/ui/Botao";
import { CampoTextarea } from "@/components/ui/Campo";
import { PilulasCategoria } from "@/components/ui/PilulasCategoria";

const MAX = 2000;

// Só os tipos "de composição" — `imovel` é derivado de imovelId, não é pílula.
const OPCOES = [
  { valor: "geral", rotulo: "Geral", icone: <MessageSquare size={14} aria-hidden="true" /> },
  { valor: "conquista", rotulo: "Conquista", icone: <PartyPopper size={14} aria-hidden="true" /> },
  { valor: "dica", rotulo: "Dica", icone: <Lightbulb size={14} aria-hidden="true" /> },
];

export function ComposerPost() {
  const router = useRouter();
  const [conteudo, setConteudo] = useState("");
  const [tipo, setTipo] = useState<TipoPublicacao>("geral");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const limpo = conteudo.trim();
  const vazio = limpo.length === 0;
  const excedeu = conteudo.length > MAX;

  function publicar() {
    if (vazio || excedeu) return;
    setErro(null);
    iniciar(async () => {
      const res = await publicarPostAction({ conteudo: limpo, tipo });
      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      setConteudo("");
      setTipo("geral");
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-surface-card p-4 shadow-soft sm:p-5">
      <CampoTextarea
        value={conteudo}
        onChange={(e) => setConteudo(e.target.value)}
        placeholder="Compartilhe uma conquista, dica…"
        maxLength={MAX}
        rows={3}
        aria-label="Conteúdo da publicação"
        disabled={pendente}
      />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <PilulasCategoria
          opcoes={OPCOES}
          selecionado={tipo}
          aoSelecionar={(v) => setTipo(v as TipoPublicacao)}
          tamanho="sm"
          aria="Tipo da publicação"
        />

        <div className="flex items-center gap-3">
          <span
            className={`text-xs tabular-nums ${
              excedeu ? "text-brand-strong" : "text-subtle"
            }`}
          >
            {conteudo.length}/{MAX}
          </span>
          <Botao
            variante="primario"
            tamanho="sm"
            onClick={publicar}
            disabled={vazio || excedeu || pendente}
          >
            <Send size={15} aria-hidden="true" />
            {pendente ? "Publicando…" : "Publicar"}
          </Botao>
        </div>
      </div>

      {erro && (
        <p role="alert" className="mt-2 text-xs text-brand-strong">
          {erro}
        </p>
      )}
    </div>
  );
}
