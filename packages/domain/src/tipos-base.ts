// Tipos e enums fundamentais compartilhados por todo o MobIA.
// Este arquivo é a fonte de verdade para vocabulário do domínio —
// os demais módulos (domain e core) constroem sobre ele.

/** Valor monetário em CENTAVOS (inteiro). Ex.: R$ 320.000,00 → 32_000_000 */
export type Centavos = number;

/** Taxa como fração decimal. Ex.: 10,5% a.a. → 0.105 */
export type Taxa = number;

/** Modalidades de financiamento suportadas (ESCOPO.md §6.1). */
export const MODALIDADES = [
  "mcmv",
  "sbpe",
  "credito_associativo", // Apoio à Produção (GERIC)
  "imovel_novo",
  "imovel_usado",
  "terreno_e_construcao",
] as const;
export type Modalidade = (typeof MODALIDADES)[number];

export const TIPOS_IMOVEL = ["casa", "apartamento", "terreno"] as const;
export type TipoImovel = (typeof TIPOS_IMOVEL)[number];

/** Categorias de vitrine usadas nos filtros do catálogo. */
export const CATEGORIAS_IMOVEL = ["lancamento", "alto_padrao", "mcmv"] as const;
export type CategoriaImovel = (typeof CATEGORIAS_IMOVEL)[number];

export const ESTADOS_CIVIS = [
  "solteiro",
  "casado",
  "uniao_estavel",
  "divorciado",
  "viuvo",
] as const;
export type EstadoCivil = (typeof ESTADOS_CIVIS)[number];

/** Papéis de usuário (multi-tenant: corretor/gestor pertencem a uma organização). */
export const PAPEIS = ["cliente", "corretor", "gestor", "admin"] as const;
export type Papel = (typeof PAPEIS)[number];

export const SISTEMAS_AMORTIZACAO = ["price", "sac"] as const;
export type SistemaAmortizacao = (typeof SISTEMAS_AMORTIZACAO)[number];

/** Temperatura do lead (ESCOPO.md §5.3). */
export const TEMPERATURAS = ["quente", "muito_quente", "pronto_para_compra"] as const;
export type Temperatura = (typeof TEMPERATURAS)[number];

/** Status de um imóvel/unidade na carteira. */
export const STATUS_IMOVEL = ["disponivel", "reservado", "vendido"] as const;
export type StatusImovel = (typeof STATUS_IMOVEL)[number];
