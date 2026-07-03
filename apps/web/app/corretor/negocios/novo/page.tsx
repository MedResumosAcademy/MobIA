// Criação de um NEGÓCIO (CRM). Form server-side simples: contato, imóvel-alvo
// opcional (select da carteira da org), valor e etapa inicial. A ação delega a
// lib/dados/negocios.criarNegocio (org/corretor da sessão). pt-BR; valor em R$.

import type { Metadata } from "next";
import Link from "next/link";
import { listarImoveisDaOrg } from "@/lib/dados/imoveis";
import { Botao } from "@/components/ui/Botao";
import { Campo, CampoSelect, GrupoCampo } from "@/components/ui/Campo";
import { criarNegocioAction } from "../acoes";
import { ETAPAS_ORDEM, ROTULO_ETAPA } from "../rotulos";

export const metadata: Metadata = { title: "Novo negócio" };
export const dynamic = "force-dynamic";

const MENSAGENS_ERRO: Record<string, string> = {
  invalido: "Dados inválidos. Revise os campos e tente novamente.",
  permissao: "Você não tem permissão para criar negócios.",
};

export default async function PaginaNovoNegocio({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const mensagemErro = erro ? (MENSAGENS_ERRO[erro] ?? MENSAGENS_ERRO.invalido) : null;
  const imoveis = await listarImoveisDaOrg();

  return (
    <div className="flex flex-1 flex-col items-center bg-background px-6 py-16 font-sans">
      <main className="w-full max-w-2xl">
        <Link
          href="/corretor/negocios"
          className="text-sm text-muted transition-colors hover:text-brand-strong"
        >
          ← Voltar ao funil
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
          Novo negócio
        </h1>

        {mensagemErro && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800"
          >
            {mensagemErro}
          </p>
        )}

        <form
          action={criarNegocioAction}
          className="mt-8 flex flex-col gap-5 rounded-2xl border border-border bg-surface-card p-6 shadow-[var(--shadow-soft)]"
        >
          <GrupoCampo rotulo="Nome do contato" htmlFor="nomeContato" obrigatorio>
            <Campo
              id="nomeContato"
              name="nomeContato"
              required
              placeholder="Ex.: Ana Souza"
            />
          </GrupoCampo>

          <div className="grid gap-5 sm:grid-cols-2">
            <GrupoCampo rotulo="Telefone" htmlFor="telefoneContato">
              <Campo
                id="telefoneContato"
                name="telefoneContato"
                type="tel"
                placeholder="(11) 90000-0000"
              />
            </GrupoCampo>
            <GrupoCampo rotulo="E-mail" htmlFor="emailContato">
              <Campo
                id="emailContato"
                name="emailContato"
                type="email"
                placeholder="ana@exemplo.com"
              />
            </GrupoCampo>
          </div>

          <GrupoCampo
            rotulo="Imóvel-alvo"
            htmlFor="imovelId"
            auxilio="Opcional — vincule um imóvel da sua carteira."
          >
            <CampoSelect id="imovelId" name="imovelId" defaultValue="">
              <option value="">Sem imóvel vinculado</option>
              {imoveis.map((imovel) => (
                <option key={imovel.id} value={imovel.id}>
                  {imovel.titulo}
                </option>
              ))}
            </CampoSelect>
          </GrupoCampo>

          <div className="grid gap-5 sm:grid-cols-2">
            <GrupoCampo rotulo="Valor (R$)" htmlFor="valor" auxilio="Opcional.">
              <Campo
                id="valor"
                name="valor"
                inputMode="decimal"
                placeholder="1.280.000,00"
              />
            </GrupoCampo>
            <GrupoCampo rotulo="Etapa inicial" htmlFor="etapa">
              <CampoSelect id="etapa" name="etapa" defaultValue="novo">
                {ETAPAS_ORDEM.map((etapa) => (
                  <option key={etapa} value={etapa}>
                    {ROTULO_ETAPA[etapa]}
                  </option>
                ))}
              </CampoSelect>
            </GrupoCampo>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Botao type="submit" variante="primario">
              Criar negócio
            </Botao>
            <Link
              href="/corretor/negocios"
              className="text-sm text-muted transition-colors hover:text-brand-strong"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
