// Experiência do cliente no mobile: pós-login, a tela inicial é o CATÁLOGO de
// imóveis disponíveis (lê de `imoveis` via Supabase; RLS limita a status
// 'disponivel'). Ao tocar num card, abre a FICHA com fotos, descrição e — se o
// imóvel tiver esquema de pagamento — a simulação "Compre do seu jeito" via
// @mobia/core. A "prova do motor" (H-01/H-04) segue acessível por uma aba.

import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { Session } from "@supabase/supabase-js";
import { formatarReais, obterParametrosAtuais, recalcularPlano } from "@mobia/core";
import type {
  EsquemaPagamento,
  Modalidade,
  ParametrosFinanceiros,
  PlanoPagamentoRecalculado,
  TipoImovel,
} from "@mobia/domain";
import { supabase } from "./lib/supabase";

// --- Prova do motor (H-01) — cenário de demonstração preservado ------------
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

function valorDaParcelaMensal(plano: PlanoPagamentoRecalculado): number {
  return plano.cronograma.find((item) => item.tipo === "parcela")?.valor ?? 0;
}

// --- Catálogo/Ficha — dados do banco ---------------------------------------

// Linha crua da tabela `imoveis` (snake_case). RLS já filtra por org/status.
interface ImovelRow {
  id: string;
  org_id: string;
  tipo: string | null;
  cidade: string;
  uf: string;
  valor: number;
  status: string;
  descricao: string | null;
  fotos: string[];
  plantas: string[];
  modalidades_elegiveis: string[];
  esquema_pagamento: EsquemaPagamentoJson | null;
}

// O jsonb `esquema_pagamento` guarda as regras do empreendimento SEM os
// identificadores (id/orgId/imovelId), que reconstruímos a partir da linha.
type EsquemaPagamentoJson = Omit<EsquemaPagamento, "id" | "orgId" | "imovelId">;

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";

/**
 * URL pública de uma foto: usa a URL direta quando já é http; caso contrário
 * monta o caminho no bucket público `imoveis-fotos`.
 */
function urlDaFoto(caminho: string | undefined): string | undefined {
  if (!caminho) return undefined;
  if (/^https?:\/\//.test(caminho)) return caminho;
  return `${SUPABASE_URL}/storage/v1/object/public/imoveis-fotos/${caminho}`;
}

function tituloDoImovel(imovel: ImovelRow): string {
  const tipo = imovel.tipo ? imovel.tipo[0]!.toUpperCase() + imovel.tipo.slice(1) : "Imóvel";
  return `${tipo} em ${imovel.cidade}`;
}

const FILTROS_TIPO: Array<{ valor: TipoImovel | "todos"; rotulo: string }> = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "apartamento", rotulo: "Apartamentos" },
  { valor: "casa", rotulo: "Casas" },
  { valor: "terreno", rotulo: "Terrenos" },
];

