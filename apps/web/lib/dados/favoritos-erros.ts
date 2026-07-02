// Erro tipado de favoritos, isolado em módulo SEM "use server" — arquivos de
// Server Actions só podem exportar funções async, então a classe vive aqui e é
// importada tanto pela action quanto por quem trata o erro na UI.

/** Lançado por alternarFavorito quando não há cliente logado. */
export class PrecisaLoginError extends Error {
  readonly codigo = "precisa_login" as const;
  constructor() {
    super("precisa_login");
    this.name = "PrecisaLoginError";
  }
}
