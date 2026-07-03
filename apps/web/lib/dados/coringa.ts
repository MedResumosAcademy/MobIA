// Camada de dados + Server Action do CORINGA (ESCOPO §5.4/§6.4) para a área do
// corretor. Módulo server-side: reusa listarImoveisDaOrg()/obterImovel() e o
// motor determinístico gerarEstrategias de @imobia/core.
//
// A MATEMÁTICA e o ranking vivem no motor puro; aqui só (a) reduzimos o imóvel
// da org ao contrato ImovelCoringa, (b) montamos o CenarioCoringa a partir do
// formulário (reais→centavos, idade→meses) e (c) carregamos os parâmetros
// vigentes. Só corretor/gestor logado (mesma regra da área /corretor).

"use server";

import { gerarEstrategias } from "@imobia/core";
import type {
  ImovelCoringa,
  Modalidade,
  ResultadoCoringa,
  UnidadeCoringa,
} from "@imobia/domain";
import { obterPerfil, obterSessao } from "@/lib/auth/sessao";
import { obterParametrosVigentesDoBanco } from "@/lib/parametros";
import { listarImoveisDaOrg, obterImovelDaOrg, type ImovelDetalhe } from "./imoveis";

/** Imóvel da org reduzido ao que o Coringa precisa (para o SELECT do formulário). */
export type ImovelParaCoringa = {
  id: string;
  titulo: string;
  cidade: string;
  uf: string;
  valor: number;
  modalidadesElegiveis: Modalidade[];
  unidades: UnidadeCoringa[];
};

/** Só corretor/gestor logado — mesma regra do layout /corretor. */
async function exigirCorretor(): Promise<void> {
  const sessao = await obterSessao();
  if (!sessao) {
    throw new Error("não autenticado");
  }
  const perfil = await obterPerfil(sessao.usuarioId);
  const papel = perfil?.papel ?? "cliente";
  if (papel !== "corretor" && papel !== "gestor") {
    throw new Error("sem permissão");
  }
}

function reduzirUnidades(imovel: ImovelDetalhe): UnidadeCoringa[] {
  return imovel.unidades.map((u) => ({
    id: u.id,
    identificador: u.identificador,
    valor: u.valor,
  }));
}

/** Imóveis da org reduzidos ao ImovelParaCoringa (só os com modalidade elegível). */
export async function listarImoveisParaCoringa(): Promise<ImovelParaCoringa[]> {
  await exigirCorretor();
  const imoveis = await listarImoveisDaOrg();
  return imoveis
    .filter((i) => i.modalidadesElegiveis.length > 0)
    .map((i) => ({
      id: i.id,
      titulo: i.titulo,
      cidade: i.cidade,
      uf: i.uf,
      valor: i.valor,
      modalidadesElegiveis: i.modalidadesElegiveis,
      unidades: reduzirUnidades(i),
    }));
}

/** Entrada bruta do formulário (client) — valores em REAIS (string), idade em anos. */
export type EntradaCoringa = {
  imovelId: string;
  /** Id da unidade atual (opcional) — usa o valor da unidade como imóvel-alvo. */
  unidadeAtualId?: string;
  /** Renda mensal do titular, em reais. */
  rendaMensal: number;
  /** Renda mensal do cônjuge, em reais (opcional). */
  rendaConjuge?: number;
  /** Saldo de FGTS, em reais. */
  fgts: number;
  /** Entrada própria (sem FGTS), em reais. */
  entradaPropria: number;
  /** Idade do proponente, em anos (regra Caixa: idade + prazo ≤ idadeMax). */
  idadeAnos: number;
};

/** Resultado serializável da ação: ou o ResultadoCoringa, ou um erro legível. */
export type RespostaCoringa =
  | { ok: true; resultado: ResultadoCoringa; imovel: { titulo: string; valorAlvo: number } }
  | { ok: false; erro: string };

function reaisParaCentavos(reais: number): number {
  if (!Number.isFinite(reais) || reais < 0) {
    throw new Error("valor inválido");
  }
  return Math.round(reais * 100);
}

/**
 * Monta o CenarioCoringa a partir do formulário, carrega o imóvel-alvo da org e
 * chama o motor com os parâmetros vigentes. Se a unidade atual for informada, o
 * valor dela vira o valor do imóvel-alvo. Retorna ResultadoCoringa serializável.
 */
export async function gerarEstrategiasAction(
  entrada: EntradaCoringa,
): Promise<RespostaCoringa> {
  try {
    await exigirCorretor();

    const imovel = await obterImovelDaOrg(entrada.imovelId);
    if (!imovel) {
      return { ok: false, erro: "Imóvel não encontrado ou fora do seu acesso." };
    }
    if (imovel.modalidadesElegiveis.length === 0) {
      return { ok: false, erro: "Este imóvel não tem modalidades elegíveis para otimizar." };
    }

    const unidades = reduzirUnidades(imovel);
    const unidadeAtual =
      entrada.unidadeAtualId !== undefined
        ? unidades.find((u) => u.id === entrada.unidadeAtualId)
        : undefined;

    // Valor-alvo: o da unidade escolhida, se houver; senão o do imóvel.
    const valorImovel = unidadeAtual?.valor ?? imovel.valor;

    const imovelCoringa: ImovelCoringa = {
      valorImovel,
      modalidadesElegiveis: imovel.modalidadesElegiveis,
      unidades: unidades.length > 0 ? unidades : undefined,
      unidadeAtualId: unidadeAtual?.id,
    };

    const rendaConjugeReais = entrada.rendaConjuge ?? 0;
    const cenario = {
      rendaMensal: reaisParaCentavos(entrada.rendaMensal),
      rendaConjuge:
        rendaConjugeReais > 0 ? reaisParaCentavos(rendaConjugeReais) : undefined,
      fgts: reaisParaCentavos(entrada.fgts),
      entradaPropria: reaisParaCentavos(entrada.entradaPropria),
      idadeMeses: Math.round(entrada.idadeAnos * 12),
    };

    const parametros = await obterParametrosVigentesDoBanco();
    const resultado = gerarEstrategias(cenario, imovelCoringa, parametros);

    return {
      ok: true,
      resultado,
      imovel: { titulo: imovel.titulo, valorAlvo: valorImovel },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("autenticado") || msg.includes("permissão")) {
      return { ok: false, erro: "Sessão expirada. Entre novamente." };
    }
    return { ok: false, erro: "Não foi possível gerar as estratégias. Revise os dados." };
  }
}
