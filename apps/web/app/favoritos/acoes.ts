// Server Actions de favoritos para a UI (E6 / H-19). Envolve alternarFavorito
// (lib/dados) convertendo o PrecisaLoginError num resultado tipado — exceções
// não sobrevivem íntegras à fronteira client↔server, então devolvemos um union
// discriminado que o BotaoFavoritar consegue inspecionar com segurança.
"use server";

import { alternarFavorito } from "@/lib/dados/favoritos";
import { PrecisaLoginError } from "@/lib/dados/favoritos-erros";

export type ResultadoAlternar =
  | { ok: true; favoritado: boolean }
  | { ok: false; motivo: "precisa_login" | "erro" };

export async function alternarFavoritoAction(
  imovelId: string,
): Promise<ResultadoAlternar> {
  try {
    const favoritado = await alternarFavorito(imovelId);
    return { ok: true, favoritado };
  } catch (erro) {
    if (erro instanceof PrecisaLoginError) {
      return { ok: false, motivo: "precisa_login" };
    }
    // Erro real (RLS, rede, banco): resultado tipado em vez de rethrow — a
    // exceção estouraria sem tratamento no client e o coração ficaria com o
    // estado otimista oposto ao do banco.
    console.error("alternarFavoritoAction:", erro);
    return { ok: false, motivo: "erro" };
  }
}
