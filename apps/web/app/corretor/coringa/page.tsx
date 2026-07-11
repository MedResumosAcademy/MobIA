// Coringa — tela do corretor (sob /corretor, já protegido pelo layout).
// "Não é CRM. Não é portal. É inteligência imobiliária." Server Component: só
// carrega os imóveis elegíveis da org e delega o cenário/resultado ao form
// client, que chama a Server Action gerarEstrategiasAction.

import type { Metadata } from "next";
import Link from "next/link";
import { WandSparkles } from "lucide-react";
import { EstadoVazio } from "@/components/EstadoVazio";
import { classesBotao } from "@/components/ui/Botao";
import { listarImoveisParaCoringa } from "@/lib/dados/coringa";
import { FormularioCoringa } from "./FormularioCoringa";

export const metadata: Metadata = { title: "Coringa" };

export default async function PaginaCoringa() {
  const imoveis = await listarImoveisParaCoringa();

  return (
    <div className="flex flex-1 flex-col items-center bg-background px-6 py-12 font-sans">
      <main className="w-full max-w-3xl">
        <div className="flex items-center justify-between gap-4">
          <header>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-strong">
              Inteligência imobiliária
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
              Coringa
            </h1>
            <p className="mt-1 max-w-xl text-muted">
              Dado o cenário do cliente, o Coringa calcula o enquadramento e
              ranqueia as jogadas que viabilizam a compra ou aliviam a parcela.
            </p>
          </header>
          <Link href="/corretor" className={classesBotao("fantasma", "sm")}>
            ← Painel
          </Link>
        </div>

        {imoveis.length === 0 ? (
          <EstadoVazio
            className="mt-8"
            icone={<WandSparkles className="h-6 w-6" aria-hidden />}
            titulo="Nenhum imóvel elegível ainda"
            descricao="Cadastre um imóvel e defina as modalidades de pagamento — o Coringa entra em jogo a partir daí."
            cta={{ href: "/corretor/imoveis/novo", rotulo: "Cadastrar imóvel" }}
          />
        ) : (
          <div className="mt-8">
            <FormularioCoringa imoveis={imoveis} />
          </div>
        )}
      </main>
    </div>
  );
}
