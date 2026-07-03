"use client";

// PostCard — um post do feed da Comunidade. Cabeçalho com avatar (foto ou
// inicial), autor + org + tempo relativo, badge do tipo (Conquista/Dica em cor
// quente). Corpo respeita quebras de linha. Se houver imóvel vinculado, um chip
// linka /imoveis. Rodapé: botão Curtir (Heart preenchido quando curtido, com
// contador — toggle otimista + router.refresh()) e, se não sou o autor, o
// BotaoSeguir do autor. Curtir usa transition para não travar a UI.

import { useState, useTransition } from "react";
import Link from "next/link";
import { Heart, Building2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { PostFeed } from "@/lib/dados/comunidade";
import { curtirAction, descurtirAction } from "./acoes";
import { Badge } from "@/components/ui/Badge";
import { BotaoSeguir } from "./BotaoSeguir";

/** Tempo relativo pt-BR compacto ("agora", "3 h", "2 d", ou data curta). */
function tempoRelativo(iso: string): string {
  const agora = Date.now();
  const quando = new Date(iso).getTime();
  const seg = Math.max(0, Math.floor((agora - quando) / 1000));
  if (seg < 60) return "agora";
  const min = Math.floor(seg / 60);
  if (min < 60) return `${min} min`;
  const hora = Math.floor(min / 60);
  if (hora < 24) return `${hora} h`;
  const dia = Math.floor(hora / 24);
  if (dia < 7) return `${dia} d`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

const BADGE_TIPO: Record<string, { rotulo: string; variante: "destaque" | "lancamento" } | null> = {
  conquista: { rotulo: "Conquista", variante: "destaque" },
  dica: { rotulo: "Dica", variante: "lancamento" },
  imovel: null,
  geral: null,
};

export function PostCard({ post }: { post: PostFeed }) {
  const router = useRouter();
  const [curtido, setCurtido] = useState(post.curtidoPorMim);
  const [total, setTotal] = useState(post.curtidas);
  const [pendente, iniciar] = useTransition();

  function alternarCurtida() {
    const proximo = !curtido;
    // Otimista: alterna estado + contador antes da ida ao servidor.
    setCurtido(proximo);
    setTotal((t) => Math.max(0, t + (proximo ? 1 : -1)));
    iniciar(async () => {
      const res = proximo ? await curtirAction(post.id) : await descurtirAction(post.id);
      if (!res.ok) {
        setCurtido(!proximo);
        setTotal((t) => Math.max(0, t + (proximo ? -1 : 1)));
        return;
      }
      router.refresh();
    });
  }

  const inicial = (post.autorNome.trim()[0] ?? "?").toUpperCase();
  const badge = BADGE_TIPO[post.tipo];

  return (
    <article className="rounded-2xl border border-border bg-surface-card p-4 shadow-soft sm:p-5">
      <header className="flex items-start gap-3">
        {post.autorFotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.autorFotoUrl}
            alt={post.autorNome}
            className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-border"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand-strong ring-1 ring-brand/20"
          >
            {inicial}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate font-semibold text-foreground">{post.autorNome}</span>
            {badge && <Badge variante={badge.variante}>{badge.rotulo}</Badge>}
          </div>
          <p className="mt-0.5 truncate text-xs text-subtle">
            {post.autorOrg ? `${post.autorOrg} · ` : ""}
            {tempoRelativo(post.criadoEm)}
          </p>
        </div>

        {!post.souAutor && (
          <BotaoSeguir perfilId={post.autorId} seguindo={post.seguindoAutor} />
        )}
      </header>

      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-foreground">
        {post.conteudo}
      </p>

      {post.imovel && (
        <Link
          href="/imoveis"
          className="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full border border-border-strong bg-surface px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-brand/40 hover:text-foreground"
        >
          <Building2 size={13} className="text-brand" aria-hidden="true" />
          <span className="truncate">Imóvel: {post.imovel.titulo}</span>
        </Link>
      )}

      <footer className="mt-4 flex items-center gap-3 border-t border-border pt-3">
        <button
          type="button"
          onClick={alternarCurtida}
          disabled={pendente}
          aria-pressed={curtido}
          aria-label={curtido ? "Remover curtida" : "Curtir"}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 ${
            curtido
              ? "bg-brand-soft text-brand-strong"
              : "text-muted hover:bg-surface hover:text-foreground"
          }`}
        >
          <Heart
            size={16}
            aria-hidden="true"
            className={curtido ? "fill-current" : ""}
          />
          <span className="tabular-nums">{total}</span>
        </button>
      </footer>
    </article>
  );
}