function TelaCatalogo({ onAbrirFicha }: { onAbrirFicha: (imovel: ImovelRow) => void }) {
  const [imoveis, setImoveis] = useState<ImovelRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<TipoImovel | "todos">("todos");

  useEffect(() => {
    let ativo = true;
    (async () => {
      setCarregando(true);
      setErro(null);
      const { data, error } = await supabase
        .from("imoveis")
        .select(
          "id, org_id, tipo, cidade, uf, valor, status, descricao, fotos, plantas, modalidades_elegiveis, esquema_pagamento",
        )
        .eq("status", "disponivel")
        .order("valor", { ascending: true });
      if (!ativo) return;
      if (error) {
        setErro("Não foi possível carregar os imóveis. Tente novamente.");
      } else {
        setImoveis((data ?? []) as ImovelRow[]);
      }
      setCarregando(false);
    })();
    return () => {
      ativo = false;
    };
  }, []);

  const visiveis =
    filtroTipo === "todos" ? imoveis : imoveis.filter((i) => i.tipo === filtroTipo);

  return (
    <View style={styles.tela}>
      <View style={styles.cabecalho}>
        <Text style={styles.tituloTela}>Imóveis</Text>
        <Text style={styles.subtituloTela}>Monte sua própria compra.</Text>
      </View>

      <View style={styles.chipsLinha}>
        {FILTROS_TIPO.map((f) => {
          const ativo = filtroTipo === f.valor;
          return (
            <Pressable
              key={f.valor}
              style={[styles.chip, ativo && styles.chipAtivo]}
              onPress={() => setFiltroTipo(f.valor)}
            >
              <Text style={[styles.chipTexto, ativo && styles.chipTextoAtivo]}>{f.rotulo}</Text>
            </Pressable>
          );
        })}
      </View>

      {carregando ? (
        <View style={styles.centralizado}>
          <ActivityIndicator color="#18181b" />
        </View>
      ) : erro ? (
        <View style={styles.centralizado}>
          <Text style={styles.erro}>{erro}</Text>
        </View>
      ) : (
        <FlatList
          data={visiveis}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listaConteudo}
          ListEmptyComponent={
            <View style={styles.centralizado}>
              <Text style={styles.vazio}>Nenhum imóvel disponível nesta categoria.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const foto = urlDaFoto(item.fotos[0]);
            return (
              <Pressable style={styles.cardImovel} onPress={() => onAbrirFicha(item)}>
                {foto ? (
                  <Image source={{ uri: foto }} style={styles.cardFoto} resizeMode="cover" />
                ) : (
                  <View style={[styles.cardFoto, styles.cardFotoVazia]}>
                    <Text style={styles.cardFotoVaziaTexto}>Sem foto</Text>
                  </View>
                )}
                <View style={styles.cardCorpo}>
                  <Text style={styles.cardTituloImovel}>{tituloDoImovel(item)}</Text>
                  <Text style={styles.cardLocal}>
                    {item.cidade} — {item.uf}
                  </Text>
                  <Text style={styles.cardValor}>{formatarReais(item.valor)}</Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

function TelaFicha({ imovel, onVoltar }: { imovel: ImovelRow; onVoltar: () => void }) {
  const parametros = obterParametrosAtuais();
  const esquemaJson = imovel.esquema_pagamento;

  let simulacao:
    | { plano: PlanoPagamentoRecalculado; entrada: number; parcelas: number }
    | { erro: string }
    | null = null;

  if (esquemaJson) {
    const esquema: EsquemaPagamento = {
      ...esquemaJson,
      id: `${imovel.id}-esquema`,
      orgId: imovel.org_id,
      imovelId: imovel.id,
    };
    const modalidade = esquema.modalidade as Modalidade;
    const config = parametros.modalidades[modalidade];
    // Entrada padrão = mínimo exigido pelo esquema do empreendimento.
    const entrada = Math.round(imovel.valor * esquema.percentualMinimoAto);
    const resultado = recalcularPlano({
      valorImovel: imovel.valor,
      esquema,
      entradaEscolhida: entrada,
      financiamento: {
        taxaAnual: config.taxaAnualEfetiva,
        prazoMeses: config.prazoMaxMeses,
        sistema: config.sistemaAmortizacaoPadrao,
      },
    });
    simulacao = resultado.ok
      ? { plano: resultado.plano, entrada, parcelas: esquema.numeroParcelasMensais }
      : { erro: "Não foi possível montar a simulação para este imóvel." };
  }

  return (
    <View style={styles.tela}>
      <View style={styles.fichaBarra}>
        <Pressable style={styles.voltarBotao} onPress={onVoltar}>
          <Text style={styles.voltarTexto}>‹ Voltar</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.fichaConteudo}>
        {imovel.fotos.length > 0 ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.galeria}
          >
            {imovel.fotos.map((caminho) => (
              <Image
                key={caminho}
                source={{ uri: urlDaFoto(caminho) }}
                style={styles.galeriaFoto}
                resizeMode="cover"
              />
            ))}
          </ScrollView>
        ) : (
          <View style={[styles.galeriaFoto, styles.cardFotoVazia]}>
            <Text style={styles.cardFotoVaziaTexto}>Sem fotos</Text>
          </View>
        )}

        <View style={styles.fichaCabecalho}>
          <Text style={styles.fichaTitulo}>{tituloDoImovel(imovel)}</Text>
          <Text style={styles.fichaLocal}>
            {imovel.cidade} — {imovel.uf}
          </Text>
          <Text style={styles.fichaValor}>{formatarReais(imovel.valor)}</Text>
        </View>

        {imovel.descricao ? (
          <Text style={styles.fichaDescricao}>{imovel.descricao}</Text>
        ) : null}

        {simulacao === null ? (
          <View style={styles.card}>
            <Text style={styles.cardTitulo}>Simulação</Text>
            <Text style={styles.cardDescricao}>
              Este imóvel ainda não tem um plano de pagamento configurado.
            </Text>
          </View>
        ) : "erro" in simulacao ? (
          <View style={styles.card}>
            <Text style={styles.cardTitulo}>Simulação</Text>
            <Text style={styles.erro}>{simulacao.erro}</Text>
          </View>
        ) : (
          <Simulacao dados={simulacao} parametros={parametros} />
        )}
      </ScrollView>
      <StatusBar style="auto" />
    </View>
  );
}

function Simulacao({
  dados,
  parametros,
}: {
  dados: { plano: PlanoPagamentoRecalculado; entrada: number; parcelas: number };
  parametros: ParametrosFinanceiros;
}) {
  const { plano, parcelas } = dados;
  const pos = plano.financiamentoPosChaves;
  const parcelaMensal = valorDaParcelaMensal(plano);

  const linhas: Array<{ rotulo: string; valor: string }> = [
    { rotulo: "Ato (entrada mínima)", valor: formatarReais(plano.resumo.totalAto) },
  ];
  if (parcelas > 0) {
    linhas.push({
      rotulo: "Parcelas mensais até as chaves",
      valor: `${parcelas}× de ${formatarReais(parcelaMensal)}`,
    });
  }
  if (plano.resumo.totalBaloes > 0) {
    linhas.push({ rotulo: "Balões (reforços)", valor: formatarReais(plano.resumo.totalBaloes) });
  }
  linhas.push({ rotulo: "Financiado nas chaves", valor: formatarReais(plano.valorFinanciado) });
  linhas.push({
    rotulo: `Parcela estimada (${pos.sistema.toUpperCase()}, ${pos.prazoMeses} meses)`,
    valor: formatarReais(pos.parcelaEstimada),
  });

  const timeline = [
    `Ato: ${formatarReais(plano.resumo.totalAto)}`,
    parcelas > 0 ? `${parcelas} parcelas mensais durante a obra` : null,
    plano.resumo.totalBaloes > 0 ? "Balões periódicos de reforço" : null,
    `Chaves: financia ${formatarReais(plano.valorFinanciado)} no banco`,
  ].filter((t): t is string => t !== null);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitulo}>Compre do seu jeito</Text>
      <Text style={styles.cardDescricao}>
        Estimativa com a entrada mínima do empreendimento, calculada via @mobia/core.
      </Text>

      {linhas.map((linha) => (
        <View key={linha.rotulo} style={styles.linha}>
          <Text style={styles.rotulo}>{linha.rotulo}</Text>
          <Text style={styles.valor}>{linha.valor}</Text>
        </View>
      ))}

      <View style={styles.timeline}>
        {timeline.map((passo, i) => (
          <Text key={passo} style={styles.timelinePasso}>
            {i + 1}. {passo}
          </Text>
        ))}
      </View>

      <Text style={styles.disclaimer}>
        Simulação estimativa (parâmetros {parametros.vigenciaInicio}, v{parametros.versao}) — não
        constitui proposta formal de crédito.
      </Text>
    </View>
  );
}

