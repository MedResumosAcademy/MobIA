// Banner de cookies (LGPD) — informativo e honesto: a plataforma usa APENAS
// cookies essenciais (sessão de autenticação). Renderizado pelo layout somente
// quando o cookie `imobia_cookies` ainda não existe (sem flash na volta).
// Ao aceitar, grava o cookie por 1 ano e some via estado local.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie } from "lucide-react";
import { Botao } from "@/components/ui/Botao";

export function BannerCookies() {
  const [visivel, setVisivel] = useState(true);
  const [entrou, setEntrou] = useState(false);

  // Animação sutil de entrada: começa transladado/transparente e sobe.
  useEffect(() => {
    const id = requestAnimationFrame(() => setEntrou(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (!visivel) {
    return null;
  }

  function aceitar() {
    document.cookie = "imobia_cookies=aceito; path=/; max-age=31536000; SameSite=Lax";
    setVisivel(false);
  }

  return (
    <div
      role="region"
      aria-label="Aviso de cookies"
      className={`fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:px-6 sm:pb-6 transition-[transform,opacity] duration-500 ease-out ${
        entrou ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      }`}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 rounded-2xl border border-border bg-surface-card p-4 shadow-soft sm:flex-row sm:items-center sm:gap-5 sm:p-5">
        <div className="flex flex-1 items-start gap-3">
          <span
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft"
            aria-hidden="true"
          >
            <Cookie size={18} strokeWidth={2} className="text-brand-strong" />
          </span>
          <p className="text-sm leading-relaxed text-muted">
            Usamos cookies essenciais para a plataforma funcionar — como manter você
            conectado. Sem rastreamento, sem venda de dados.{" "}
            <Link
              href="/privacidade"
              className="font-medium text-brand-strong underline underline-offset-2"
            >
              Política de Privacidade
            </Link>
          </p>
        </div>
        <Botao variante="primario" onClick={aceitar} className="shrink-0">
          Entendi e aceito
        </Botao>
      </div>
    </div>
  );
}
