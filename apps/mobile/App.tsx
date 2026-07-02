// Experiência do cliente no mobile: pós-login, a tela inicial é o CATÁLOGO de
// imóveis disponíveis (lê de `imoveis` via Supabase; RLS limita a status
// 'disponivel'). Ao tocar num card, abre a FICHA com fotos, descrição e — se o
// imóvel tiver esquema de pagamento — a simulação "Compre do seu jeito" via
// @mobia/core. A "prova do motor" (H-01/H-04) segue acessível por uma aba.

import { useEffect, useMemo, useState } from "react";
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
import Slider from "@react-native-community/slider";
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

const ROTULO_MODALIDADE: Record<Modalidade, string> = {
  mcmv: "Minha Casa Minha Vida",
  sbpe: "SBPE",
  credito_associativo: "Crédito associativo",
  imovel_novo: "Imóvel novo",
  imovel_usado: "Imóvel usado",
  terreno_e_construcao: "Terreno e construção",
};

// Atalhos de valor de entrada (em centavos) sugeridos ao cliente. São clampeados
// para [entradaMinima, entradaMaxima] antes de recalcular, então nunca geram erro.
const ATALHOS_ENTRADA: Array<{ rotulo: string; valor: number }> = [
  { rotulo: "10 mil", valor: 1_000_000 },
  { rotulo: "20 mil", valor: 2_000_000 },
  { rotulo: "30 mil", valor: 3_000_000 },
  { rotulo: "50 mil", valor: 5_000_000 },
];

function clampear(valor: number, min: number, max: number): number {
  return Math.min(Math.max(valor, min), max);
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

  // Completa os identificadores de domínio (o jsonb persistido não os guarda).
  const esquema: EsquemaPagamento | null = esquemaJson
    ? {
        ...esquemaJson,
        id: `${imovel.id}-esquema`,
        orgId: imovel.org_id,
        imovelId: imovel.id,
      }
    : null;

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

        {esquema === null ? (
          <View style={styles.card}>
            <Text style={styles.cardTitulo}>Simulação</Text>
            <Text style={styles.cardDescricao}>
              Este imóvel ainda não tem um plano de pagamento configurado.
            </Text>
          </View>
        ) : (
          <SimulacaoInterativa
            imovel={imovel}
            esquema={esquema}
            parametros={parametros}
          />
        )}
      </ScrollView>
      <StatusBar style="auto" />
    </View>
  );
}

// --- Simulação interativa (H-12/13/14/15) ----------------------------------
//
// O cliente arrasta o slider de entrada e/ou troca a modalidade elegível; o
// plano recalcula em tempo real via recalcularPlano (síncrono, < 200ms).

/** Modalidades que o cliente pode escolher: as elegíveis do imóvel que o
 *  seed de parâmetros conhece. Sempre inclui a modalidade padrão do esquema. */
function modalidadesDisponiveis(
  imovel: ImovelRow,
  esquema: EsquemaPagamento,
  parametros: ParametrosFinanceiros,
): Modalidade[] {
  const conhecidas = new Set(Object.keys(parametros.modalidades));
  const elegiveis = imovel.modalidades_elegiveis.filter(
    (m): m is Modalidade => conhecidas.has(m),
  );
  const base = esquema.modalidade as Modalidade;
  const lista = elegiveis.length > 0 ? elegiveis : [base];
  return lista.includes(base) ? lista : [base, ...lista];
}

