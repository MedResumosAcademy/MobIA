// Prova do DoD de H-01 no mobile: apps/mobile importa @mobia/core e roda a
// MESMA simulação da web (imóvel de R$ 320.000, entrada de R$ 30.000).

import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import { formatarReais, obterParametrosAtuais, recalcularPlano } from "@mobia/core";
import type {
  EsquemaPagamento,
  ParametrosFinanceiros,
  PlanoPagamentoCalculado,
} from "@mobia/domain";

// Cenário de demonstração — valores de negócio (taxa, prazo, sistema) vêm dos
// parâmetros vigentes (obterParametrosAtuais — ponto único de acesso, H-05);
// o esquema abaixo é o exemplo de empreendimento.
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

function valorDaParcelaMensal(plano: PlanoPagamentoCalculado): number {
  return plano.cronograma.find((item) => item.tipo === "parcela")?.valor ?? 0;
}

export default function App() {
  const parametros = obterParametrosAtuais();
  const plano = simularProvaDoMotor(parametros);
  const pos = plano.financiamentoPosChaves;

  const linhas: Array<{ rotulo: string; valor: string }> = [
    { rotulo: "Ato (entrada)", valor: formatarReais(plano.resumo.totalAto) },
    {
      rotulo: "Parcelas mensais até as chaves",
      valor: `${esquemaDemo.numeroParcelasMensais}× de ${formatarReais(valorDaParcelaMensal(plano))}`,
    },
    { rotulo: "Valor financiado nas chaves", valor: formatarReais(plano.valorFinanciado) },
    {
      rotulo: `Parcela estimada (${pos.sistema.toUpperCase()}, ${pos.prazoMeses} meses)`,
      valor: formatarReais(pos.parcelaEstimada),
    },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>MobIA</Text>
      <Text style={styles.frase}>
        O primeiro aplicativo que permite ao cliente montar sua própria compra.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitulo}>Prova do motor</Text>
        <Text style={styles.cardDescricao}>
          Imóvel de {formatarReais(VALOR_IMOVEL)} com entrada de {formatarReais(ENTRADA)},
          calculado via @mobia/core.
        </Text>

        {linhas.map((linha) => (
          <View key={linha.rotulo} style={styles.linha}>
            <Text style={styles.rotulo}>{linha.rotulo}</Text>
            <Text style={styles.valor}>{linha.valor}</Text>
          </View>
        ))}

        <Text style={styles.disclaimer}>
          Simulação estimativa (parâmetros {parametros.vigenciaInicio}, v
          {parametros.versao}) — não constitui proposta formal de crédito.
        </Text>
      </View>

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fafafa",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  titulo: {
    fontSize: 40,
    fontWeight: "600",
    color: "#18181b",
  },
  frase: {
    marginTop: 8,
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    color: "#52525b",
  },
  card: {
    marginTop: 32,
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    backgroundColor: "#ffffff",
    padding: 20,
  },
  cardTitulo: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#71717a",
  },
  cardDescricao: {
    marginTop: 4,
    marginBottom: 12,
    fontSize: 14,
    lineHeight: 20,
    color: "#3f3f46",
  },
  linha: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#f4f4f5",
  },
  rotulo: {
    flexShrink: 1,
    fontSize: 13,
    color: "#71717a",
  },
  valor: {
    fontSize: 15,
    fontWeight: "500",
    color: "#18181b",
  },
  disclaimer: {
    marginTop: 12,
    fontSize: 11,
    lineHeight: 16,
    color: "#a1a1aa",
  },
});
