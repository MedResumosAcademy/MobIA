// Rota /comunidade — feed NACIONAL e CROSS-ORG da Comunidade ImobIA. Espaço
// PROFISSIONAL (corretor/gestor/admin); clientes veem um estado gracioso com CTA
// para /imoveis (a página NUNCA vaza dados a não-profissionais — a camada de
// dados já zera tudo, mas o gate aqui evita renderizar o feed).
//
// Layout em 2 colunas responsivo:
//   - Principal: ComposerPost + alternador Todos|Seguindo (URL ?filtro=seguindo)
//     + feed (listarFeed) com um PostCard por item.
//   - Lateral (sticky): "Seu placar" (meuResumoComunidade — streak, pontos,
//     faixa/barra, mini-stats) e "Ranking Nacional" (rankingNacional top 10).
//
// Server Component, force-dynamic (dados de sessão). searchParams é Promise (Next 16).

import type { Metadata } from "next";
import Link from "next/link";
import {
  Flame,
  Trophy,
  Medal,
  Sparkles,
  Users,
  Heart,
  FileText,
} from "lucide-react";
import { obterPapelEOrg } from "@/lib/dados/gestor";
import {
  listarFeed,
  rankingNacional,
  meuResumoComunidade,
} from "@/lib/dados/comunidade";
import { classesBotao } from "@/components/ui/Botao";
import { ComposerPost } from "./ComposerPost";
import { PostCard } from "./PostCard";
import { BotaoSeguir } from "./BotaoSeguir";

export const metadata: Metadata = { title: "Comunidade" };
export const dynamic = "force-dynamic";

// Limiares absolutos das faixas (espelham FAIXAS_COMUNIDADE em @imobia/core),
// usados só para desenhar a barra de progresso relativa à BANDA atual. A fonte
// da verdade (nível/título/faltam) continua vindo de faixaComunidade().
const LIMIARES_FAIXA = [0, 100, 500, 1500, 5000] as const;

type ParametrosBusca = { filtro?: string };