function SimulacaoInterativa({
  imovel,
  esquema,
  parametros,
}: {
  imovel: ImovelRow;
  esquema: EsquemaPagamento;
  parametros: ParametrosFinanceiros;
}) {
  const modalidades = useMemo(
    () => modalidadesDisponiveis(imovel, esquema, parametros),
    [imovel, esquema, parametros],
  );

  const [modalidade, setModalidade] = useState<Modalidade>(
    () => modalidades[0] ?? (esquema.modalidade as Modalidade),
  );

  // Faixa de entrada válida: min = round(valor × percentualMinimoAto);
  // max = valor − Σparcelas − Σbalões (financiado ≥ 0). Independem da modalidade.
  const { entradaMinima, entradaMaxima } = useMemo(() => {
    const min = Math.round(imovel.valor * esquema.percentualMinimoAto);
    const totalParcelas =
      esquema.parcelaMensal?.valor !== undefined
        ? esquema.parcelaMensal.valor * esquema.numeroParcelasMensais
        : esquema.parcelaMensal?.percentual !== undefined
          ? Math.round(
              imovel.valor * esquema.parcelaMensal.percentual * esquema.numeroParcelasMensais,
            )
          : 0;
    let totalBaloes = 0;
    for (const balao of esquema.baloes) {
      let ocorrencias = 0;
      for (let m = balao.periodicidadeMeses; m <= esquema.numeroParcelasMensais; m += balao.periodicidadeMeses) {
        ocorrencias += 1;
      }
      totalBaloes +=
        balao.valor !== undefined
          ? balao.valor * ocorrencias
          : balao.percentual !== undefined
            ? Math.round(imovel.valor * balao.percentual * ocorrencias)
            : 0;
    }
    const max = Math.max(min, imovel.valor - totalParcelas - totalBaloes);
    return { entradaMinima: min, entradaMaxima: max };
  }, [imovel.valor, esquema]);

  const [entrada, setEntrada] = useState<number>(entradaMinima);

  // Mantém a entrada dentro da faixa quando o imóvel/esquema muda.
  const entradaClampeada = clampear(entrada, entradaMinima, entradaMaxima);

  const resultado = useMemo(() => {
    const config = parametros.modalidades[modalidade];
    return recalcularPlano({
      valorImovel: imovel.valor,
      esquema: { ...esquema, modalidade },
      entradaEscolhida: entradaClampeada,
      financiamento: {
        taxaAnual: config.taxaAnualEfetiva,
        prazoMeses: config.prazoMaxMeses,
        sistema: config.sistemaAmortizacaoPadrao,
      },
    });
  }, [imovel.valor, esquema, modalidade, entradaClampeada, parametros]);

  if (!resultado.ok) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitulo}>Compre do seu jeito</Text>
        <Text style={styles.erro}>Não foi possível montar a simulação para este imóvel.</Text>
      </View>
    );
  }

  const plano = resultado.plano;
  const pos = plano.financiamentoPosChaves;
  const parcelas = esquema.numeroParcelasMensais;
  const parcelaMensal = valorDaParcelaMensal(plano);

  const linhas: Array<{ rotulo: string; valor: string }> = [
    { rotulo: "Ato (entrada)", valor: formatarReais(plano.resumo.totalAto) },
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
        Arraste a entrada e escolha a modalidade — o plano recalcula na hora.
      </Text>

      {/* H-13: chips de modalidade quando há mais de uma elegível. */}
      {modalidades.length > 1 ? (
        <View style={styles.simChipsLinha}>
          {modalidades.map((m) => {
            const ativo = m === modalidade;
            return (
              <Pressable
                key={m}
                style={[styles.chip, ativo && styles.chipAtivo]}
                onPress={() => setModalidade(m)}
              >
                <Text style={[styles.chipTexto, ativo && styles.chipTextoAtivo]}>
                  {ROTULO_MODALIDADE[m]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {/* H-12: controle de entrada. */}
      <View style={styles.entradaBloco}>
        <View style={styles.entradaTopo}>
          <Text style={styles.rotulo}>Entrada (ato)</Text>
          <Text style={styles.entradaValor}>{formatarReais(entradaClampeada)}</Text>
        </View>
        <Slider
          minimumValue={entradaMinima}
          maximumValue={entradaMaxima}
          step={10_000}
          value={entradaClampeada}
          onValueChange={(v) => setEntrada(Math.round(v))}
          minimumTrackTintColor="#18181b"
          maximumTrackTintColor="#e4e4e7"
          thumbTintColor="#18181b"
          disabled={entradaMaxima <= entradaMinima}
        />
        <View style={styles.entradaLimites}>
          <Text style={styles.entradaLimiteTexto}>mín {formatarReais(entradaMinima)}</Text>
          <Text style={styles.entradaLimiteTexto}>máx {formatarReais(entradaMaxima)}</Text>
        </View>
        <View style={styles.atalhosLinha}>
          {ATALHOS_ENTRADA.map((atalho) => {
            const alvo = clampear(atalho.valor, entradaMinima, entradaMaxima);
            const ativo = alvo === entradaClampeada;
            return (
              <Pressable
                key={atalho.rotulo}
                style={[styles.atalho, ativo && styles.atalhoAtivo]}
                onPress={() => setEntrada(alvo)}
              >
                <Text style={[styles.atalhoTexto, ativo && styles.atalhoTextoAtivo]}>
                  {atalho.rotulo}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {linhas.map((linha) => (
        <View key={linha.rotulo} style={styles.linha}>
          <Text style={styles.rotulo}>{linha.rotulo}</Text>
          <Text style={styles.valor}>{linha.valor}</Text>
        </View>
      ))}

      {/* H-15: timeline textual reage ao slider. */}
      <View style={styles.timeline}>
        {timeline.map((passo, i) => (
          <Text key={passo} style={styles.timelinePasso}>
            {i + 1}. {passo}
          </Text>
        ))}
      </View>

      {/* H-14: disclaimer de estimativa sempre visível. */}
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
  simChipsLinha: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  entradaBloco: {
    marginBottom: 8,
  },
  entradaTopo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  entradaValor: {
    fontSize: 18,
    fontWeight: "700",
    color: "#18181b",
  },
  entradaLimites: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -2,
  },
  entradaLimiteTexto: {
    fontSize: 11,
    color: "#a1a1aa",
  },
  atalhosLinha: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  atalho: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  atalhoAtivo: {
    backgroundColor: "#18181b",
    borderColor: "#18181b",
  },
  atalhoTexto: {
    fontSize: 12,
    fontWeight: "500",
    color: "#3f3f46",
  },
  atalhoTextoAtivo: {
    color: "#ffffff",
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
