// API PÚBLICA DE CAPTAÇÃO — POST /api/captacao: formulários externos (landing
// page, site, integradores) criam CONTATOS na org dona do token.
//
// AUTENTICAÇÃO: Authorization: Bearer imob_<token>. O token NUNCA vive em
// claro no banco — hasheamos (sha256) e buscamos em tokens_captacao (ativo).
// 401 não distingue token inexistente/inativo (não enumerar tokens). NUNCA
// ecoamos nem logamos o token.
//
// SEGURANÇA: rate limit POR TOKEN (lib/seguranca) ANTES do banco; usa o
// SERVICE ROLE (endpoint público, sem sessão — mesmo padrão do webhook da
// Meta; o trigger anti-forja continua derivando org da linha). Sem
// SUPABASE_SERVICE_ROLE_KEY ⇒ 503.
//
// LGPD: consentimento_marketing_em = now() SÓ quando o payload trouxe
// consentimentoMarketing=true explícito — a fonte registrada é
// "captacao:<origem do token>". `mensagem`/`origemDetalhe` entram na
// OBSERVAÇÃO do contato (escolha documentada: origem formulário não é canal
// de mensagem — criar uma 'mensagem whatsapp' aqui seria mentira no inbox).
//
// FUNIL: o contato entra no funil de org_config.leadads_funil_id (quando
// configurado e da org) ou no funil PADRÃO, sempre na PRIMEIRA etapa.
//
// RESPOSTAS: 201 { contatoId } (telefone repetido devolve o contato JÁ
// existente — idempotência para reenvio de formulário) · 401 · 422 · 429 ·
// 503. Emite o webhook de saída contato.criado via after() (não bloqueia).

import { NextResponse } from "next/server";
import { after } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { funilSchema, type Database } from "@imobia/domain";
import {
  extrairTokenBearer,
  hashTokenCaptacao,
  payloadCaptacaoSchema,
} from "@/lib/dados/captacao-nucleo";
import { permitido } from "@/lib/seguranca/limitador";
import { SUPABASE_URL } from "@/lib/supabase/config";
import { emitirEvento } from "@/lib/webhooks/saida";

export const runtime = "nodejs";

type ClienteServico = SupabaseClient<Database>;

// Teto por token: 30 criações/minuto segura loop de integrador sem atrapalhar
// um plantão de captação real.
const LIMITE_POR_TOKEN = 30;
const JANELA_MS = 60_000;

/** Primeiro profissional da org (admin > gestor > corretor) — responsável
 * padrão dos contatos captados (mesmo critério do webhook da Meta). */
async function resolverResponsavel(
  supabase: ClienteServico,
  orgId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("perfis")
    .select("id, papel")
    .eq("org_id", orgId)
    .in("papel", ["admin", "gestor", "corretor"])
    .order("criado_em", { ascending: true });
  const perfis = data ?? [];
  const escolhido =
    perfis.find((p) => p.papel === "admin") ??
    perfis.find((p) => p.papel === "gestor") ??
    perfis[0];
  return escolhido?.id ?? null;
}

/** Funil de destino + primeira etapa: leadads_funil_id da org_config (se
 * ativo e da org) ?? funil padrão. Sem funil válido ⇒ fora de funil. */
async function resolverFunilDestino(
  supabase: ClienteServico,
  orgId: string,
): Promise<{ funilId: string | null; etapaChave: string | null }> {
  const { data: config } = await supabase
    .from("org_config")
    .select("leadads_funil_id")
    .eq("org_id", orgId)
    .maybeSingle();

  let funil: { id: string; etapas: unknown } | null = null;
  if (config?.leadads_funil_id) {
    const { data } = await supabase
      .from("funis")
      .select("id, etapas")
      .eq("id", config.leadads_funil_id)
      .eq("org_id", orgId)
      .eq("arquivado", false)
      .maybeSingle();
    funil = data;
  }
  if (funil === null) {
    const { data } = await supabase
      .from("funis")
      .select("id, etapas")
      .eq("org_id", orgId)
      .eq("padrao", true)
      .eq("arquivado", false)
      .maybeSingle();
    funil = data;
  }
  if (funil === null) {
    return { funilId: null, etapaChave: null };
  }
  const etapas = funilSchema.shape.etapas.safeParse(funil.etapas);
  const primeira = etapas.success ? (etapas.data[0]?.chave ?? null) : null;
  return primeira !== null
    ? { funilId: funil.id, etapaChave: primeira }
    : { funilId: null, etapaChave: null };
}

