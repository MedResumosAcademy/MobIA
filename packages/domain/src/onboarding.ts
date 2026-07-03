// Onboarding do corretor — schema do formulário de primeiro acesso.
//
// Contrato de FORMA apenas: o CPF é limpo e checado por tamanho (11 dígitos);
// a validação FORTE dos dígitos verificadores acontece na server action via
// `validarCpf` de @imobia/core (domain NÃO importa core — dependência é
// core → domain, nunca o inverso).
//
// Convenções (docs/ESCOPO.md §6): dinheiro em CENTAVOS (inteiro >= 0).

import { z } from "zod";

/** Remove tudo que não é dígito (duplicado mínimo de core/cpf p/ não inverter a dependência). */
const soDigitos = (v: string) => v.replace(/\D/g, "");

export const onboardingCorretorSchema = z.object({
  nome: z.string().trim().min(3),
  /** CPF limpo (11 dígitos). Verificadores validados na action via @imobia/core. */
  cpf: z
    .string()
    .transform(soDigitos)
    .refine((v) => v.length === 11, { message: "CPF deve ter 11 dígitos" }),
  creci: z.string().trim().min(2),
  cidade: z.string().trim().min(2),
  /** Telefone BR: 10-11 dígitos após limpar (com ou sem 9 no celular). */
  telefone: z
    .string()
    .transform(soDigitos)
    .refine((v) => v.length >= 10 && v.length <= 11, {
      message: "Telefone deve ter 10 ou 11 dígitos",
    })
    .optional(),
  /** Total já vendido pelo corretor, em CENTAVOS. */
  vendasPreviasValor: z.number().int().min(0).optional(),
  vendasPreviasQtd: z.number().int().min(0).optional(),
  bio: z.string().max(400).optional(),
  instagram: z.string().optional(),
  fotoUrl: z.string().url().optional().or(z.literal("")),
  permitirFoto: z.boolean().default(false),
});

export type OnboardingCorretor = z.infer<typeof onboardingCorretorSchema>;
export type OnboardingCorretorInput = z.input<typeof onboardingCorretorSchema>;
