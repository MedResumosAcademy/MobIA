// Rótulos e ordem de apresentação do FUNIL (CRM). PURA UI: traduz os enums do
// domínio (@imobia/domain) em texto pt-BR para o board, o form e a timeline.
// Nenhuma regra de negócio aqui — só o mapeamento enum → rótulo.

import type { EtapaNegocio, ResultadoNegocio, TipoAtividade } from "@imobia/domain";

/** Etapas ABERTAS do funil, na ordem do board (colunas da esquerda p/ direita). */
export const ETAPAS_ORDEM: EtapaNegocio[] = [
  "novo",
  "contato",
  "visita",
  "proposta",
  "fechamento",
];

export const ROTULO_ETAPA: Record<EtapaNegocio, string> = {
  novo: "Novo",
  contato: "Contato",
  visita: "Visita",
  proposta: "Proposta",
  fechamento: "Fechamento",
};

export const ROTULO_RESULTADO: Record<ResultadoNegocio, string> = {
  ganho: "Ganho",
  perdido: "Perdido",
};

export const ROTULO_ATIVIDADE: Record<TipoAtividade, string> = {
  criacao: "Criação",
  nota: "Nota",
  ligacao: "Ligação",
  email: "E-mail",
  whatsapp: "WhatsApp",
  visita: "Visita",
  mudanca_etapa: "Mudança de etapa",
  ganho: "Ganho",
  perdido: "Perdido",
};
