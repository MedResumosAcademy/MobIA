// Ficha do imóvel (E2 — H-10/H-11). Server Component: galeria, planta,
// localização, valor, descrição, unidades e — quando há esquema_pagamento —
// simulação do plano padrão calculada pelo @mobia/core com parâmetros vigentes.

import { formatarReais, recalcularPlano } from "@mobia/core";
import type {
  CategoriaImovel,
  EsquemaPagamento,
  Modalidade,
  ParametrosFinanceiros,
  TipoImovel,
} from "@mobia/domain";
import type { Metadata } from "next";
import { ChevronRight, FileText, MapPin, Sparkles } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BotaoFavoritar } from "@/components/BotaoFavoritar";
import { FichaGaleria } from "@/components/FichaGaleria";
import { FichaLocalizacao } from "@/components/FichaLocalizacao";
import {
  SimuladorCompra,
  type OpcaoModalidade,
} from "@/components/SimuladorCompra";
import { AtributosImovel } from "@/components/ui/AtributosImovel";
import { Badge, type VarianteBadge } from "@/components/ui/Badge";
import { classesBotao } from "@/components/ui/Botao";
import { registrarEvento } from "@/lib/dados/eventos";
import { idsFavoritos } from "@/lib/dados/favoritos";
import { obterImovel, type ImovelDetalhe } from "@/lib/dados/imoveis";
import { obterParametrosVigentesDoBanco } from "@/lib/parametros";

// H-05: parâmetros vêm do banco a cada request — sem cache de build.
export const dynamic = "force-dynamic";

const ROTULO_MODALIDADE: Record<Modalidade, string> = {
  mcmv: "Minha Casa Minha Vida",
  sbpe: "SBPE",
  credito_associativo: "Crédito associativo",
  imovel_novo: "Imóvel novo",
  imovel_usado: "Imóvel usado",
  terreno_e_construcao: "Terreno e construção",
};

const ROTULOS_TIPO: Record<TipoImovel, string> = {
  casa: "Casa",
  apartamento: "Apartamento",
  terreno: "Terreno",
};

const ROTULOS_CATEGORIA: Record<CategoriaImovel, string> = {
  lancamento: "Lançamento",
  alto_padrao: "Alto padrão",
  mcmv: "Minha Casa Minha Vida",
};

const VARIANTE_CATEGORIA: Record<CategoriaImovel, VarianteBadge> = {
  lancamento: "lancamento",
  alto_padrao: "alto_padrao",
  mcmv: "mcmv",
};

type ParamsFicha = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: ParamsFicha): Promise<Metadata> {
  const { id } = await params;
  const imovel = await obterImovel(id);
  if (!imovel) {
    return { title: "Imóvel não encontrado — MobIA" };
  }
  return { title: `${imovel.titulo} — MobIA` };
}

function ehPdf(url: string): boolean {
  return /\.pdf(\?|$)/i.test(url);
}

type ConfigSimulador = {
  valorImovel: number;
  esquema: EsquemaPagamento;
  entradaMinima: number;
  entradaMaxima: number;
  opcoesModalidade: OpcaoModalidade[];
};

/** Monta a config serializável do simulador interativo "Compre do seu jeito".
 *  Retorna null quando não há esquema (fallback "Condições sob consulta"). */
function montarConfigSimulador(
  imovel: ImovelDetalhe,
  parametros: ParametrosFinanceiros,
): ConfigSimulador | null {
  // O jsonb persistido não guarda id/orgId/imovelId (anti-forja); o motor não os
  // lê. Completamos os campos derivados a partir do imóvel só para satisfazer o
  // tipo EsquemaPagamento esperado por recalcularPlano/SimuladorCompra.
  const armazenado = imovel.esquemaPagamento;
  if (!armazenado) {
    return null;
  }
  const esquema: EsquemaPagamento = {
    id: imovel.id,
    orgId: imovel.orgId,
    imovelId: imovel.id,
    ...armazenado,
  };

  // entradaMinima = round(valor × percentualMinimoAto). entradaMaxima = valor −
  // (Σparcelas + Σbalões) para que o financiado nunca fique negativo. Derivamos
  // ambos chamando o motor na entrada mínima (invariante garante a soma).
  const entradaMinima = Math.round(imovel.valor * esquema.percentualMinimoAto);
  const modalidadeBase = parametros.modalidades[esquema.modalidade];
  const base = recalcularPlano({
    valorImovel: imovel.valor,
    esquema,
    entradaEscolhida: entradaMinima,
    financiamento: {
      taxaAnual: modalidadeBase.taxaAnualEfetiva,
      prazoMeses: modalidadeBase.prazoMaxMeses,
      sistema: modalidadeBase.sistemaAmortizacaoPadrao,
    },
  });
  if (!base.ok) {
    return null;
  }
  const { totalParcelas, totalBaloes } = base.plano.resumo;
  const entradaMaxima = imovel.valor - (totalParcelas + totalBaloes);

  // opcoesModalidade: a do esquema + demais elegíveis do imóvel que existam nos
  // parâmetros. A do esquema sempre entra primeiro (estado inicial do simulador).
  const modalidadesElegiveis = new Set<Modalidade>([
    esquema.modalidade,
    ...imovel.modalidadesElegiveis,
  ]);
  const opcoesModalidade: OpcaoModalidade[] = [...modalidadesElegiveis]
    .filter((m) => parametros.modalidades[m] !== undefined)
    .map((m): OpcaoModalidade => {
      const cfg = parametros.modalidades[m];
      return {
        modalidade: m,
        rotulo: ROTULO_MODALIDADE[m],
        taxaAnual: cfg.taxaAnualEfetiva,
        prazoMeses: cfg.prazoMaxMeses,
        sistema: cfg.sistemaAmortizacaoPadrao,
      };
    });

  return { valorImovel: imovel.valor, esquema, entradaMinima, entradaMaxima, opcoesModalidade };
}

