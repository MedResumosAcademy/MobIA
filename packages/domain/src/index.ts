// @imobia/domain — tipos e schemas compartilhados (zod).
//
// Cobertura do ESCOPO.md §7 — omissão DELIBERADA na Fase 0: as entidades
// Negocio/Deal (funil de vendas) e Pagamento (parcelas de negócio fechado) são
// V1+ (funil e controle financeiro estão fora do MVP em MVP-HISTORIAS.md) e
// serão modeladas — com orgId — quando essas histórias entrarem.
export * from "./tipos-base";
export * from "./primitivas";
export * from "./organizacao";
export * from "./usuario";
export * from "./imovel";
export * from "./plano-pagamento";
export * from "./simulacao";
export * from "./lead";
export * from "./favorito";
export * from "./parametros";
export * from "./coringa";
export * from "./negocio";
export * from "./tarefa";
export * from "./perfil";
export type { Database, Json } from "./database.types";
