// Rótulos pt-BR e listas de opções para os formulários de imóvel.
// Compartilhado entre páginas (Server Components) e componentes de UI.

import type {
  CategoriaImovel,
  Modalidade,
  StatusImovel,
  TipoImovel,
} from "@imobia/domain";

export const TIPOS: { valor: TipoImovel; rotulo: string }[] = [
  { valor: "casa", rotulo: "Casa" },
  { valor: "apartamento", rotulo: "Apartamento" },
  { valor: "terreno", rotulo: "Terreno" },
];

export const CATEGORIAS: { valor: CategoriaImovel; rotulo: string }[] = [
  { valor: "lancamento", rotulo: "Lançamento" },
  { valor: "alto_padrao", rotulo: "Alto padrão" },
  { valor: "mcmv", rotulo: "Minha Casa Minha Vida" },
];

export const MODALIDADES: { valor: Modalidade; rotulo: string }[] = [
  { valor: "mcmv", rotulo: "Minha Casa Minha Vida" },
  { valor: "sbpe", rotulo: "SBPE" },
  { valor: "credito_associativo", rotulo: "Crédito associativo" },
  { valor: "imovel_novo", rotulo: "Imóvel novo" },
  { valor: "imovel_usado", rotulo: "Imóvel usado" },
  { valor: "terreno_e_construcao", rotulo: "Terreno e construção" },
];

export const CONDICOES: { valor: string; rotulo: string }[] = [
  { valor: "novo", rotulo: "Novo" },
  { valor: "usado", rotulo: "Usado" },
];

export const STATUS: { valor: StatusImovel; rotulo: string }[] = [
  { valor: "disponivel", rotulo: "Disponível" },
  { valor: "reservado", rotulo: "Reservado" },
  { valor: "vendido", rotulo: "Vendido" },
];

export const ROTULO_STATUS: Record<StatusImovel, string> = {
  disponivel: "Disponível",
  reservado: "Reservado",
  vendido: "Vendido",
};

export const ROTULO_TIPO: Record<TipoImovel, string> = {
  casa: "Casa",
  apartamento: "Apartamento",
  terreno: "Terreno",
};
