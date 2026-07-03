"use server";

// MENSAGENS DE WHATSAPP — camada de dados que monta a mensagem pronta de um
// negócio e o link wa.me para o corretor disparar com um clique. Módulo de
// SERVER ACTIONS (diretiva no topo: é importado por client components).
//
// DIVISÃO: a redação preferida é do LLM (lib/ia/redator-whatsapp — falha ⇒
// null) e o fallback é o motor PURO (@imobia/core gerarMensagemWhatsApp),
// ambos sobre o MESMO ContextoMensagem montado aqui a partir do negócio.
//
// SEGURANÇA/PRIVACIDADE: exige papel profissional (corretor/gestor/admin); a
// RLS escopa a leitura do negócio. A mensagem contém dados do cliente —
// NUNCA é logada (nem em erro). pt-BR; dinheiro em CENTAVOS.

import {
  gerarMensagemWhatsApp,
  montarLinkWhatsApp,
  type ContextoMensagem,
  type ObjetivoMensagem,
} from "@imobia/core";
import { obterPerfil, obterSessao } from "@/lib/auth/sessao";
import { obterNegocio } from "@/lib/dados/negocios";
import { redigirMensagemComIa } from "@/lib/ia/redator-whatsapp";
import { ROTULO_ETAPA } from "@/app/corretor/negocios/rotulos";

/** Resultado da geração: mensagem pronta + link wa.me (null se sem telefone). */
export type MensagemNegocio =
  | { ok: true; mensagem: string; waUrl: string | null; viaIa: boolean }
  | { ok: false; erro: string };

// Guarda de RUNTIME do objetivo (a action é chamável do cliente — o tipo TS
// não protege contra payload forjado).
const OBJETIVOS: ReadonlySet<string> = new Set([
  "followup",
  "visita",
  "proposta",
  "reativacao",
  "pos_venda",
] satisfies ObjetivoMensagem[]);

/**
 * Gera a mensagem de WhatsApp de um negócio para o objetivo pedido: tenta o
 * redator IA (viaIa true) e degrada para o motor puro (viaIa false). waUrl é
 * null quando o negócio não tem telefone válido — a UI oferece copiar o texto.
 * NUNCA lança: falhas viram { ok: false, erro } gentil, sem detalhes técnicos.
 */
export async function gerarMensagemNegocioAction(
  negocioId: string,
  objetivo: ObjetivoMensagem,
): Promise<MensagemNegocio> {
  const sessao = await obterSessao();
  const perfil = sessao ? await obterPerfil(sessao.usuarioId) : null;
  if (!sessao || !perfil || perfil.papel === "cliente" || !perfil.orgId) {
    return { ok: false, erro: "Recurso exclusivo para corretores e gestores." };
  }
  if (!OBJETIVOS.has(objetivo)) {
    return { ok: false, erro: "Não reconheci o objetivo dessa mensagem." };
  }
  try {
    // Reusa obterNegocio (negocios.ts): RLS escopa; já vem com imovelTitulo,
    // diasSemMovimento e telefone_contato resolvidos no NegocioResumo.
    const detalhe = await obterNegocio(negocioId);
    if (!detalhe) {
      return { ok: false, erro: "Não encontrei esse negócio na sua carteira." };
    }
    const n = detalhe.negocio;
    const ctx: ContextoMensagem = {
      nomeContato: n.nomeContato,
      nomeCorretor: perfil.nome ?? "seu corretor",
      etapa: ROTULO_ETAPA[n.etapa],
      imovelTitulo: n.imovelTitulo,
      diasSemMovimento: n.diasSemMovimento,
      valor: n.valor,
    };
    const daIa = await redigirMensagemComIa(objetivo, ctx);
    const mensagem = daIa ?? gerarMensagemWhatsApp(objetivo, ctx);
    const waUrl =
      n.telefoneContato !== null ? montarLinkWhatsApp(n.telefoneContato, mensagem) : null;
    return { ok: true, mensagem, waUrl, viaIa: daIa !== null };
  } catch {
    return { ok: false, erro: "Não consegui montar a mensagem agora — tente de novo em instantes." };
  }
}
