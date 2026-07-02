// Usuário base + perfis de cliente e corretor (ESCOPO.md §7).

import { z } from "zod";
import {
  centavosSchema,
  estadoCivilSchema,
  idSchema,
  isoDateSchema,
  isoDateTimeSchema,
  papelSchema,
  ufSchema,
} from "./primitivas";

export const usuarioSchema = z
  .object({
    id: idSchema,
    nome: z.string().min(1),
    email: z.string().email(),
    papel: papelSchema,
    /** Cliente não pertence a organização; corretor/gestor sim. */
    orgId: idSchema.optional(),
    criadoEm: isoDateTimeSchema,
  })
  .strict();

export type Usuario = z.infer<typeof usuarioSchema>;

/** Perfil do comprador — entradas do Sonhômetro (ESCOPO.md §6.3). */
export const clienteProfileSchema = z
  .object({
    usuarioId: idSchema,
    /** Renda mensal bruta, em centavos. */
    rendaMensal: centavosSchema,
    /** Saldo de FGTS disponível para composição de entrada, em centavos. */
    fgts: centavosSchema,
    dataNascimento: isoDateSchema,
    estadoCivil: estadoCivilSchema,
    dependentes: z.number().int().nonnegative(),
    cidade: z.string().min(1),
    uf: ufSchema,
    /** Renda do cônjuge para composição de renda, em centavos. */
    rendaConjuge: centavosSchema.optional(),
    /** Valor máximo de imóvel financiável calculado pelo Sonhômetro (estimativa). */
    capacidadeCalculada: centavosSchema.optional(),
  })
  .strict();

export type ClienteProfile = z.infer<typeof clienteProfileSchema>;

/**
 * Perfil do corretor (ESCOPO.md §7).
 *
 * - A CARTEIRA do corretor é DERIVADA, não um campo: são os imóveis cujo
 *   `corretorResponsavelId` aponta para este corretor (evita duplicação e
 *   desincronização de listas).
 * - A fonte de verdade do vínculo organizacional do corretor é
 *   `CorretorProfile.orgId`; `Usuario.orgId` é denormalização de conveniência
 *   e deve ser mantido consistente pela camada de persistência.
 */
export const corretorProfileSchema = z
  .object({
    usuarioId: idSchema,
    creci: z.string().min(1),
    orgId: idSchema,
  })
  .strict();

export type CorretorProfile = z.infer<typeof corretorProfileSchema>;
