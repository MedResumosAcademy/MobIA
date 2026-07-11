// HUB do CRM 2.0 (/corretor/crm) — layout próprio com a sub-navegação em
// pílulas (Contatos | Conversas | Campanhas | Funil | Conexão). O gate de
// papel (equipe da org) já é feito pelo layout de /corretor; aqui só damos a
// moldura visual comum. Cada página filha renderiza o próprio cabeçalho.

import type { Metadata } from "next";
import { NavCrm } from "./NavCrm";

export const metadata: Metadata = { title: "CRM" };

export default function LayoutCrm({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center bg-background px-6 py-16 font-sans">
      <div className="w-full max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-strong">
          Central de relacionamento
        </p>
        <div className="mt-3">
          <NavCrm />
        </div>
        <main className="mt-8">{children}</main>
      </div>
    </div>
  );
}
