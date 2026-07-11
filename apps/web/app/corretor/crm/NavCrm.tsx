"use client";

// Sub-navegação do hub CRM em pílulas (Contatos | Conversas | Campanhas |
// Templates | Treinar IA | Conexão | Funil). Client FOLHA (usePathname) para o
// layout continuar Server Component. "Funil" é um atalho para o kanban de
// negócios (fora do hub) e por isso nunca acende aqui. aria-current marca a
// aba ativa.
//
// DECISÃO: 7 pílulas planas com flex-wrap (sem dropdown "IA & Modelos") —
// tudo fica a UM clique e o wrap resolve telas estreitas; um dropdown
// esconderia exatamente as telas novas que queremos que a equipe descubra.

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  Cable,
  KanbanSquare,
  LayoutTemplate,
  Megaphone,
  MessagesSquare,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";

type Aba = {
  href: string;
  rotulo: string;
  icone: ReactNode;
  /** Prefixos extras que também acendem a aba (ex.: a ficha do contato). */
  cobreTambem?: string[];
  /** Prefixos que pertencem a OUTRA aba (desambigua o hub raiz). */
  ignorar?: string[];
};

const PREFIXOS_IRMAOS = [
  "/corretor/crm/conversas",
  "/corretor/crm/campanhas",
  "/corretor/crm/templates",
  "/corretor/crm/treinar-ia",
  "/corretor/crm/conexao",
];

const ABAS: Aba[] = [
  {
    href: "/corretor/crm",
    rotulo: "Contatos",
    icone: <Users className="h-4 w-4" aria-hidden />,
    cobreTambem: ["/corretor/crm/contatos"],
    ignorar: PREFIXOS_IRMAOS,
  },
  {
    href: "/corretor/crm/conversas",
    rotulo: "Conversas",
    icone: <MessagesSquare className="h-4 w-4" aria-hidden />,
  },
  {
    href: "/corretor/crm/campanhas",
    rotulo: "Campanhas",
    icone: <Megaphone className="h-4 w-4" aria-hidden />,
  },
  {
    href: "/corretor/crm/templates",
    rotulo: "Templates",
    icone: <LayoutTemplate className="h-4 w-4" aria-hidden />,
  },
  {
    href: "/corretor/crm/treinar-ia",
    rotulo: "Treinar IA",
    icone: <Bot className="h-4 w-4" aria-hidden />,
  },
  {
    href: "/corretor/crm/conexao",
    rotulo: "Conexão",
    icone: <Cable className="h-4 w-4" aria-hidden />,
  },
  {
    href: "/corretor/negocios",
    rotulo: "Funil",
    icone: <KanbanSquare className="h-4 w-4" aria-hidden />,
  },
];

function cobre(pathname: string, prefixo: string): boolean {
  return pathname === prefixo || pathname.startsWith(`${prefixo}/`);
}

export function NavCrm() {
  const pathname = usePathname();

  return (
    <nav aria-label="Seções do CRM" className="flex flex-wrap gap-2">
      {ABAS.map((aba) => {
        const bate =
          cobre(pathname, aba.href) ||
          (aba.cobreTambem ?? []).some((p) => cobre(pathname, p));
        const ativo = bate && !(aba.ignorar ?? []).some((p) => cobre(pathname, p));
        return (
          <Link
            key={aba.href}
            href={aba.href}
            aria-current={ativo ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-[background-color,border-color,color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25 ${
              ativo
                ? "border-brand bg-brand text-brand-contrast shadow-[var(--shadow-soft)]"
                : "border-border-strong bg-surface-card text-muted hover:border-brand/50 hover:text-foreground"
            }`}
          >
            {aba.icone}
            {aba.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
