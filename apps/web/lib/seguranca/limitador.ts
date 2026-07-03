// LIMITADOR DE TAXA em memória (janela deslizante) — proteção leve contra
// loops/abuso nas superfícies que consomem IA paga (Groq/Whisper): uma sessão
// comprometida ou um script não deve conseguir estourar a cota da chave e
// degradar o assistente para todos os tenants.
//
// Design: Map módulo-level chave → timestamps (ms) das chamadas recentes.
// A cada chamada podamos os timestamps fora da janela; se sobraram menos que
// o máximo, registra e permite. Custo O(máximo) por chamada, sem dependência
// nova e sem IO.
//
// CAVEAT (documentado de propósito): em serverless o Map vive POR INSTÂNCIA,
// então o teto real é aproximado (N instâncias ⇒ até N× o limite). Isso basta
// contra loops (que reutilizam instâncias quentes); para garantia dura,
// complementar com rate limit por IP no Vercel WAF (config de plataforma).

const chamadasPorChave = new Map<string, number[]>();

/** Evita crescimento sem fim do Map em instâncias longevas. */
const MAX_CHAVES = 10_000;

/**
 * true se a chamada identificada por `chave` cabe no limite de `maxNaJanela`
 * ocorrências por `janelaMs`; registra a ocorrência quando permite.
 * Chame APÓS autenticar/autorizar (chaves são por usuário — não gastar
 * memória com anônimos).
 */
export function permitido(
  chave: string,
  maxNaJanela: number,
  janelaMs: number,
): boolean {
  const agora = Date.now();
  const recentes = (chamadasPorChave.get(chave) ?? []).filter(
    (t) => agora - t < janelaMs,
  );
  if (recentes.length >= maxNaJanela) {
    chamadasPorChave.set(chave, recentes);
    return false;
  }
  if (!chamadasPorChave.has(chave) && chamadasPorChave.size >= MAX_CHAVES) {
    chamadasPorChave.clear();
  }
  recentes.push(agora);
  chamadasPorChave.set(chave, recentes);
  return true;
}
