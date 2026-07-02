// Rota /comparar?ids=a,b,c (E6 / H-20). Compara 2 a 3 imóveis lado a lado:
// preço, cidade/UF, tipo, modalidade e a PARCELA do plano padrão (entrada
// mínima do esquema, calculada por recalcularPlano do @mobia/core). Quando o
// imóvel não tem esquema de pagamento a parcela fica "sob consulta".
// RLS: obterImovel usa o client público — só retorna imóveis visíveis; ids
// inexistentes/ocultos simplesmente somem da comparação.

import { formatarReais, recalcularPlano } from "@mobia/core";
import type { Modalidade } from "@mobia/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { obterImovel, type ImovelDetalhe } from "@/lib/dados/imoveis";
import { obterParametrosVigentesDoBanco } from "@/lib/parametros";

export const metadata: Metadata = { title: "Comparar imóveis — MobIA" };

// Depende de parâmetros vigentes e RLS a cada request.
export const dynamic = "force-dynamic";

const ROTULO_MODALIDADE: Record<Modalidade, string> = {
  mcmv: "Minha Casa Minha Vida",
  sbpe: "SBPE",
  credito_associativo: "Crédito associativo",
  imovel_novo: "Imóvel novo",
  imovel_usado: "Imóvel usado",
  terreno_e_construcao: "Terreno e construção",
};

const ROTULO_TIPO: Record<string, string> = {
  casa: "Casa",
  apartamento: "Apartamento",
  terreno: "Terreno",
};

type ItemComparacao = {
  imovel: ImovelDetalhe;
  modalidade: Modalidade | null;
  /** Parcela do plano padrão (entrada mínima), em centavos; null = sob consulta. */
  parcela: number | null;
};

/** Parcela do financiamento pós-chaves no plano padrão (entrada mínima). */
function calcularParcelaPadrao(
  imovel: ImovelDetalhe,
  parametros: Awaited<ReturnType<typeof obterParametrosVigentesDoBanco>>,
): number | null {
  const armazenado = imovel.esquemaPagamento;
  if (!armazenado) {
    return null;
  }
  const esquema = {
    id: imovel.id,
    orgId: imovel.orgId,
    imovelId: imovel.id,
    ...armazenado,
  };
  const cfg = parametros.modalidades[esquema.modalidade];
  const entradaMinima = Math.round(imovel.valor * esquema.percentualMinimoAto);
  const r = recalcularPlano({
    valorImovel: imovel.valor,
    esquema,
    entradaEscolhida: entradaMinima,
    financiamento: {
      taxaAnual: cfg.taxaAnualEfetiva,
      prazoMeses: cfg.prazoMaxMeses,
      sistema: cfg.sistemaAmortizacaoPadrao,
    },
  });
  return r.ok ? r.plano.financiamentoPosChaves.parcelaEstimada : null;
}

function parseIds(bruto?: string): string[] {
  if (!bruto) return [];
  const ids = bruto
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  // Únicos, no máximo 3.
  return [...new Set(ids)].slice(0, 3);
}

export default async function PaginaComparar({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const { ids: idsBruto } = await searchParams;
  const ids = parseIds(idsBruto);

  const parametros = await obterParametrosVigentesDoBanco();
  const carregados = await Promise.all(ids.map((id) => obterImovel(id)));
  const itens: ItemComparacao[] = carregados
    .filter((i): i is ImovelDetalhe => i !== null)
    .map((imovel) => ({
      imovel,
      modalidade: imovel.esquemaPagamento?.modalidade ?? null,
      parcela: calcularParcelaPadrao(imovel, parametros),
    }));

  const suficiente = itens.length >= 2;

  // Destaques: menor preço e menor parcela (entre os que têm parcela).
  const menorPreco = suficiente
    ? Math.min(...itens.map((i) => i.imovel.valor))
    : null;
  const parcelas = itens
    .map((i) => i.parcela)
    .filter((p): p is number => p !== null);
  const menorParcela = parcelas.length > 0 ? Math.min(...parcelas) : null;

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 px-4 py-10 font-sans sm:px-6 dark:bg-black">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <nav>
          <Link
            href="/favoritos"
            className="text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            ← Voltar aos favoritos
          </Link>
        </nav>

        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Comparar imóveis
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Valores são estimativas com base no plano padrão (entrada mínima do
            esquema) e nos parâmetros vigentes.
          </p>
        </header>

        {!suficiente ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-20 text-center dark:border-zinc-700 dark:bg-zinc-950">
            <p className="text-lg font-medium text-zinc-700 dark:text-zinc-300">
              Selecione ao menos 2 imóveis para comparar
            </p>
            <p className="max-w-md text-sm text-zinc-500 dark:text-zinc-400">
              Volte aos favoritos e marque de 2 a 3 imóveis.
            </p>
            <Link
              href="/favoritos"
              className="mt-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Ir aos favoritos
            </Link>
          </div>
        ) : (
          <TabelaComparacao
            itens={itens}
            menorPreco={menorPreco}
            menorParcela={menorParcela}
          />
        )}
      </main>
    </div>
  );
}

