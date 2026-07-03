"use server";

// Barrel "use server" das Server Actions da Comunidade. Os Client Components
// (ComposerPost, PostCard, BotaoSeguir) importam as actions DAQUI — não de
// lib/dados/comunidade.ts. Aquele módulo mistura tipos + leituras + imports
// server-only (revalidatePath, cliente Supabase de servidor) e NÃO é "use
// server" no topo, então referenciá-lo do bundle de cliente quebra o build.
// Este arquivo expõe SOMENTE funções async (regra do "use server"), re-embrulhando
// as implementações reais que vivem na camada de dados.

import {
  publicarPostAction as _publicar,
  curtirAction as _curtir,
  descurtirAction as _descurtir,
  seguirAction as _seguir,
  deixarDeSeguirAction as _deixarDeSeguir,
  type ResultadoAcao,
} from "@/lib/dados/comunidade";

export async function publicarPostAction(input: unknown): Promise<ResultadoAcao> {
  return _publicar(input);
}

export async function curtirAction(postId: string): Promise<ResultadoAcao> {
  return _curtir(postId);
}

export async function descurtirAction(postId: string): Promise<ResultadoAcao> {
  return _descurtir(postId);
}

export async function seguirAction(perfilId: string): Promise<ResultadoAcao> {
  return _seguir(perfilId);
}

export async function deixarDeSeguirAction(perfilId: string): Promise<ResultadoAcao> {
  return _deixarDeSeguir(perfilId);
}
