"use client";

// MENU MOBILE (hambúrguer) — visível só abaixo de md, onde a nav principal do
// header some. Reúne os mesmos links da nav desktop + atalhos de conta,
// conforme o papel do usuário (props resolvidas no Server Component do layout).
// Painel dropdown simples (useState), fecha ao clicar em qualquer link. pt-BR.

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

type Props = {
  ehCliente: boolean;
  ehProfissional: boolean;
  logado: boolean;
};

export function MenuMobile({ ehCliente, ehProfissional, logado }: Props) {
  const [aberto, setAberto] = useState(false);
  const fechar = () => setAberto(false);

  const linkMenu =
    "rounded-xl px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface";

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-label={aberto ? "Fechar menu" : "Abrir menu"}
        aria-expanded={aberto}
        className="flex items-center justify-center rounded-full p-2 text-foreground transition-colors hover:bg-surface"
      >
        {aberto ? (
          <X className="h-5 w-5" aria-hidden />
        ) : (
          <Menu className="h-5 w-5" aria-hidden />
        )}
      </button>

      {aberto && (
        <nav
          aria-label="Menu de navegação"
          className="absolute inset-x-0 top-full z-50 border-b border-border bg-background shadow-[var(--shadow-card)]"
        >
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-1 px-4 py-4 sm:px-6">
            <Link href="/imoveis" className={linkMenu} onClick={fechar}>
              Comprar
            </Link>
            <Link href="/sonhometro" className={linkMenu} onClick={fechar}>
              Sonhômetro
            </Link>
            <Link href="/mapa" className={linkMenu} onClick={fechar}>
              Mapa
            </Link>
            {ehProfissional && (
              <>
                <Link href="/corretor" className={linkMenu} onClick={fechar}>
                  Painel
                </Link>
                <Link href="/comunidade" className={linkMenu} onClick={fechar}>
                  Comunidade
                </Link>
                <Link href="/corretor/perfil" className={linkMenu} onClick={fechar}>
                  Meu perfil
                </Link>
              </>
            )}
            {ehCliente && (
              <>
                <Link href="/favoritos" className={linkMenu} onClick={fechar}>
                  Favoritos
                </Link>
                <Link href="/conta" className={linkMenu} onClick={fechar}>
                  Minha conta
                </Link>
              </>
            )}
            {!logado && (
              <Link href="/entrar" className={linkMenu} onClick={fechar}>
                Entrar
              </Link>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