function CelulaCabecalho({ item }: { item: ItemComparacao }) {
  const { imovel } = item;
  return (
    <th className="min-w-[180px] border-b border-zinc-200 p-4 text-left align-top dark:border-zinc-800">
      <Link href={`/imoveis/${imovel.id}`} className="flex flex-col gap-2">
        <div className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-900">
          {imovel.fotos[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imovel.fotos[0]}
              alt={imovel.titulo}
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
        <span className="text-sm font-semibold text-zinc-950 hover:underline dark:text-zinc-50">
          {imovel.titulo}
        </span>
      </Link>
    </th>
  );
}

function LinhaRotulo({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="row"
      className="whitespace-nowrap border-b border-zinc-100 bg-zinc-50 p-4 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
    >
      {children}
    </th>
  );
}

function TabelaComparacao({
  itens,
  menorPreco,
  menorParcela,
}: {
  itens: ItemComparacao[];
  menorPreco: number | null;
  menorParcela: number | null;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <td className="border-b border-zinc-200 p-4 dark:border-zinc-800" />
            {itens.map((item) => (
              <CelulaCabecalho key={item.imovel.id} item={item} />
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <LinhaRotulo>Preço</LinhaRotulo>
            {itens.map((item) => {
              const destaque =
                menorPreco !== null && item.imovel.valor === menorPreco;
              return (
                <td
                  key={item.imovel.id}
                  className="border-b border-zinc-100 p-4 align-top tabular-nums dark:border-zinc-800"
                >
                  <span
                    className={
                      destaque
                        ? "font-semibold text-emerald-700 dark:text-emerald-400"
                        : "text-zinc-900 dark:text-zinc-100"
                    }
                  >
                    {formatarReais(item.imovel.valor)}
                  </span>
                  {destaque && (
                    <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                      Menor preço
                    </span>
                  )}
                </td>
              );
            })}
          </tr>

          <tr>
            <LinhaRotulo>Cidade/UF</LinhaRotulo>
            {itens.map((item) => (
              <td
                key={item.imovel.id}
                className="border-b border-zinc-100 p-4 align-top text-zinc-700 dark:border-zinc-800 dark:text-zinc-300"
              >
                {item.imovel.cidade}/{item.imovel.uf}
              </td>
            ))}
          </tr>

          <tr>
            <LinhaRotulo>Tipo</LinhaRotulo>
            {itens.map((item) => (
              <td
                key={item.imovel.id}
                className="border-b border-zinc-100 p-4 align-top text-zinc-700 dark:border-zinc-800 dark:text-zinc-300"
              >
                {item.imovel.tipo ? ROTULO_TIPO[item.imovel.tipo] : "—"}
              </td>
            ))}
          </tr>

          <tr>
            <LinhaRotulo>Modalidade</LinhaRotulo>
            {itens.map((item) => (
              <td
                key={item.imovel.id}
                className="border-b border-zinc-100 p-4 align-top text-zinc-700 dark:border-zinc-800 dark:text-zinc-300"
              >
                {item.modalidade ? ROTULO_MODALIDADE[item.modalidade] : "—"}
              </td>
            ))}
          </tr>

          <tr>
            <LinhaRotulo>Parcela estimada</LinhaRotulo>
            {itens.map((item) => {
              const destaque =
                item.parcela !== null &&
                menorParcela !== null &&
                item.parcela === menorParcela;
              return (
                <td
                  key={item.imovel.id}
                  className="p-4 align-top tabular-nums dark:border-zinc-800"
                >
                  {item.parcela === null ? (
                    <span className="text-zinc-500 dark:text-zinc-400">
                      Sob consulta
                    </span>
                  ) : (
                    <>
                      <span
                        className={
                          destaque
                            ? "font-semibold text-emerald-700 dark:text-emerald-400"
                            : "text-zinc-900 dark:text-zinc-100"
                        }
                      >
                        {formatarReais(item.parcela)}/mês
                      </span>
                      {destaque && (
                        <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                          Menor parcela
                        </span>
                      )}
                    </>
                  )}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
