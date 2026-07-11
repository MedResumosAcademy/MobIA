"use client";

// Link de navegação do header com indicação de página ativa. Client component
// FOLHA (usePathname) para o layout continuar Server Component: cada link vira
// um wrapper fino que compara a rota atual com o href. `ignorar` resolve
// prefixos ambíguos (ex.: "Painel" /corretor não deve acender em
// /corretor/perfil, que tem link próprio "Meu perfil").
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

function cobre(pathname: string, prefixo: string): boolean {
  return pathname === prefixo || pathname.startsWith(`${prefixo}/`);
}

export function NavLink({
  href,
  ignorar,
  className = "",
  children,
}: {
  href: string;
  /** Prefixos que, mesmo dentro de href, pertencem a outro link da nav. */
  ignorar?: string[];
  className?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const ativo =
    cobre(pathname, href) && !(ignorar ?? []).some((p) => cobre(pathname, p));

  return (
    <Link
      href={href}
      aria-current={ativo ? "page" : undefined}
      className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
        ativo
          ? "bg-surface text-foreground"
          : "text-muted hover:bg-surface hover:text-foreground"
      } ${className}`}
    >
      {children}
    </Link>
  );
}
