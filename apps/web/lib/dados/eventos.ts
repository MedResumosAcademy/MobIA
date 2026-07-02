// Captura mínima de eventos (E7). Insere em `eventos` apenas quando há sessão
// de CLIENTE (cliente_id = auth.uid()). No-op para anônimo ou corretor/gestor.
// Materialização de lead é V1 — NÃO fazer aqui.
"use server";

import type { Database, TipoEvento } from "@mobia/domain";
import { obterSessao, obterPerfil } from "@/lib/auth/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";

// Tipos de evento aceitos pelo CHECK `eventos_tipo_check` do banco — alinhados
// ao union TipoEvento do domínio (packages/domain/src/lead.ts). NÃO reexportar
// daqui: este é um módulo "use server" e só pode exportar funções async; quem
// precisar do tipo importa direto de @mobia/domain.

type Json = Database["public"]["Tables"]["eventos"]["Row"]["metadata"];

/** Metadata livre gravada no evento (jsonb). Ex.: { entrada } numa simulacao. */
export type MetadataEvento = Record<string, unknown>;

export async function registrarEvento(
  tipo: TipoEvento,
  { imovelId, metadata }: { imovelId?: string; metadata?: MetadataEvento } = {},
): Promise<void> {
  const sessao = await obterSessao();
  if (!sessao) {
    return;
  }
  const perfil = await obterPerfil(sessao.usuarioId);
  // Só cliente gera evento; corretor/gestor navegando não vira sinal de compra.
  if (perfil && perfil.papel !== "cliente") {
    return;
  }

  const supabase = await criarClienteServidor();
  // org_id é preenchido por trigger a partir do imovel_id.
  const { error } = await supabase.from("eventos").insert({
    tipo,
    cliente_id: sessao.usuarioId,
    imovel_id: imovelId ?? null,
    // Só envia metadata quando há algo — default do banco é {} (jsonb not null).
    ...(metadata !== undefined ? { metadata: metadata as Json } : {}),
  });
  if (error) {
    // Não mascarar a falha: sem sinal capturado o lead scoring fica cego.
    throw new Error(`registrarEvento(${tipo}): ${error.message}`);
  }
}
