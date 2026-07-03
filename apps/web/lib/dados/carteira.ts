// Camada de dados do DESEMPENHO DA CARTEIRA do corretor (vitrine do perfil).
// Módulo server-side ("use server": só exporta funções async; tipos são
// apagados na compilação — mesmo padrão de perfil.ts).
//
// ESCOPO/RLS: leituras via criarClienteServidor (sessão do usuário). A RLS
// multi-tenant limita imoveis à org; eventos/favoritos só são visíveis para
// clientes que CONSENTIRAM (privado.cliente_consentiu — LGPD). Os números aqui
// são, portanto, "interações de clientes que autorizaram" — NÃO tentamos (nem
// devemos) contornar esse filtro. Dinheiro em CENTAVOS. pt-BR.

"use server";

import type { StatusImovel } from "@imobia/domain";
import { statusImovelSchema } from "@imobia/domain";
import { criarClienteServidor } from "@/lib/supabase/server";
import { urlPublicaMidia } from "./storage";

// --- Tipos de saída (camelCase, prontos para a UI) ---

export type ImovelDesempenho = {
  imovelId: string;
  /** Título derivado (tipo + cidade/UF) — espelha perfil.ts/negocios.ts. */
  titulo: string;
  cidade: string;
  uf: string;
  /** CENTAVOS. */
  valor: number;
  status: StatusImovel;
  fotoUrl: string | null;
  /** Eventos visita_ficha de clientes que consentiram (RLS/LGPD). */
  visualizacoes: number;
  /** Eventos simulacao de clientes que consentiram (RLS/LGPD). */
  simulacoes: number;
  /** Favoritos de clientes que consentiram (RLS/LGPD). */
  favoritos: number;
};

export type DesempenhoCarteira = {
  imoveis: ImovelDesempenho[];
  totais: {
    imoveis: number;
    visualizacoes: number;
    simulacoes: number;
    favoritos: number;
  };
};

// --- Helpers ---

/** Título derivado do imóvel — espelha tituloImovel de perfil.ts (sem coluna própria). */
function tituloDoImovel(im: { tipo: string | null; cidade: string; uf: string }): string {
  const rotulos: Record<string, string> = {
    casa: "Casa",
    apartamento: "Apartamento",
    terreno: "Terreno",
  };
  const prefixo = im.tipo && rotulos[im.tipo] ? rotulos[im.tipo] : "Imóvel";
  return `${prefixo} em ${im.cidade}/${im.uf}`;
}

function coagirStatus(v: string): StatusImovel {
  const r = statusImovelSchema.safeParse(v);
  return r.success ? r.data : "disponivel";
}

// --- Leitura ---

/**
 * Desempenho da carteira do corretor: imóveis sob responsabilidade
 * (corretor_responsavel_id) com contagens de interação agregadas por imóvel
 * (visita_ficha → visualizacoes, simulacao → simulacoes, favoritos → count).
 *
 * Exatamente 3 queries (imoveis; eventos IN imovelIds; favoritos IN imovelIds)
 * com agregação em memória — sem N+1. Ordena por visualizacoes desc, depois
 * simulacoes desc. Carteira vazia ⇒ { imoveis: [], totais zerados } (o null do
 * contrato fica reservado a cenários sem leitura possível).
 */
export async function desempenhoCarteira(
  corretorId: string,
): Promise<DesempenhoCarteira | null> {
  const supabase = await criarClienteServidor();

  // 1) Imóveis do corretor (RLS: só a org do logado enxerga).
  const { data: imoveis, error: erroImoveis } = await supabase
    .from("imoveis")
    .select("id, tipo, cidade, uf, valor, status, fotos")
    .eq("corretor_responsavel_id", corretorId);
  if (erroImoveis) {
    throw new Error(`desempenhoCarteira(imoveis): ${erroImoveis.message}`);
  }

  if (!imoveis || imoveis.length === 0) {
    return {
      imoveis: [],
      totais: { imoveis: 0, visualizacoes: 0, simulacoes: 0, favoritos: 0 },
    };
  }

  const imovelIds = imoveis.map((i) => i.id);

  // 2+3) Interações — a RLS já restringe a clientes que consentiram (LGPD).
  const [
    { data: eventos, error: erroEventos },
    { data: favoritos, error: erroFavoritos },
  ] = await Promise.all([
    supabase
      .from("eventos")
      .select("imovel_id, tipo")
      .in("imovel_id", imovelIds)
      .in("tipo", ["visita_ficha", "simulacao"]),
    supabase.from("favoritos").select("imovel_id").in("imovel_id", imovelIds),
  ]);
  if (erroEventos) {
    throw new Error(`desempenhoCarteira(eventos): ${erroEventos.message}`);
  }
  if (erroFavoritos) {
    throw new Error(`desempenhoCarteira(favoritos): ${erroFavoritos.message}`);
  }

  // Agregação em memória por imovel_id.
  const contagens = new Map<
    string,
    { visualizacoes: number; simulacoes: number; favoritos: number }
  >(imovelIds.map((id) => [id, { visualizacoes: 0, simulacoes: 0, favoritos: 0 }]));

  for (const e of eventos ?? []) {
    if (!e.imovel_id) {
      continue;
    }
    const c = contagens.get(e.imovel_id);
    if (!c) {
      continue;
    }
    if (e.tipo === "visita_ficha") {
      c.visualizacoes += 1;
    } else if (e.tipo === "simulacao") {
      c.simulacoes += 1;
    }
  }
  for (const f of favoritos ?? []) {
    const c = contagens.get(f.imovel_id);
    if (c) {
      c.favoritos += 1;
    }
  }

  const linhas: ImovelDesempenho[] = imoveis.map((im) => {
    const c = contagens.get(im.id) ?? {
      visualizacoes: 0,
      simulacoes: 0,
      favoritos: 0,
    };
    return {
      imovelId: im.id,
      titulo: tituloDoImovel(im),
      cidade: im.cidade,
      uf: im.uf,
      valor: im.valor,
      status: coagirStatus(im.status),
      fotoUrl: im.fotos[0] ? urlPublicaMidia("imoveis-fotos", im.fotos[0]) : null,
      visualizacoes: c.visualizacoes,
      simulacoes: c.simulacoes,
      favoritos: c.favoritos,
    };
  });

  linhas.sort(
    (a, b) => b.visualizacoes - a.visualizacoes || b.simulacoes - a.simulacoes,
  );

  const totais = linhas.reduce(
    (acc, l) => {
      acc.visualizacoes += l.visualizacoes;
      acc.simulacoes += l.simulacoes;
      acc.favoritos += l.favoritos;
      return acc;
    },
    { imoveis: linhas.length, visualizacoes: 0, simulacoes: 0, favoritos: 0 },
  );

  return { imoveis: linhas, totais };
}
