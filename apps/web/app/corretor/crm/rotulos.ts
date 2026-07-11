// Rótulos pt-BR do CRM 2.0 (contatos, conversas e campanhas). PURA UI: traduz
// os enums do domínio (@imobia/domain) em texto de exibição — nenhuma regra de
// negócio aqui. As etapas do funil reutilizam os rótulos de negocios/rotulos.

import type {
  StatusCampanha,
  StatusMensagem,
  Temperatura,
} from "@imobia/domain";
import type { VarianteBadge } from "@/components/ui/Badge";

export const ROTULO_TEMPERATURA: Record<Temperatura, string> = {
  quente: "Quente",
  muito_quente: "Muito quente",
  pronto_para_compra: "Pronto para compra",
};

export const ROTULO_STATUS_CAMPANHA: Record<StatusCampanha, string> = {
  rascunho: "Rascunho",
  pronta: "Pronta",
  enviando: "Enviando",
  concluida: "Concluída",
  falhou: "Falhou",
};

/** Variante do Badge por status de campanha (paleta quente do kit). */
export const BADGE_STATUS_CAMPANHA: Record<StatusCampanha, VarianteBadge> = {
  rascunho: "neutro",
  pronta: "lancamento",
  enviando: "destaque",
  concluida: "marca",
  falhou: "alto_padrao",
};

export const ROTULO_STATUS_MENSAGEM: Record<StatusMensagem, string> = {
  pendente: "Enviando",
  enviada: "Enviada",
  entregue: "Entregue",
  lida: "Lida",
  falhou: "Falhou",
  recebida: "Recebida",
};
