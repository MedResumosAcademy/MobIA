// Camada de dados do SONHÔMETRO (E5 / H-16..H-18) — Server Actions.
// Monta o PerfilSonhometro a partir do formulário (reais→centavos, idade,
// cidadeUF), calcula a capacidade com os parâmetros vigentes e persiste:
//  - cliente logado: UPSERT do próprio cliente_profiles (renda/fgts/etc +
//    capacidade_calculada);
//  - SEMPRE grava o cookie 'imobia_capacidade' (funciona para anônimo também);
//  - registra o evento 'sonhometro_completo'.
// Todo resultado é ESTIMATIVA (ehEstimativa: true no core).
"use server";

import { calcularCapacidade, type PerfilSonhometro, type ResultadoSonhometro } from "@imobia/core";
import { estadoCivilSchema, type Database } from "@imobia/domain";
import { cookies } from "next/headers";
import { z } from "zod";
import { obterSessao } from "@/lib/auth/sessao";
import { obterParametrosVigentesDoBanco } from "@/lib/parametros";
import { criarClienteServidor } from "@/lib/supabase/server";
import { registrarEvento } from "./eventos";
import { COOKIE_CAPACIDADE, COOKIE_CAPACIDADE_MAX_AGE } from "@/lib/capacidade-cookie";

type InsertClienteProfile = Database["public"]["Tables"]["cliente_profiles"]["Insert"];

/**
 * Entrada do formulário do Sonhômetro (H-16). Valores monetários em REAIS
 * (a UI digita reais; convertemos para centavos). Idade via dataNascimento OU
 * idadeMeses. cidade + uf viram "Cidade-UF" para os tetos por UF.
 */
export const entradaSonhometroSchema = z
  .object({
    rendaMensalReais: z.number().nonnegative(),
    rendaConjugeReais: z.number().nonnegative().optional(),
    rendaOutrosMembrosReais: z.number().nonnegative().optional(),
    fgtsReais: z.number().nonnegative(),
    dataNascimento: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    idadeMeses: z.number().int().nonnegative().optional(),
    estadoCivil: estadoCivilSchema,
    dependentes: z.number().int().nonnegative(),
    cidade: z.string().min(1),
    uf: z.string().length(2),
  })
  .strict()
  .refine((e) => e.dataNascimento !== undefined || e.idadeMeses !== undefined, {
    message: "informe dataNascimento ou idadeMeses",
  });

export type EntradaSonhometro = z.input<typeof entradaSonhometroSchema>;

/** Reais (número, pode ter centavos decimais) → centavos inteiros. */
function reaisParaCentavos(reais: number): number {
  return Math.round(reais * 100);
}

/**
 * Calcula a capacidade e persiste os efeitos (perfil do cliente, cookie e
 * evento). Retorna o ResultadoSonhometro (serializável) para a UI exibir
 * "Você consegue comprar até R$ X" e o detalhamento por modalidade.
 */
export async function calcularESalvarCapacidade(
  entrada: EntradaSonhometro,
): Promise<ResultadoSonhometro> {
  const dados = entradaSonhometroSchema.parse(entrada);

  const perfil: PerfilSonhometro = {
    rendaMensal: reaisParaCentavos(dados.rendaMensalReais),
    rendaConjuge:
      dados.rendaConjugeReais !== undefined
        ? reaisParaCentavos(dados.rendaConjugeReais)
        : undefined,
    rendaOutrosMembros:
      dados.rendaOutrosMembrosReais !== undefined
        ? reaisParaCentavos(dados.rendaOutrosMembrosReais)
        : undefined,
    fgts: reaisParaCentavos(dados.fgtsReais),
    idadeMeses: dados.idadeMeses,
    dataNascimento: dados.dataNascimento,
    estadoCivil: dados.estadoCivil,
    dependentes: dados.dependentes,
    cidadeUF: `${dados.cidade}-${dados.uf}`,
  };

  const parametros = await obterParametrosVigentesDoBanco();
  const resultado = calcularCapacidade(perfil, parametros);

  // Efeito 1: persistir o perfil do próprio cliente (apenas logado).
  const sessao = await obterSessao();
  if (sessao) {
    const supabase = await criarClienteServidor();
    const perfilLinha: InsertClienteProfile = {
      usuario_id: sessao.usuarioId,
      renda_mensal: perfil.rendaMensal,
      renda_conjuge: perfil.rendaConjuge ?? null,
      renda_outros_membros: perfil.rendaOutrosMembros ?? null,
      fgts: perfil.fgts,
      data_nascimento: dados.dataNascimento ?? null,
      estado_civil: dados.estadoCivil,
      dependentes: dados.dependentes,
      cidade: dados.cidade,
      uf: dados.uf,
      capacidade_calculada: resultado.valorMaximoImovel,
      atualizado_em: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("cliente_profiles")
      .upsert(perfilLinha, { onConflict: "usuario_id" });
    if (error) {
      throw new Error(`calcularESalvarCapacidade(perfil): ${error.message}`);
    }
  }

  // Efeito 2: SEMPRE grava o cookie (serve anônimo e logado; filtra o catálogo).
  const cookieStore = await cookies();
  cookieStore.set(
    COOKIE_CAPACIDADE,
    JSON.stringify({ valor: resultado.valorMaximoImovel, criadoEm: new Date().toISOString() }),
    { path: "/", maxAge: COOKIE_CAPACIDADE_MAX_AGE },
  );

  // Efeito 3: sinal de lead (no-op para anônimo/corretor; ver registrarEvento).
  await registrarEvento("sonhometro_completo");

  return resultado;
}
