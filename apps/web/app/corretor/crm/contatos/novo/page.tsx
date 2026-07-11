// NOVO CONTATO (CRM 2.0) — casca Server Component do formulário client. O gate
// de papel (equipe) é o do layout /corretor; a action valida de novo no server.

import type { Metadata } from "next";
import Link from "next/link";
import { FormularioContato } from "../FormularioContato";

export const metadata: Metadata = { title: "Novo contato" };
export const dynamic = "force-dynamic";

export default function PaginaNovoContato() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <Link
        href="/corretor/crm"
        className="text-sm text-muted transition-colors hover:text-brand-strong"
      >
        ← Voltar aos contatos
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
        Novo contato
      </h1>
      <p className="mt-1 text-muted">
        Cadastre a pessoa uma vez e acompanhe conversas, negócios e campanhas na
        mesma ficha.
      </p>
      <FormularioContato />
    </div>
  );
}
