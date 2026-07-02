// Experiência do cliente no mobile: pós-login, a tela inicial é o CATÁLOGO de
// imóveis disponíveis (lê de `imoveis` via Supabase; RLS limita a status
// 'disponivel'). Ao tocar num card, abre a FICHA com fotos, descrição e — se o
// imóvel tiver esquema de pagamento — a simulação "Compre do seu jeito" via
// @mobia/core. A "prova do motor" (H-01/H-04) segue acessível por uma aba.

import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  calcularCapacidade,
  formatarReais,
  obterParametrosAtuais,
  recalcularPlano,
} from "@mobia/core";
import type { PerfilSonhometro, ResultadoSonhometro } from "@mobia/core";
import type {
  EsquemaPagamento,
  EstadoCivil,
  Modalidade,
  ParametrosFinanceiros,
  PlanoPagamentoRecalculado,
  TipoImovel,
} from "@mobia/domain";
import { supabase } from "./lib/supabase";

// Modalidades rotuladas para o detalhamento do Sonhômetro (reusa ROTULO_MODALIDADE
// definido abaixo). Estado civil rotulado para o formulário.
const ROTULO_ESTADO_CIVIL: Record<EstadoCivil, string> = {
  solteiro: "Solteiro(a)",
  casado: "Casado(a)",
  uniao_estavel: "União estável",
  divorciado: "Divorciado(a)",
  viuvo: "Viúvo(a)",
};

const ESTADOS_CIVIS_UI: EstadoCivil[] = [
  "solteiro",
  "casado",
  "uniao_estavel",
  "divorciado",
  "viuvo",
];

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

// Linha crua de `cliente_profiles` (snake_case) — usada para pré-preencher o
// Sonhômetro e recuperar a capacidade calculada ao abrir o app.
interface PerfilProfileRow {
  renda_mensal: number | null;
  renda_conjuge: number | null;
  renda_outros_membros: number | null;
  fgts: number | null;
  data_nascimento: string | null;
  estado_civil: string | null;
  dependentes: number | null;
  cidade: string | null;
  uf: string | null;
  capacidade_calculada: number | null;
}

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

// --- Favoritos (H-19) -------------------------------------------------------
//
// Hook compartilhado: mantém o conjunto de imóveis favoritados do cliente logado
// e expõe alternar(imovelId). O `cliente_id` é sempre auth.uid(); `org_id` é
// preenchido por TRIGGER a partir do imóvel — NÃO enviamos org_id. No insert,
// registramos o evento 'favorito' (org_id também via trigger a partir do imóvel).

interface FavoritosContexto {
  favoritos: Set<string>;
  carregando: boolean;
  alternar: (imovelId: string) => Promise<void>;
  recarregar: () => Promise<void>;
}

function useFavoritos(usuarioId: string): FavoritosContexto {
  const [favoritos, setFavoritos] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    const { data, error } = await supabase.from("favoritos").select("imovel_id");
    if (!error && data) {
      setFavoritos(new Set(data.map((r: { imovel_id: string }) => r.imovel_id)));
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const alternar = useCallback(
    async (imovelId: string) => {
      const jaFavorito = favoritos.has(imovelId);
      // Atualização otimista.
      setFavoritos((atual) => {
        const proximo = new Set(atual);
        if (jaFavorito) proximo.delete(imovelId);
        else proximo.add(imovelId);
        return proximo;
      });

      if (jaFavorito) {
        const { error } = await supabase
          .from("favoritos")
          .delete()
          .eq("cliente_id", usuarioId)
          .eq("imovel_id", imovelId);
        if (error) {
          // Reverte em caso de falha.
          setFavoritos((atual) => new Set(atual).add(imovelId));
        }
      } else {
        // org_id preenchido por trigger a partir do imóvel — NÃO enviar.
        const { error } = await supabase
          .from("favoritos")
          .insert({ cliente_id: usuarioId, imovel_id: imovelId });
        if (error) {
          setFavoritos((atual) => {
            const proximo = new Set(atual);
            proximo.delete(imovelId);
            return proximo;
          });
        } else {
          // Sinal de compra (E7): evento 'favorito'; org_id via trigger.
          await supabase
            .from("eventos")
            .insert({ tipo: "favorito", cliente_id: usuarioId, imovel_id: imovelId });
        }
      }
    },
    [favoritos, usuarioId],
  );

  return { favoritos, carregando, alternar, recarregar };
}

/** Botão de coração reutilizável (card do catálogo e ficha). */
function BotaoFavorito({
  ativo,
  onPress,
  tamanho = 22,
}: {
  ativo: boolean;
  onPress: () => void;
  tamanho?: number;
}) {
  return (
    <Pressable
      hitSlop={10}
      style={styles.favoritoBotao}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={ativo ? "Remover dos favoritos" : "Adicionar aos favoritos"}
    >
      <Text style={[styles.favoritoIcone, { fontSize: tamanho }, ativo && styles.favoritoIconeAtivo]}>
        {ativo ? "♥" : "♡"}
      </Text>
    </Pressable>
  );
}

const FILTROS_TIPO: Array<{ valor: TipoImovel | "todos"; rotulo: string }> = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "apartamento", rotulo: "Apartamentos" },
  { valor: "casa", rotulo: "Casas" },
  { valor: "terreno", rotulo: "Terrenos" },
];

