// Landing mínima do MobIA (H-01): prova o DoD de que apps/web importa
// @mobia/core — a simulação do card roda no SERVIDOR (Server Component).

import { formatarReais, obterParametrosAtuais, recalcularPlano } from "@mobia/core";
import type { EsquemaPagamento, ParametrosFinanceiros } from "@mobia/domain";

// Cenário de demonstração: imóvel de R$ 320.000 com entrada de R$ 30.000.
// Valores de negócio (taxa, prazo, sistema) vêm dos parâmetros vigentes
// (obterParametrosAtuais — ponto único de acesso, H-05); o esquema abaixo é
// apenas o exemplo de empreendimento da prova.
const VALOR_IMOVEL = 32_000_000; // R$ 320.000,00 em centavos
const ENTRADA = 3_000_000; // R$ 30.000,00 em centavos

const esquemaDemo: EsquemaPagamento = {
  id: "00000000-0000-4000-8000-000000000001",
  orgId: "00000000-0000-4000-8000-00000000000f",
  imovelId: "00000000-0000-4000-8000-000000000002",
  modalidade: "mcmv",
  percentualMinimoAto: 0.05,
  numeroParcelasMensais: 36,
  parcelaMensal: { percentual: 0.005 },
  baloes: [],
};

function simularProvaDoMotor(parametros: ParametrosFinanceiros) {
  const mcmv = parametros.modalidades[esquemaDemo.modalidade];
  const resultado = recalcularPlano({
    valorImovel: VALOR_IMOVEL,
    esquema: esquemaDemo,
    entradaEscolhida: ENTRADA,
    financiamento: {
      taxaAnual: mcmv.taxaAnualEfetiva,
      prazoMeses: mcmv.prazoMaxMeses,
      sistema: mcmv.sistemaAmortizacaoPadrao,
    },
  });
  if (!resultado.ok) {
    throw new Error(`prova do motor falhou: ${resultado.erro.tipo}`);
  }
  return resultado.plano;
}

export default function Home() {
  const parametros = obterParametrosAtuais();
  const plano = simularProvaDoMotor(parametros);
  const { financiamentoPosChaves } = plano;

  const linhas: Array<{ rotulo: string; valor: string }> = [
    { rotulo: "Ato (entrada)", valor: formatarReais(plano.resumo.totalAto) },
    {
      rotulo: "Parcelas mensais até as chaves",
      valor: `${esquemaDemo.numeroParcelasMensais}× de ${formatarReais(
        plano.cronograma.find((item) => item.tipo === "parcela")?.valor ?? 0,
      )}`,
    },
    { rotulo: "Valor financiado nas chaves", valor: formatarReais(plano.valorFinanciado) },
    {
      rotulo: `Parcela estimada (${financiamentoPosChaves.sistema.toUpperCase()}, ${financiamentoPosChaves.prazoMeses} meses)`,
      valor: formatarReais(financiamentoPosChaves.parcelaEstimada),
    },
  ];

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-16 font-sans dark:bg-black">
      <main className="flex w-full max-w-xl flex-col items-center gap-10 text-center">
        <header className="flex flex-col gap-4">
          <h1 className="text-5xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            MobIA
          </h1>
          <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            O primeiro aplicativo que permite ao cliente montar sua própria compra.
          </p>
        </header>

        <section
          aria-label="Prova do motor"
          className="w-full rounded-2xl border border-zinc-200 bg-white p-8 text-left shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Prova do motor
          </h2>
          <p className="mt-1 text-base text-zinc-700 dark:text-zinc-300">
            Imóvel de {formatarReais(VALOR_IMOVEL)} com entrada de {formatarReais(ENTRADA)},
            calculado no servidor via <code className="font-mono">@mobia/core</code>.
          </p>

          <dl className="mt-6 flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
            {linhas.map((linha) => (
              <div key={linha.rotulo} className="flex items-baseline justify-between gap-4 py-3">
                <dt className="text-sm text-zinc-500 dark:text-zinc-400">{linha.rotulo}</dt>
                <dd className="text-base font-medium tabular-nums text-zinc-950 dark:text-zinc-50">
                  {linha.valor}
                </dd>
              </div>
            ))}
          </dl>

          <p className="mt-6 text-xs leading-5 text-zinc-400 dark:text-zinc-500">
            Simulação estimativa (parâmetros {parametros.vigenciaInicio}, v
            {parametros.versao}) — não constitui proposta formal de crédito.
          </p>
        </section>
      </main>
    </div>
  );
}