// --- Login (H-04) — preservado ---------------------------------------------

function TelaLogin() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  async function entrar() {
    setErro(null);
    setEntrando(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });
    if (error) {
      setErro("Não foi possível entrar. Verifique e-mail e senha e tente novamente.");
    }
    setEntrando(false);
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.titulo}>MobIA</Text>
      <Text style={styles.frase}>Entre para montar sua própria compra.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitulo}>Entrar</Text>

        <Text style={styles.campoRotulo}>E-mail</Text>
        <TextInput
          style={styles.campo}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="voce@exemplo.com.br"
          placeholderTextColor="#a1a1aa"
        />

        <Text style={styles.campoRotulo}>Senha</Text>
        <TextInput
          style={styles.campo}
          value={senha}
          onChangeText={setSenha}
          secureTextEntry
          autoComplete="password"
          placeholder="Sua senha"
          placeholderTextColor="#a1a1aa"
        />

        {erro ? <Text style={styles.erro}>{erro}</Text> : null}

        <Pressable
          style={[styles.botao, entrando && styles.botaoDesabilitado]}
          onPress={entrar}
          disabled={entrando}
        >
          <Text style={styles.botaoTexto}>{entrando ? "Entrando…" : "Entrar"}</Text>
        </Pressable>
      </View>

      <StatusBar style="auto" />
    </KeyboardAvoidingView>
  );
}

// --- Prova do motor (H-01) — preservada, agora em aba secundária ------------

