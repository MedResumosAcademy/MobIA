// Comunidade — feed NACIONAL e CROSS-ORG de profissionais (corretor/gestor/
// admin). Clientes NÃO participam. Aqui vive apenas o VOCABULÁRIO de tipos de
// publicação, o schema zod de validação da criação de post e os types
// inferidos. A identidade do autor (nome/org/foto) é denormalizada no banco por
// trigger e NÃO é entrada do usuário — logo não aparece neste schema.

import { z } from "zod";
import { idSchema } from "./primitivas";

/**
 * Tipos de publicação suportados no feed:
 *   - `geral`: post livre;
 *   - `conquista`: comemoração de resultado (venda, meta batida);
 *   - `dica`: dica profissional para a comunidade;
 *   - `imovel`: post que destaca um imóvel (via `imovelId`).
 */
export const TIPOS_PUBLICACAO = [
  "geral",
  "conquista",
  "dica",
  "imovel",
] as const;
export type TipoPublicacao = (typeof TIPOS_PUBLICACAO)[number];

export const tipoPublicacaoSchema = z.enum(TIPOS_PUBLICACAO);

/**
 * Entrada de criação de uma publicação no feed da comunidade.
 *
 * - `conteudo` é obrigatório: texto de 1..2000 caracteres (após trim);
 * - `tipo` é um dos TIPOS_PUBLICACAO, com default `geral`;
 * - `imovelId` (uuid) é opcional — referencia um imóvel destacado no post.
 */
export const publicarPostSchema = z
  .object({
    /** Texto do post: 1..2000 caracteres (após trim). */
    conteudo: z.string().trim().min(1).max(2000),
    /** Tipo do post; default `geral`. */
    tipo: tipoPublicacaoSchema.default("geral"),
    /** Imóvel destacado (uuid). Opcional. */
    imovelId: idSchema.optional(),
  })
  .strict();

export type PublicarPost = z.infer<typeof publicarPostSchema>;
