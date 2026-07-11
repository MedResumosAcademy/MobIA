// SELEÇÃO DE NEGÓCIO POR CONTATO — lógica PURA do assistente do corretor,
// extraída de apps/web/lib/dados/assistente.ts para ser testável sem banco.
// O web continua dono da sessão/consulta (RLS); aqui vive só a decisão:
// qual negócio da lista casa o contato falado, e se o casamento foi ambíguo.
// Errar esta seleção move etapa/fecha o negócio ERRADO — por isso os
// invariantes ficam cravados nos testes deste módulo. pt-BR.

/**
 * Normaliza texto para busca TOLERANTE A ACENTOS e caixa: "Patricia" deve
 * casar "Patrícia Nunes" (digitação sem acento e transcrição de voz divergem
 * do cadastro com frequência em pt-BR). NFD separa a marca diacrítica da
 * letra; \p{M} remove as marcas; lowercase fecha o casamento case-insensitive.
 */
export function normalizarParaBusca(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

/** "2026-07-04" ⇒ "hoje" ou "no dia 04/07" (rótulo curto para as respostas). */
export function rotuloDia(diaISO: string, hojeISO: string): string {
  if (diaISO === hojeISO) {
    return "hoje";
  }
  const [, mes, dia] = diaISO.split("-");
  return `no dia ${dia}/${mes}`;
}

/** Campos mínimos que a seleção precisa (as linhas do banco os satisfazem). */
export type NegocioParaSelecao = {
  id: string;
  nome_contato: string;
  /** null = negócio ABERTO; "ganho"/"perdido" = fechado. */
  resultado: string | null;
};

/** Resultado da seleção: o negócio escolhido e se o casamento foi ambíguo. */
export type SelecaoNegocio<T extends NegocioParaSelecao> = {
  negocio: T;
  /** true quando 2+ negócios ABERTOS de nomes DIFERENTES casam o padrão. */
  ambiguo: boolean;
};

/**
 * Escolhe o negócio da `lista` cujo nome_contato casa `padraoBruto`
 * (accent/case-insensitive). Contrato (a lista DEVE chegar ordenada por
 * atualizado_em desc, como a consulta do web entrega):
 *   - prefere ABERTOS (resultado null); entre eles, o primeiro da lista
 *     (= movimento mais recente);
 *   - se só há fechados, devolve o fechado mais recente — o chamador responde
 *     um erro gentil ("já foi ganho") em vez de "não achei";
 *   - `ambiguo` só é true com 2+ negócios ABERTOS de nomes DIFERENTES;
 *   - padrão vazio/só espaços ou nenhum casamento ⇒ null.
 */
export function selecionarNegocioPorContato<T extends NegocioParaSelecao>(
  lista: readonly T[],
  padraoBruto: string,
): SelecaoNegocio<T> | null {
  const padrao = normalizarParaBusca(padraoBruto);
  if (!padrao) {
    return null;
  }
  const casados = lista.filter((n) => normalizarParaBusca(n.nome_contato).includes(padrao));
  if (casados.length === 0) {
    return null;
  }
  const abertos = casados.filter((n) => n.resultado === null);
  const escolhido = abertos[0] ?? casados[0];
  if (!escolhido) {
    return null;
  }
  const nomesAbertos = new Set(abertos.map((n) => n.nome_contato.trim().toLowerCase()));
  return { negocio: escolhido, ambiguo: nomesAbertos.size > 1 };
}