function TelaProvaDoMotor() {
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
          Imóvel de {formatarReais(VALOR_IMOVEL)} com entrada de {formatarReais(ENTRADA)}, calculado
          via @mobia/core.
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

// --- Shell autenticado: catálogo → ficha, com aba da prova do motor --------

type Aba = "catalogo" | "motor";

function AppAutenticado({ sessao }: { sessao: Session }) {
  const [aba, setAba] = useState<Aba>("catalogo");
  const [imovelAberto, setImovelAberto] = useState<ImovelRow | null>(null);

  return (
    <View style={styles.appRoot}>
      <View style={styles.conteudoRoot}>
        {imovelAberto ? (
          <TelaFicha imovel={imovelAberto} onVoltar={() => setImovelAberto(null)} />
        ) : aba === "catalogo" ? (
          <TelaCatalogo onAbrirFicha={setImovelAberto} />
        ) : (
          <TelaProvaDoMotor />
        )}
      </View>

      <View style={styles.tabBar}>
        <Pressable
          style={styles.tabItem}
          onPress={() => {
            setImovelAberto(null);
            setAba("catalogo");
          }}
        >
          <Text style={[styles.tabTexto, aba === "catalogo" && !imovelAberto && styles.tabAtivo]}>
            Imóveis
          </Text>
        </Pressable>
        <Pressable
          style={styles.tabItem}
          onPress={() => {
            setImovelAberto(null);
            setAba("motor");
          }}
        >
          <Text style={[styles.tabTexto, aba === "motor" && !imovelAberto && styles.tabAtivo]}>
            Motor
          </Text>
        </Pressable>
        <Pressable style={styles.tabItem} onPress={() => supabase.auth.signOut()}>
          <Text style={styles.tabTexto}>Sair</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function App() {
  const [sessao, setSessao] = useState<Session | null>(null);
  const [sessaoCarregada, setSessaoCarregada] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session);
      setSessaoCarregada(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_evento, novaSessao) => {
      setSessao(novaSessao);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (!sessaoCarregada) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#18181b" />
        <StatusBar style="auto" />
      </View>
    );
  }

  if (!sessao) {
    return <TelaLogin />;
  }

  return <AppAutenticado sessao={sessao} />;
}

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
    backgroundColor: "#fafafa",
  },
  conteudoRoot: {
    flex: 1,
  },
  tela: {
    flex: 1,
    paddingTop: 56,
  },
  cabecalho: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  tituloTela: {
    fontSize: 28,
    fontWeight: "600",
    color: "#18181b",
  },
  subtituloTela: {
    marginTop: 2,
    fontSize: 14,
    color: "#52525b",
  },
  chipsLinha: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  chipAtivo: {
    backgroundColor: "#18181b",
    borderColor: "#18181b",
  },
  chipTexto: {
    fontSize: 13,
    fontWeight: "500",
    color: "#3f3f46",
  },
  chipTextoAtivo: {
    color: "#ffffff",
  },
  centralizado: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  vazio: {
    fontSize: 14,
    color: "#71717a",
    textAlign: "center",
  },
  listaConteudo: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 16,
  },
  cardImovel: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
  cardFoto: {
    width: "100%",
    height: 180,
    backgroundColor: "#f4f4f5",
  },
  cardFotoVazia: {
    alignItems: "center",
    justifyContent: "center",
  },
  cardFotoVaziaTexto: {
    fontSize: 13,
    color: "#a1a1aa",
  },
  cardCorpo: {
    padding: 16,
  },
  cardTituloImovel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#18181b",
  },
  cardLocal: {
    marginTop: 2,
    fontSize: 13,
    color: "#71717a",
  },
  cardValor: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: "600",
    color: "#18181b",
  },
  fichaBarra: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  voltarBotao: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  voltarTexto: {
    fontSize: 16,
    fontWeight: "600",
    color: "#18181b",
  },
  fichaConteudo: {
    paddingBottom: 32,
  },
  galeria: {
    width: "100%",
    height: 240,
  },
  galeriaFoto: {
    width: 360,
    maxWidth: "100%",
    height: 240,
    backgroundColor: "#f4f4f5",
  },
  fichaCabecalho: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  fichaTitulo: {
    fontSize: 22,
    fontWeight: "600",
    color: "#18181b",
  },
  fichaLocal: {
    marginTop: 2,
    fontSize: 14,
    color: "#71717a",
  },
  fichaValor: {
    marginTop: 8,
    fontSize: 22,
    fontWeight: "700",
    color: "#18181b",
  },
  fichaDescricao: {
    paddingHorizontal: 20,
    marginTop: 12,
    fontSize: 14,
    lineHeight: 21,
    color: "#3f3f46",
  },
  timeline: {
    marginTop: 12,
    gap: 4,
  },
  timelinePasso: {
    fontSize: 13,
    lineHeight: 19,
    color: "#3f3f46",
  },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#e4e4e7",
    backgroundColor: "#ffffff",
    paddingBottom: 24,
    paddingTop: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 6,
  },
  tabTexto: {
    fontSize: 13,
    fontWeight: "600",
    color: "#a1a1aa",
  },
  tabAtivo: {
    color: "#18181b",
  },
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
    marginTop: 20,
    marginHorizontal: 20,
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
  campoRotulo: {
    marginTop: 12,
    marginBottom: 4,
    fontSize: 13,
    color: "#71717a",
  },
  campo: {
    width: "100%",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    backgroundColor: "#fafafa",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#18181b",
  },
  erro: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 18,
    color: "#dc2626",
  },
  botao: {
    marginTop: 16,
    borderRadius: 10,
    backgroundColor: "#18181b",
    paddingVertical: 12,
    alignItems: "center",
  },
  botaoDesabilitado: {
    opacity: 0.6,
  },
  botaoTexto: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
  },
});
