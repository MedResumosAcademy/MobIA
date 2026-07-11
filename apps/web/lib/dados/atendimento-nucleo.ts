// NÚCLEO PURO das FILAS de atendimento (inbox estilo central de WhatsApp) —
// sem IO/banco, testável (atendimento-nucleo.test.ts). O estado vive no
// CONTATO (0029: atendimento, atribuido_a, nao_lidas); aqui só a classificação.
//
// FILAS (espelham o produto de referência):
//   - precisam: atendimento humano COM mensagens não lidas — inclui as
//     conversas ESCALADAS pela IA (o pipeline restaura nao_lidas > 0 ao
//     escalar, justamente para a conversa aparecer aqui);
//   - ia:       a IA está atendendo agora;
//   - minhas:   atribuídas a MIM e ainda não resolvidas;
//   - todas:    tudo que tem conversa.

export const FILAS_CONVERSA = ["precisam", "ia", "minhas", "todas"] as const;
export type FilaConversa = (typeof FILAS_CONVERSA)[number];

/** Estado de conversa do contato que governa as filas (colunas do 0029). */
export type EstadoConversa = {
  atendimento: string;
  atribuidoA: string | null;
  naoLidas: number;
};

/**
 * true se a conversa pertence à fila, do ponto de vista de `usuarioId`.
 * ESPECIFICAÇÃO das filas: o SQL de listarConversas (condicoesDaFila em
 * conversas.ts) espelha estas condições — mudou aqui, mude lá.
 */
export function pertenceAFila(
  c: EstadoConversa,
  fila: FilaConversa,
  usuarioId: string,
): boolean {
  switch (fila) {
    case "precisam":
      return c.atendimento === "humano" && c.naoLidas > 0;
    case "ia":
      return c.atendimento === "ia";
    case "minhas":
      return c.atribuidoA === usuarioId && c.atendimento !== "resolvido";
    case "todas":
      return true;
  }
}