export default async function FichaImovel({ params }: ParamsFicha) {
  const { id } = await params;
  const imovel = await obterImovel(id);
  if (!imovel) {
    notFound();
  }

  // Sinal de interesse (E7) — no-op se anônimo/corretor.
  await registrarEvento("visita_ficha", { imovelId: imovel.id });

  const parametros = await obterParametrosVigentesDoBanco();
  const favoritos = await idsFavoritos(); // vazio se anônimo
  const configSimulador = montarConfigSimulador(imovel, parametros);
  const modalidadeRotulo = imovel.esquemaPagamento
    ? ROTULO_MODALIDADE[imovel.esquemaPagamento.modalidade]
    : null;

  const rotuloTipo = imovel.tipo ? ROTULOS_TIPO[imovel.tipo] : "Imóvel";
  const categoria = imovel.categorias[0] ?? null;
  const enderecoLinha = imovel.endereco
    ? `${imovel.endereco} · ${imovel.cidade}/${imovel.uf}`
    : `${imovel.cidade}/${imovel.uf}`;

  return (
    <div className="flex flex-1 flex-col items-center bg-surface-muted px-4 py-8 font-sans sm:px-6 sm:py-10">
      <div className="flex w-full max-w-6xl flex-col gap-6">
        {/* Breadcrumb */}
        <nav aria-label="Navegação" className="flex items-center gap-1.5 text-sm text-subtle">
          <Link href="/imoveis" className="rounded hover:text-foreground">
            Comprar
          </Link>
          <ChevronRight size={14} className="shrink-0" aria-hidden="true" />
          <span className="line-clamp-1 text-muted">{imovel.titulo}</span>
        </nav>

        {/* Cabeçalho */}
        <header className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {categoria ? (
              <Badge variante={VARIANTE_CATEGORIA[categoria]}>
                {ROTULOS_CATEGORIA[categoria]}
              </Badge>
            ) : (
              <Badge variante="neutro">{rotuloTipo}</Badge>
            )}
            {imovel.condicao && <Badge variante="neutro">{imovel.condicao}</Badge>}
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {imovel.titulo}
          </h1>
          <p className="flex items-start gap-1.5 text-base text-muted">
            <MapPin size={18} className="mt-0.5 shrink-0 text-subtle" aria-hidden="true" strokeWidth={1.8} />
            <span>{enderecoLinha}</span>
          </p>
        </header>

        {/* Galeria em destaque */}
        <FichaGaleria fotos={imovel.fotos} titulo={imovel.titulo} />

        {/* Layout 2 colunas: conteúdo à esquerda, card sticky à direita */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* ESQUERDA — conteúdo */}
          <div className="flex min-w-0 flex-col gap-10">
            {/* Grade de atributos destacada */}
            <AtributosImovel
              areaUtil={imovel.areaUtil}
              quartos={imovel.quartos}
              banheiros={imovel.banheiros}
              vagas={imovel.vagas}
              variante="ficha"
              className="rounded-2xl border border-border bg-surface px-5 py-4 shadow-sm !gap-x-6 !gap-y-2 text-base !text-foreground"
            />

            {imovel.descricao && (
              <section className="flex flex-col gap-3">
                <h2 className="text-lg font-semibold text-foreground">Sobre o imóvel</h2>
                <p className="whitespace-pre-line text-base leading-7 text-muted">
                  {imovel.descricao}
                </p>
              </section>
            )}

            {imovel.unidades.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className="text-lg font-semibold text-foreground">
                  Unidades disponíveis
                </h2>
                <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-surface-muted text-subtle">
                      <tr>
                        <th className="px-4 py-2.5 font-medium">Unidade</th>
                        <th className="px-4 py-2.5 font-medium">Andar</th>
                        <th className="px-4 py-2.5 text-right font-medium">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {imovel.unidades.map((u) => (
                        <tr key={u.id}>
                          <td className="px-4 py-2.5 font-medium text-foreground">
                            {u.identificador}
                          </td>
                          <td className="px-4 py-2.5 text-muted">{u.andar ?? "—"}</td>
                          <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-foreground">
                            {formatarReais(u.valor)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold text-foreground">Localização</h2>
              <FichaLocalizacao
                endereco={imovel.endereco}
                cidade={imovel.cidade}
                uf={imovel.uf}
                lat={imovel.lat}
                lng={imovel.lng}
              />
            </section>

            {imovel.plantas.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className="text-lg font-semibold text-foreground">Planta</h2>
                <ul className="flex flex-col gap-3">
                  {imovel.plantas.map((url, i) =>
                    ehPdf(url) ? (
                      <li key={url}>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-brand shadow-sm hover:bg-surface-muted"
                        >
                          <FileText size={16} aria-hidden="true" />
                          Abrir planta {imovel.plantas.length > 1 ? i + 1 : ""} (PDF)
                        </a>
                      </li>
                    ) : (
                      <li key={url}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`Planta ${i + 1} — ${imovel.titulo}`}
                          className="w-full rounded-2xl border border-border object-contain"
                        />
                      </li>
                    ),
                  )}
                </ul>
              </section>
            )}
          </div>

          {/* DIREITA — card sticky de preço + CTAs */}
          <aside className="lg:sticky lg:top-24 lg:h-fit">
            <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6 shadow-sm">
              <div className="flex flex-col gap-1">
                <span className="text-sm text-subtle">Valor do imóvel</span>
                <p className="text-3xl font-bold tabular-nums text-foreground">
                  {formatarReais(imovel.valor)}
                </p>
                {modalidadeRotulo && (
                  <p className="mt-1 text-sm text-muted">
                    Elegível para{" "}
                    <span className="font-medium text-brand">{modalidadeRotulo}</span>
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2.5">
                {configSimulador !== null && (
                  <a
                    href="#simulador"
                    className={classesBotao("primario", "lg", "w-full")}
                  >
                    <Sparkles size={18} aria-hidden="true" />
                    Simular financiamento
                  </a>
                )}
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `Tenho interesse no imóvel: ${imovel.titulo}`,
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={classesBotao("secundario", "lg", "w-full")}
                >
                  Falar com corretor
                </a>
              </div>

              <div className="border-t border-border pt-4">
                <BotaoFavoritar
                  imovelId={imovel.id}
                  inicialFavoritado={favoritos.has(imovel.id)}
                  variante="ficha"
                />
              </div>
            </div>
          </aside>
        </div>

        {/* SIMULADOR — protagonismo: seção destacada full-width */}
        <section
          id="simulador"
          aria-label="Simulação de pagamento"
          className="scroll-mt-24 overflow-hidden rounded-3xl border border-border bg-surface shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-brand-soft px-6 py-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-brand-contrast">
                <Sparkles size={20} aria-hidden="true" />
              </span>
              <div className="flex flex-col">
                <h2 className="text-xl font-bold text-foreground">Compre do seu jeito</h2>
                <p className="text-sm text-brand-soft-fg">
                  Ajuste a entrada e veja seu plano de pagamento na hora.
                </p>
              </div>
            </div>
            {modalidadeRotulo && <Badge variante="marca">{modalidadeRotulo}</Badge>}
          </div>

          <div className="p-6">
            {configSimulador === null ? (
              <p className="text-sm text-muted">
                Condições sob consulta. Fale com o corretor para montar seu plano de
                pagamento.
              </p>
            ) : (
              <SimuladorCompra
                valorImovel={configSimulador.valorImovel}
                esquema={configSimulador.esquema}
                entradaMinima={configSimulador.entradaMinima}
                entradaMaxima={configSimulador.entradaMaxima}
                opcoesModalidade={configSimulador.opcoesModalidade}
                rotuloParametros={{
                  vigenciaInicio: parametros.vigenciaInicio,
                  versao: parametros.versao,
                }}
                imovelId={imovel.id}
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
