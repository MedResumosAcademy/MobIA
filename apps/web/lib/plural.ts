// Helper de pluralização pt-BR para textos dinâmicos de UI: devolve a forma
// singular ou plural conforme a quantidade (evita o padrão "item(s)").
// Ex.: `${n} ${plural(n, "venda fechada", "vendas fechadas")}`.

export function plural(quantidade: number, singular: string, pluralForma: string): string {
  return quantidade === 1 ? singular : pluralForma;
}
