// NÚCLEO PURO da API de captação (POST /api/captacao) — validação do payload,
// convenção do token e hashing. Sem IO: tudo aqui é testável em unidade
// (captacao-nucleo.test.ts); a rota só orquestra.
//
// CONVENÇÃO DO TOKEN (única no repo — criação e verificação usam a mesma;
// ver tokens_captacao, 0033):
//   - claro:    "imob_" + 48 hex (24 bytes aleatórios) — mostrado UMA vez;
//   - hash:     sha256 hex do token COMPLETO (com o prefixo "imob_") — é o
//               que vive em tokens_captacao.token_hash;
//   - prefixo:  primeiros 9 chars do claro ("imob_a1b2") — o que a UI exibe.

import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { telefoneWhatsappSchema } from "@imobia/domain";

/** Payload do formulário externo. `consentimentoMarketing` NUNCA é assumido:
 * só carimba o opt-in LGPD quando vem `true` explícito do formulário. */
export const payloadCaptacaoSchema = z
  .object({
    nome: z.string().trim().min(1).max(160),
    telefone: telefoneWhatsappSchema.optional(),
    email: z.string().trim().email().max(160).optional(),
    origemDetalhe: z.string().trim().max(120).optional(),
    consentimentoMarketing: z.boolean().optional(),
    mensagem: z.string().trim().max(2000).optional(),
  })
  .strict();

export type PayloadCaptacao = z.infer<typeof payloadCaptacaoSchema>;

// Formato aceito no Authorization (liberal no tamanho para não travar tokens
// futuros; o que autentica de verdade é o hash existir no banco).
const TOKEN_RE = /^imob_[A-Za-z0-9]{16,128}$/;

/** "Bearer imob_…" → token, ou null se ausente/malformado. */
export function extrairTokenBearer(authorization: string | null): string | null {
  if (authorization === null) {
    return null;
  }
  const partes = authorization.trim().split(/\s+/);
  if (partes.length !== 2 || partes[0].toLowerCase() !== "bearer") {
    return null;
  }
  return TOKEN_RE.test(partes[1]) ? partes[1] : null;
}

/** sha256 hex do token COMPLETO — o formato de tokens_captacao.token_hash. */
export function hashTokenCaptacao(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Gera um token novo (claro + hash + prefixo) — o claro aparece UMA vez. */
export function gerarTokenCaptacao(): { token: string; hash: string; prefixo: string } {
  const token = `imob_${randomBytes(24).toString("hex")}`;
  return { token, hash: hashTokenCaptacao(token), prefixo: token.slice(0, 9) };
}