export async function POST(request: Request) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json(
      { erro: "captação não configurada neste ambiente" },
      { status: 503 },
    );
  }

  const token = extrairTokenBearer(request.headers.get("authorization"));
  if (token === null) {
    return NextResponse.json({ erro: "token ausente ou inválido" }, { status: 401 });
  }
  const hash = hashTokenCaptacao(token);

  // Rate limit POR TOKEN antes de tocar o banco (o hash identifica sem expor).
  if (!permitido(`captacao:${hash}`, LIMITE_POR_TOKEN, JANELA_MS)) {
    return NextResponse.json(
      { erro: "muitas requisições — aguarde um instante" },
      { status: 429 },
    );
  }

  const supabase = createClient<Database>(SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: linhaToken } = await supabase
    .from("tokens_captacao")
    .select("id, org_id, origem")
    .eq("token_hash", hash)
    .eq("ativo", true)
    .maybeSingle();
  if (!linhaToken) {
    return NextResponse.json({ erro: "token ausente ou inválido" }, { status: 401 });
  }

  let bruto: unknown;
  try {
    bruto = await request.json();
  } catch {
    return NextResponse.json({ erro: "corpo JSON inválido" }, { status: 422 });
  }
  const parsed = payloadCaptacaoSchema.safeParse(bruto);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "payload inválido — nome é obrigatório; confira telefone/e-mail" },
      { status: 422 },
    );
  }
  const d = parsed.data;

  const [responsavelId, destino] = await Promise.all([
    resolverResponsavel(supabase, linhaToken.org_id),
    resolverFunilDestino(supabase, linhaToken.org_id),
  ]);
  if (responsavelId === null) {
    // Org sem nenhum perfil profissional — não há como atender o lead.
    return NextResponse.json(
      { erro: "organização sem equipe para receber o contato" },
      { status: 503 },
    );
  }

  // Observação agrega mensagem/detalhe do formulário (origem formulário NÃO é
  // canal de mensagem — ver cabeçalho).
  const observacoes: string[] = [];
  if (d.origemDetalhe) {
    observacoes.push(`Origem (detalhe): ${d.origemDetalhe}`);
  }
  if (d.mensagem) {
    observacoes.push(`Mensagem do formulário: ${d.mensagem}`);
  }

  const consentiu = d.consentimentoMarketing === true;
  const { data: criado, error } = await supabase
    .from("contatos")
    .insert({
      org_id: linhaToken.org_id,
      responsavel_id: responsavelId,
      nome: d.nome,
      telefone: d.telefone ?? null,
      email: d.email ?? null,
      origem: linhaToken.origem,
      funil_id: destino.funilId,
      etapa_chave: destino.etapaChave,
      etapa_movida_em: destino.funilId !== null ? new Date().toISOString() : null,
      observacao: observacoes.length > 0 ? observacoes.join("\n") : null,
      consentimento_marketing_em: consentiu ? new Date().toISOString() : null,
      consentimento_fonte: consentiu ? `captacao:${linhaToken.origem}` : null,
    })
    .select("id")
    .single();

  let contatoId = criado?.id ?? null;
  let repetido = false;
  if (contatoId === null) {
    // Telefone repetido na org (23505): devolve o contato existente —
    // reenvio de formulário não duplica a agenda.
    if (error?.code === "23505" && d.telefone) {
      const { data: existente } = await supabase
        .from("contatos")
        .select("id")
        .eq("org_id", linhaToken.org_id)
        .eq("telefone", d.telefone)
        .maybeSingle();
      contatoId = existente?.id ?? null;
      repetido = contatoId !== null;
    }
    if (contatoId === null) {
      return NextResponse.json(
        { erro: "não foi possível registrar o contato" },
        { status: 422 },
      );
    }
  }

  const idFinal = contatoId;
  after(async () => {
    // Carimbo de uso do token + webhook de saída — nada disso atrasa o 201.
    await supabase
      .from("tokens_captacao")
      .update({ ultimo_uso_em: new Date().toISOString() })
      .eq("id", linhaToken.id);
    if (!repetido) {
      await emitirEvento(linhaToken.org_id, "contato.criado", {
        contatoId: idFinal,
        nome: d.nome,
        telefone: d.telefone ?? null,
        email: d.email ?? null,
        origem: linhaToken.origem,
      });
    }
  });

  return NextResponse.json({ contatoId }, { status: 201 });
}