export default async function PaginaComunidade({
  searchParams,
}: {
  searchParams: Promise<ParametrosBusca>;
}) {
  const contexto = await obterPapelEOrg();
  const ehProfissional = contexto !== null && contexto.papel !== "cliente";

  // Gate gracioso: não-profissional vê convite + CTA, sem tocar no feed.
  if (!ehProfissional) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background px-6 py-20 font-sans">
        <div className="mx-auto flex max-w-md flex-col items-center gap-5 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand-strong">
            <Users size={26} aria-hidden="true" />
          </span>
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">
            A Comunidade é o espaço dos corretores
          </h1>
          <p className="text-base leading-relaxed text-muted">
            Aqui corretores e gestores de todo o Brasil trocam conquistas, dicas e
            constroem reputação. Enquanto isso, continue explorando os imóveis.
          </p>
          <Link href="/imoveis" className={classesBotao("primario", "lg")}>
            Explorar imóveis
          </Link>
        </div>
      </div>
    );
  }

  const params = await searchParams;
  const apenasSeguindo = params.filtro === "seguindo";

  const [feed, resumo, ranking] = await Promise.all([
    listarFeed({ apenasSeguindo }),
    meuResumoComunidade(),
    rankingNacional(10),
  ]);

  // `faixa.proxima` = pontos que AINDA FALTAM para a próxima faixa (delta), ou
  // null na faixa máxima. O limiar absoluto da próxima faixa é pontos+proxima; a
  // barra mostra o progresso DENTRO da banda atual (limiar atual → próximo).
  const faltam = resumo.faixa.proxima; // number | null
  const limiarProximo = faltam !== null ? resumo.pontos + faltam : null;
  const limiarAtual = LIMIARES_FAIXA[resumo.faixa.nivel - 1] ?? 0;
  const progresso =
    limiarProximo !== null && limiarProximo > limiarAtual
      ? Math.min(
          100,
          Math.max(
            0,
            Math.round(
              ((resumo.pontos - limiarAtual) / (limiarProximo - limiarAtual)) * 100,
            ),
          ),
        )
      : 100;

  return (
    <div className="bg-background px-4 py-8 font-sans sm:px-6 sm:py-10">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* ——— Coluna principal ——— */}
        <div className="flex flex-col gap-5">
          <header className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Sparkles size={20} className="text-brand" aria-hidden="true" />
              <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">
                Comunidade ImobIA
              </h1>
            </div>
            <p className="text-sm leading-relaxed text-muted">
              Conquistas, dicas e conexões entre corretores de todo o Brasil.
            </p>
          </header>

          <ComposerPost />

          {/* Alternador Todos | Seguindo (URL-driven). */}
          <nav
            className="flex items-center gap-2"
            aria-label="Filtrar o feed"
          >
            <FiltroLink ativo={!apenasSeguindo} href="/comunidade" rotulo="Todos" />
            <FiltroLink
              ativo={apenasSeguindo}
              href="/comunidade?filtro=seguindo"
              rotulo="Seguindo"
            />
          </nav>

          {feed.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border-strong bg-surface-card p-10 text-center">
              <p className="text-sm text-muted">
                {apenasSeguindo
                  ? "Você ainda não segue ninguém — ou quem você segue não publicou. Explore o ranking ao lado."
                  : "Nenhuma publicação por aqui ainda. Seja o primeiro a compartilhar!"}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {feed.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>

        {/* ——— Coluna lateral (sticky) ——— */}
        <aside className="flex flex-col gap-5 lg:sticky lg:top-24 lg:self-start">
          {/* Card: Seu placar */}
          <section className="rounded-2xl border border-border bg-surface-card p-5 shadow-soft">
            <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">
              Seu placar
            </h2>

            {/* Streak em destaque. */}
            <div className="mt-3 flex items-center gap-3 rounded-xl bg-gold-soft/60 p-3">
              <Flame size={22} className="text-brand" aria-hidden="true" />
              <div>
                <p className="text-lg font-semibold leading-none text-foreground">
                  {resumo.streakAtual} {resumo.streakAtual === 1 ? "dia" : "dias"}
                </p>
                <p className="mt-0.5 text-xs text-subtle">
                  Sequência · recorde {resumo.streakRecorde}
                </p>
              </div>
            </div>

            {/* Pontos + faixa + barra. */}
            <div className="mt-4">
              <div className="flex items-baseline justify-between">
                <span className="font-serif text-2xl font-semibold text-foreground">
                  {resumo.pontos}
                  <span className="ml-1 text-sm font-sans font-medium text-subtle">
                    pts
                  </span>
                </span>
                <span className="text-sm font-semibold text-brand-strong">
                  {resumo.faixa.titulo}
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-strong">
                <div
                  className="h-full rounded-full bg-brand transition-[width]"
                  style={{ width: `${progresso}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] text-subtle">
                {faltam !== null
                  ? `Faltam ${Math.max(0, faltam)} pts para a próxima faixa`
                  : "Você atingiu a faixa máxima!"}
              </p>
            </div>

            {/* Mini-stats. */}
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
              <MiniStat icone={<FileText size={14} />} valor={resumo.publicacoes} rotulo="Posts" />
              <MiniStat icone={<Users size={14} />} valor={resumo.seguidores} rotulo="Seguidores" />
              <MiniStat icone={<Heart size={14} />} valor={resumo.curtidasRecebidas} rotulo="Curtidas" />
            </dl>
          </section>

          {/* Card: Ranking Nacional */}
          <section className="rounded-2xl border border-border bg-surface-card p-5 shadow-soft">
            <div className="flex items-center gap-2">
              <Trophy size={16} className="text-gold-strong" aria-hidden="true" />
              <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">
                Ranking Nacional
              </h2>
            </div>

            {ranking.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Ranking em construção.</p>
            ) : (
              <ol className="mt-3 flex flex-col gap-1">
                {ranking.map((m) => (
                  <li
                    key={m.autorId}
                    className={`flex items-center gap-2.5 rounded-xl px-2 py-2 ${
                      m.souEu ? "bg-brand-soft ring-1 ring-brand/25" : ""
                    }`}
                  >
                    <PosicaoSelo posicao={m.posicao} />

                    {m.fotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.fotoUrl}
                        alt={m.nome}
                        width={32}
                        height={32}
                        loading="lazy"
                        className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-border"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-strong ring-1 ring-brand/20"
                      >
                        {(m.nome.trim()[0] ?? "?").toUpperCase()}
                      </span>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {m.nome}
                        {m.souEu && (
                          <span className="ml-1 text-[11px] font-medium text-brand-strong">
                            (você)
                          </span>
                        )}
                      </p>
                      <p className="truncate text-[11px] text-subtle">
                        {m.org ?? "—"} · {m.pontos} pts
                      </p>
                    </div>

                    {!m.souEu && (
                      <BotaoSeguir perfilId={m.autorId} seguindo={m.seguindo} />
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

/** Pílula do alternador de feed (Todos | Seguindo). */
function FiltroLink({
  ativo,
  href,
  rotulo,
}: {
  ativo: boolean;
  href: string;
  rotulo: string;
}) {
  return (
    <Link
      href={href}
      aria-pressed={ativo}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
        ativo
          ? "border border-brand bg-brand-soft text-brand-strong shadow-soft"
          : "border border-border-strong bg-surface-card text-muted hover:border-brand/40 hover:text-foreground"
      }`}
    >
      {rotulo}
    </Link>
  );
}

/** Mini-estatística do placar (ícone + valor + rótulo). */
function MiniStat({
  icone,
  valor,
  rotulo,
}: {
  icone: React.ReactNode;
  valor: number;
  rotulo: string;
}) {
  return (
    <div className="rounded-xl bg-surface p-2">
      <span className="flex items-center justify-center text-brand" aria-hidden="true">
        {icone}
      </span>
      <dd className="mt-1 text-base font-semibold leading-none text-foreground tabular-nums">
        {valor}
      </dd>
      <dt className="mt-0.5 text-[10px] uppercase tracking-wide text-subtle">{rotulo}</dt>
    </div>
  );
}

/** Selo de posição: medalha para 1/2/3, número para o resto. */
function PosicaoSelo({ posicao }: { posicao: number }) {
  const cores: Record<number, string> = {
    1: "text-gold-strong",
    2: "text-subtle",
    3: "text-brand-strong",
  };
  if (posicao <= 3) {
    return (
      <span className="flex w-6 shrink-0 justify-center" aria-label={`${posicao}º lugar`}>
        <Medal size={18} className={cores[posicao]} aria-hidden="true" />
      </span>
    );
  }
  return (
    <span className="w-6 shrink-0 text-center text-sm font-semibold text-subtle tabular-nums">
      {posicao}
    </span>
  );
}