function TelaCatalogo({
  onAbrirFicha,
  favoritos,
  onAlternarFavorito,
  capacidade,
}: {
  onAbrirFicha: (imovel: ImovelRow) => void;
  favoritos: Set<string>;
  onAlternarFavorito: (imovelId: string) => void;
  capacidade: number | null;
}) {
  const [imoveis, setImoveis] = useState<ImovelRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<TipoImovel | "todos">("todos");
  // H-18: quando há capacidade calculada, o catálogo mostra só imóveis
  // compatíveis (valor ≤ capacidade). Toggle "ver todos" desliga o filtro.
  const [soCompativeis, setSoCompativeis] = useState(true);

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

  const filtrarCapacidade = capacidade !== null && soCompativeis;
  const visiveis = imoveis
    .filter((i) => filtroTipo === "todos" || i.tipo === filtroTipo)
    .filter((i) => !filtrarCapacidade || i.valor <= capacidade);

  return (
    <View style={styles.tela}>
      <View style={styles.cabecalho}>
        <Text style={styles.tituloTela}>Imóveis</Text>
        <Text style={styles.subtituloTela}>Monte sua própria compra.</Text>
      </View>

      {capacidade !== null ? (
        <Pressable
          style={styles.capacidadeAviso}
          onPress={() => setSoCompativeis((v) => !v)}
        >
          <Text style={styles.capacidadeAvisoTexto}>
            {soCompativeis
              ? `Mostrando imóveis até ${formatarReais(capacidade)} (sua capacidade).`
              : "Mostrando todos os imóveis."}
          </Text>
          <Text style={styles.capacidadeAvisoLink}>
            {soCompativeis ? "Ver todos" : "Só compatíveis"}
          </Text>
        </Pressable>
      ) : null}

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
                <View style={styles.cardFavorito}>
                  <BotaoFavorito
                    ativo={favoritos.has(item.id)}
                    onPress={() => onAlternarFavorito(item.id)}
                  />
                </View>
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

function TelaFicha({
  imovel,
  onVoltar,
  favorito,
  onAlternarFavorito,
}: {
  imovel: ImovelRow;
  onVoltar: () => void;
  favorito: boolean;
  onAlternarFavorito: (imovelId: string) => void;
}) {
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
          <View style={styles.fichaTituloLinha}>
            <Text style={styles.fichaTitulo}>{tituloDoImovel(imovel)}</Text>
            <BotaoFavorito
              ativo={favorito}
              tamanho={26}
              onPress={() => onAlternarFavorito(imovel.id)}
            />
          </View>
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

// --- Favoritos (H-19) — lista dos imóveis favoritados -----------------------

function TelaFavoritos({
  favoritos,
  onAbrirFicha,
  onAlternarFavorito,
}: {
  favoritos: Set<string>;
  onAbrirFicha: (imovel: ImovelRow) => void;
  onAlternarFavorito: (imovelId: string) => void;
}) {
  const [imoveis, setImoveis] = useState<ImovelRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const ids = useMemo(() => Array.from(favoritos), [favoritos]);

  useEffect(() => {
    let ativo = true;
    (async () => {
      setCarregando(true);
      setErro(null);
      if (ids.length === 0) {
        if (ativo) {
          setImoveis([]);
          setCarregando(false);
        }
        return;
      }
      const { data, error } = await supabase
        .from("imoveis")
        .select(
          "id, org_id, tipo, cidade, uf, valor, status, descricao, fotos, plantas, modalidades_elegiveis, esquema_pagamento",
        )
        .in("id", ids)
        .order("valor", { ascending: true });
      if (!ativo) return;
      if (error) {
        setErro("Não foi possível carregar seus favoritos. Tente novamente.");
      } else {
        setImoveis((data ?? []) as ImovelRow[]);
      }
      setCarregando(false);
    })();
    return () => {
      ativo = false;
    };
    // Recarrega quando o conjunto de ids muda (ex.: favoritou/desfavoritou).
  }, [ids.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.tela}>
      <View style={styles.cabecalho}>
        <Text style={styles.tituloTela}>Favoritos</Text>
        <Text style={styles.subtituloTela}>Os imóveis que você salvou.</Text>
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
          data={imoveis}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listaConteudo}
          ListEmptyComponent={
            <View style={styles.centralizado}>
              <Text style={styles.vazio}>
                Você ainda não favoritou nenhum imóvel. Toque no coração de um imóvel para salvá-lo.
              </Text>
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
                <View style={styles.cardFavorito}>
                  <BotaoFavorito ativo onPress={() => onAlternarFavorito(item.id)} />
                </View>
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

// --- Sonhômetro (H-16/H-17/H-18) --------------------------------------------
//
// Formulário → calcularCapacidade(@mobia/core) com obterParametrosAtuais() →
// "Você consegue comprar até R$ X" + melhor modalidade + detalhamento. Persiste
// a capacidade em cliente_profiles (upsert do próprio) e registra o evento
// 'sonhometro_completo'. A capacidade fica disponível para o catálogo filtrar.

/** Converte "R$ 3.500,00" / "3500" / "3.500,50" digitado em centavos. */
function reaisParaCentavos(texto: string): number {
  const limpo = texto.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const valor = Number.parseFloat(limpo);
  if (!Number.isFinite(valor) || valor < 0) return 0;
  return Math.round(valor * 100);
}

const UF_REGEX = /^[A-Za-z]{2}$/;
const NASC_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function TelaSonhometro({
  usuarioId,
  perfilInicial,
  onCapacidade,
}: {
  usuarioId: string;
  perfilInicial: PerfilProfileRow | null;
  onCapacidade: (valor: number) => void;
}) {
  const parametros = obterParametrosAtuais();

  const [renda, setRenda] = useState(
    perfilInicial?.renda_mensal != null ? formatarReais(perfilInicial.renda_mensal) : "",
  );
  const [rendaConjuge, setRendaConjuge] = useState(
    perfilInicial?.renda_conjuge != null ? formatarReais(perfilInicial.renda_conjuge) : "",
  );
  const [rendaOutros, setRendaOutros] = useState(
    perfilInicial?.renda_outros_membros != null
      ? formatarReais(perfilInicial.renda_outros_membros)
      : "",
  );
  const [fgts, setFgts] = useState(
    perfilInicial?.fgts != null ? formatarReais(perfilInicial.fgts) : "",
  );
  const [nascimento, setNascimento] = useState(perfilInicial?.data_nascimento ?? "");
  const [estadoCivil, setEstadoCivil] = useState<EstadoCivil>(
    (perfilInicial?.estado_civil as EstadoCivil | null) ?? "solteiro",
  );
  const [dependentes, setDependentes] = useState(
    perfilInicial?.dependentes != null ? String(perfilInicial.dependentes) : "0",
  );
  const [cidade, setCidade] = useState(perfilInicial?.cidade ?? "");
  const [uf, setUf] = useState(perfilInicial?.uf?.trim() ?? "");

  const [resultado, setResultado] = useState<ResultadoSonhometro | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function calcular() {
    setErro(null);
    const rendaMensal = reaisParaCentavos(renda);
    if (rendaMensal <= 0) {
      setErro("Informe sua renda mensal.");
      return;
    }
    if (!NASC_REGEX.test(nascimento)) {
      setErro("Informe a data de nascimento no formato AAAA-MM-DD.");
      return;
    }
    if (!UF_REGEX.test(uf) || cidade.trim() === "") {
      setErro("Informe cidade e UF (ex.: Fortaleza / CE).");
      return;
    }
    const dep = Number.parseInt(dependentes, 10);
    if (!Number.isFinite(dep) || dep < 0) {
      setErro("Número de dependentes inválido.");
      return;
    }

    const perfil: PerfilSonhometro = {
      rendaMensal,
      rendaConjuge: reaisParaCentavos(rendaConjuge) || undefined,
      rendaOutrosMembros: reaisParaCentavos(rendaOutros) || undefined,
      fgts: reaisParaCentavos(fgts),
      dataNascimento: nascimento,
      estadoCivil,
      dependentes: dep,
      cidadeUF: `${cidade.trim()}-${uf.toUpperCase()}`,
    };

    let calc: ResultadoSonhometro;
    try {
      calc = calcularCapacidade(perfil, parametros);
    } catch {
      setErro("Não foi possível calcular com os dados informados. Revise e tente novamente.");
      return;
    }
    setResultado(calc);
    onCapacidade(calc.valorMaximoImovel);

    // Persiste o perfil e a capacidade (upsert do próprio; usuario_id = auth.uid()).
    setSalvando(true);
    const { error: erroPerfil } = await supabase.from("cliente_profiles").upsert(
      {
        usuario_id: usuarioId,
        renda_mensal: perfil.rendaMensal,
        renda_conjuge: perfil.rendaConjuge ?? null,
        renda_outros_membros: perfil.rendaOutrosMembros ?? null,
        fgts: perfil.fgts,
        data_nascimento: perfil.dataNascimento,
        estado_civil: perfil.estadoCivil,
        dependentes: perfil.dependentes,
        cidade: cidade.trim(),
        uf: uf.toUpperCase(),
        capacidade_calculada: calc.valorMaximoImovel,
      },
      { onConflict: "usuario_id" },
    );
    if (!erroPerfil) {
      await supabase.from("eventos").insert({
        tipo: "sonhometro_completo",
        cliente_id: usuarioId,
        metadata: { capacidade_calculada: calc.valorMaximoImovel },
      });
    }
    setSalvando(false);
  }

  return (
    <View style={styles.tela}>
      <View style={styles.cabecalho}>
        <Text style={styles.tituloTela}>Sonhômetro</Text>
        <Text style={styles.subtituloTela}>Descubra quanto você pode comprar.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.sonhoConteudo} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.cardTitulo}>Seu perfil</Text>

          <Text style={styles.campoRotulo}>Renda mensal</Text>
          <TextInput
            style={styles.campo}
            value={renda}
            onChangeText={setRenda}
            keyboardType="numeric"
            placeholder="R$ 3.500,00"
            placeholderTextColor="#a1a1aa"
          />

          <Text style={styles.campoRotulo}>Renda do cônjuge (opcional)</Text>
          <TextInput
            style={styles.campo}
            value={rendaConjuge}
            onChangeText={setRendaConjuge}
            keyboardType="numeric"
            placeholder="R$ 0,00"
            placeholderTextColor="#a1a1aa"
          />

          <Text style={styles.campoRotulo}>Renda de outros membros (opcional)</Text>
          <TextInput
            style={styles.campo}
            value={rendaOutros}
            onChangeText={setRendaOutros}
            keyboardType="numeric"
            placeholder="R$ 0,00"
            placeholderTextColor="#a1a1aa"
          />

          <Text style={styles.campoRotulo}>Saldo de FGTS</Text>
          <TextInput
            style={styles.campo}
            value={fgts}
            onChangeText={setFgts}
            keyboardType="numeric"
            placeholder="R$ 0,00"
            placeholderTextColor="#a1a1aa"
          />

          <Text style={styles.campoRotulo}>Data de nascimento (AAAA-MM-DD)</Text>
          <TextInput
            style={styles.campo}
            value={nascimento}
            onChangeText={setNascimento}
            autoCapitalize="none"
            placeholder="1990-05-20"
            placeholderTextColor="#a1a1aa"
          />

          <Text style={styles.campoRotulo}>Estado civil</Text>
          <View style={styles.simChipsLinha}>
            {ESTADOS_CIVIS_UI.map((ec) => {
              const ativo = ec === estadoCivil;
              return (
                <Pressable
                  key={ec}
                  style={[styles.chip, ativo && styles.chipAtivo]}
                  onPress={() => setEstadoCivil(ec)}
                >
                  <Text style={[styles.chipTexto, ativo && styles.chipTextoAtivo]}>
                    {ROTULO_ESTADO_CIVIL[ec]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.campoRotulo}>Dependentes</Text>
          <TextInput
            style={styles.campo}
            value={dependentes}
            onChangeText={setDependentes}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor="#a1a1aa"
          />

          <View style={styles.linhaCampos}>
            <View style={styles.campoFlex}>
              <Text style={styles.campoRotulo}>Cidade</Text>
              <TextInput
                style={styles.campo}
                value={cidade}
                onChangeText={setCidade}
                placeholder="Fortaleza"
                placeholderTextColor="#a1a1aa"
              />
            </View>
            <View style={styles.campoUf}>
              <Text style={styles.campoRotulo}>UF</Text>
              <TextInput
                style={styles.campo}
                value={uf}
                onChangeText={(t) => setUf(t.toUpperCase())}
                autoCapitalize="characters"
                maxLength={2}
                placeholder="CE"
                placeholderTextColor="#a1a1aa"
              />
            </View>
          </View>

          {erro ? <Text style={styles.erro}>{erro}</Text> : null}

          <Pressable
            style={[styles.botao, salvando && styles.botaoDesabilitado]}
            onPress={calcular}
            disabled={salvando}
          >
            <Text style={styles.botaoTexto}>{salvando ? "Calculando…" : "Calcular"}</Text>
          </Pressable>
        </View>

        {resultado ? <ResultadoSonhometroCard resultado={resultado} parametros={parametros} /> : null}
      </ScrollView>
    </View>
  );
}

function ResultadoSonhometroCard({
  resultado,
  parametros,
}: {
  resultado: ResultadoSonhometro;
  parametros: ParametrosFinanceiros;
}) {
  const elegiveis = resultado.porModalidade.filter((m) => m.elegivel);
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitulo}>Sua capacidade</Text>
      <Text style={styles.sonhoDestaque}>
        Você consegue comprar até {formatarReais(resultado.valorMaximoImovel)}
      </Text>
      {resultado.melhorModalidade ? (
        <Text style={styles.cardDescricao}>
          Melhor modalidade: {ROTULO_MODALIDADE[resultado.melhorModalidade]}
        </Text>
      ) : (
        <Text style={styles.cardDescricao}>
          Não encontramos uma modalidade elegível com os dados informados.
        </Text>
      )}

      <View style={styles.linha}>
        <Text style={styles.rotulo}>Parcela máxima (renda)</Text>
        <Text style={styles.valor}>{formatarReais(resultado.detalhamento.parcelaMax)}</Text>
      </View>
      <View style={styles.linha}>
        <Text style={styles.rotulo}>Prazo máximo pela idade</Text>
        <Text style={styles.valor}>{resultado.detalhamento.prazoMax} meses</Text>
      </View>
      <View style={styles.linha}>
        <Text style={styles.rotulo}>FGTS aplicável na entrada</Text>
        <Text style={styles.valor}>{formatarReais(resultado.detalhamento.entradaDisponivel)}</Text>
      </View>

      {elegiveis.length > 0 ? (
        <>
          <Text style={styles.sonhoSubtitulo}>Por modalidade</Text>
          {elegiveis.map((m) => (
            <View key={m.modalidade} style={styles.linha}>
              <Text style={styles.rotulo}>{ROTULO_MODALIDADE[m.modalidade]}</Text>
              <Text style={styles.valor}>{formatarReais(m.valorMaximoImovel)}</Text>
            </View>
          ))}
        </>
      ) : null}

      <Text style={styles.disclaimer}>
        Estimativa (parâmetros {parametros.vigenciaInicio}, v{parametros.versao}) — não constitui
        proposta formal de crédito.
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

type Aba = "catalogo" | "favoritos" | "sonhometro" | "motor";

const ABAS: Array<{ valor: Aba; rotulo: string }> = [
  { valor: "catalogo", rotulo: "Imóveis" },
  { valor: "favoritos", rotulo: "Favoritos" },
  { valor: "sonhometro", rotulo: "Sonhômetro" },
  { valor: "motor", rotulo: "Motor" },
];

function AppAutenticado({ sessao }: { sessao: Session }) {
  const usuarioId = sessao.user.id;
  const [aba, setAba] = useState<Aba>("catalogo");
  const [imovelAberto, setImovelAberto] = useState<ImovelRow | null>(null);

  const { favoritos, alternar } = useFavoritos(usuarioId);

  // Capacidade calculada do Sonhômetro (centavos) — recuperada do perfil no
  // banco ao abrir e atualizada quando o cliente recalcula. Alimenta o filtro
  // de compatibilidade do catálogo (H-18).
  const [capacidade, setCapacidade] = useState<number | null>(null);
  const [perfil, setPerfil] = useState<PerfilProfileRow | null>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const { data } = await supabase
        .from("cliente_profiles")
        .select(
          "renda_mensal, renda_conjuge, renda_outros_membros, fgts, data_nascimento, estado_civil, dependentes, cidade, uf, capacidade_calculada",
        )
        .eq("usuario_id", usuarioId)
        .maybeSingle();
      if (!ativo) return;
      if (data) {
        setPerfil(data as PerfilProfileRow);
        if ((data as PerfilProfileRow).capacidade_calculada != null) {
          setCapacidade((data as PerfilProfileRow).capacidade_calculada);
        }
      }
    })();
    return () => {
      ativo = false;
    };
  }, [usuarioId]);

  return (
    <View style={styles.appRoot}>
      <View style={styles.conteudoRoot}>
        {imovelAberto ? (
          <TelaFicha
            imovel={imovelAberto}
            onVoltar={() => setImovelAberto(null)}
            favorito={favoritos.has(imovelAberto.id)}
            onAlternarFavorito={alternar}
          />
        ) : aba === "catalogo" ? (
          <TelaCatalogo
            onAbrirFicha={setImovelAberto}
            favoritos={favoritos}
            onAlternarFavorito={alternar}
            capacidade={capacidade}
          />
        ) : aba === "favoritos" ? (
          <TelaFavoritos
            favoritos={favoritos}
            onAbrirFicha={setImovelAberto}
            onAlternarFavorito={alternar}
          />
        ) : aba === "sonhometro" ? (
          <TelaSonhometro
            usuarioId={usuarioId}
            perfilInicial={perfil}
            onCapacidade={setCapacidade}
          />
        ) : (
          <TelaProvaDoMotor />
        )}
      </View>

      <View style={styles.tabBar}>
        {ABAS.map((item) => (
          <Pressable
            key={item.valor}
            style={styles.tabItem}
            onPress={() => {
              setImovelAberto(null);
              setAba(item.valor);
            }}
          >
            <Text
              style={[styles.tabTexto, aba === item.valor && !imovelAberto && styles.tabAtivo]}
            >
              {item.rotulo}
            </Text>
          </Pressable>
        ))}
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
  cardFavorito: {
    position: "absolute",
    top: 8,
    right: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  favoritoBotao: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  favoritoIcone: {
    color: "#71717a",
    lineHeight: 28,
  },
  favoritoIconeAtivo: {
    color: "#dc2626",
  },
  capacidadeAviso: {
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  capacidadeAvisoTexto: {
    flexShrink: 1,
    fontSize: 12,
    color: "#166534",
  },
  capacidadeAvisoLink: {
    fontSize: 12,
    fontWeight: "700",
    color: "#166534",
  },
  fichaTituloLinha: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  sonhoConteudo: {
    paddingBottom: 40,
  },
  sonhoDestaque: {
    marginTop: 8,
    marginBottom: 4,
    fontSize: 22,
    fontWeight: "700",
    color: "#18181b",
  },
  sonhoSubtitulo: {
    marginTop: 14,
    marginBottom: 2,
    fontSize: 13,
    fontWeight: "600",
    color: "#3f3f46",
  },
  linhaCampos: {
    flexDirection: "row",
    gap: 12,
  },
  campoFlex: {
    flex: 1,
  },
  campoUf: {
    width: 80,
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
    flexShrink: 1,
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
