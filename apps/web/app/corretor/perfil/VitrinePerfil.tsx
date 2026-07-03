// VITRINE DO PERFIL DO CORRETOR (Server Component de apresentação). Recebe um
// PerfilCorretor já agregado (lib/dados/perfil.ts) e o desenha com acabamento
// premium na paleta QUENTE ImobIA: cabeçalho rico (capa/gradiente, avatar, nome,
// @handle, papel, org, bio, contato), gamificação (nível + barra + conquistas),
// stats, histórico de vendas e depoimentos. Blocos interativos (editar/depoimentos/
// compartilhar) são componentes client separados. Dinheiro em CENTAVOS; pt-BR.
//
// Reusado pela rota /corretor/perfil (próprio) e /corretor/perfil/[id] (colega).

import Link from "next/link";
import {
  MapPin,
  Building2,
  BadgeCheck,
  CalendarDays,
  Phone,
  MessageCircle,
  AtSign,
  Eye,
  Handshake,
  Wallet,
  Percent,
  Home,
  Trophy,
  Lock,
  Award,
  Calculator,
  Heart,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import { formatarReais } from "@imobia/core";
import type { StatusImovel } from "@imobia/domain";
import type { PerfilCorretor } from "@/lib/dados/perfil";
import type {
  DesempenhoCarteira,
  ImovelDesempenho,
} from "@/lib/dados/carteira";
import { Badge } from "@/components/ui/Badge";
import { Selo } from "@/components/ui/Selo";
import { EditarPerfil } from "./EditarPerfil";
import { Depoimentos } from "./Depoimentos";
import { BotaoCompartilhar } from "./BotaoCompartilhar";

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** ISO → "julho de 2025" (mês/ano). */
function mesAno(iso: string | null): string | null {
  if (!iso) {
    return null;
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return `${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

/** ISO → "12 de jul. de 2025" (data curta) para o histórico. */
function dataCurta(iso: string | null): string | null {
  if (!iso) {
    return null;
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Iniciais (até 2) para o avatar-fallback. */
function iniciais(nome: string | null): string {
  if (!nome) {
    return "?";
  }
  const partes = nome.trim().split(/\s+/);
  const primeiras = [partes[0], partes[partes.length - 1]].filter(Boolean);
  return primeiras
    .map((p) => p!.charAt(0).toUpperCase())
    .join("")
    .slice(0, 2);
}

/** @handle derivado do nome (sem acento, minúsculas, ponto entre nome/sobrenome). */
function handle(nome: string | null): string {
  if (!nome) {
    return "corretor";
  }
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .join(".");
}

/** Só dígitos do telefone — para wa.me / tel:. */
function soDigitos(v: string): string {
  return v.replace(/\D/g, "");
}

export function VitrinePerfil({
  perfil,
  visaoPublica = false,
  carteira = null,
}: {
  perfil: PerfilCorretor;
  /** Renderiza a vitrine exatamente como um colega a vê (esconde ações do dono). */
  visaoPublica?: boolean;
  /**
   * Desempenho da carteira (ferramenta de gestão, não vitrine). As PÁGINAS
   * decidem quem vê: null ⇒ a seção não é renderizada.
   */
  carteira?: DesempenhoCarteira | null;
}) {
  const {
    nome,
    papel,
    orgNome,
    creci,
    bio,
    fotoUrl,
    capaUrl,
    telefone,
    cidade,
    instagram,
    membroDesde,
    ehProprio,
    stats,
    gamificacao,
    historicoVendas,
    depoimentos,
    corretorId,
  } = perfil;

  const ehGestor = papel === "gestor";
  const telDigitos = telefone ? soDigitos(telefone) : "";
  const igHandle = instagram ? instagram.replace(/^@/, "") : "";
  const progressoPct = Math.round(gamificacao.progresso * 100);
  // Na visão pública o dono vê a vitrine sem NENHUMA ação de dono/gestor.
  const donoAqui = ehProprio && !visaoPublica;
  // Gestor pode gerenciar depoimentos de qualquer corretor da org; corretor só o próprio.
  const podeGerenciar = visaoPublica ? false : ehProprio || ehGestor;

  return (
    <div className="w-full max-w-5xl">
      <Link
        href="/corretor"
        className="text-sm text-muted transition-colors hover:text-brand-strong"
      >
        ← Voltar ao painel
      </Link>

      {ehProprio && visaoPublica && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold/40 bg-gold-soft px-4 py-3">
          <p className="inline-flex items-center gap-2 text-sm text-foreground">
            <Eye className="h-4 w-4 text-brand-strong" aria-hidden />
            Você está vendo seu perfil <strong>como os colegas veem</strong>.
          </p>
          <Link
            href="/corretor/perfil"
            className="rounded-xl border border-border-strong bg-surface-card px-4 py-1.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface"
          >
            Voltar à edição
          </Link>
        </div>
      )}

      {/* ————— CABEÇALHO RICO ————— */}
      <section className="mt-4 overflow-hidden rounded-3xl border border-border bg-surface-card shadow-[var(--shadow-card)]">
        {/* Capa: imagem quando houver capaUrl; senão, gradiente quente elegante. */}
        <div className="relative h-40 sm:h-52">
          {capaUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={capaUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className="h-full w-full"
              style={{
                backgroundImage:
                  "linear-gradient(120deg, var(--color-brand-strong) 0%, var(--color-brand) 45%, var(--color-gold) 100%)",
              }}
              aria-hidden
            />
          )}
          {stats.rankingPosicao != null && (
            <div className="absolute right-4 top-4">
              <Selo variante="destaque">
                <Trophy className="h-3.5 w-3.5" aria-hidden />
                {stats.rankingPosicao}º no ranking
              </Selo>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 sm:px-8 sm:pb-8">
          {/* Avatar sobreposto à capa (relative: pinta ACIMA da capa posicionada) */}
          <div className="relative -mt-12 flex items-end justify-between gap-4 sm:-mt-14">
            {fotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={fotoUrl}
                alt={nome ?? "Corretor"}
                className="h-24 w-24 rounded-full border-4 border-surface-card object-cover shadow-[var(--shadow-soft)] sm:h-28 sm:w-28"
              />
            ) : (
              <div
                className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-surface-card bg-brand text-2xl font-semibold text-brand-contrast shadow-[var(--shadow-soft)] sm:h-28 sm:w-28 sm:text-3xl"
                aria-hidden
              >
                {iniciais(nome)}
              </div>
            )}

            {/* Ações */}
            <div className="mb-1 flex items-center gap-2">
              {donoAqui && (
                <Link
                  href="/corretor/perfil?visao=publica"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border-strong bg-surface-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-brand/40 hover:bg-surface"
                >
                  <Eye className="h-4 w-4" aria-hidden />
                  Ver perfil público
                </Link>
              )}
              <BotaoCompartilhar
                caminho={`/corretor/perfil/${corretorId}`}
                nome={nome ?? "corretor"}
              />
            </div>
          </div>

          {/* Nome + handle + papel */}
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {nome ?? "Corretor"}
            </h1>
            <Badge variante={ehGestor ? "destaque" : "marca"}>
              {ehGestor ? "Gestor" : "Corretor"}
            </Badge>
          </div>
          <p className="mt-0.5 text-sm text-brand-strong">@{handle(nome)}</p>

          {/* Metadados */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted">
            {orgNome && (
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="h-4 w-4" aria-hidden />
                {orgNome}
              </span>
            )}
            {cidade && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4" aria-hidden />
                {cidade}
              </span>
            )}
            {creci && (
              <span className="inline-flex items-center gap-1.5">
                <BadgeCheck className="h-4 w-4" aria-hidden />
                CRECI {creci}
              </span>
            )}
            {mesAno(membroDesde) && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" aria-hidden />
                Membro desde {mesAno(membroDesde)}
              </span>
            )}
          </div>

          {/* Bio */}
          {bio && (
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-foreground">
              {bio}
            </p>
          )}

          {/* Contato */}
          {(telDigitos || igHandle) && (
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              {telDigitos && (
                <>
                  <a
                    href={`https://wa.me/${telDigitos}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-contrast shadow-[var(--shadow-soft)] transition-colors hover:bg-brand-hover"
                  >
                    <MessageCircle className="h-4 w-4" aria-hidden />
                    WhatsApp
                  </a>
                  <a
                    href={`tel:+${telDigitos}`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border-strong bg-surface-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-brand/40 hover:bg-surface"
                  >
                    <Phone className="h-4 w-4" aria-hidden />
                    Ligar
                  </a>
                </>
              )}
              {igHandle && (
                <a
                  href={`https://instagram.com/${igHandle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border-strong bg-surface-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-brand/40 hover:bg-surface"
                >
                  <AtSign className="h-4 w-4" aria-hidden />
                  {igHandle}
                </a>
              )}
            </div>
          )}

          {/* Editar (só próprio, fora da visão pública) */}
          {donoAqui && (
            <div className="mt-5">
              <EditarPerfil
                inicial={{ bio, telefone, cidade, instagram, fotoUrl, capaUrl }}
              />
            </div>
          )}
        </div>
      </section>

      {/* ————— GAMIFICAÇÃO ————— */}
      <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Card de nível + progresso */}
        <div className="rounded-2xl border border-brand/30 bg-brand-soft p-6 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-brand-strong">
              <Award className="h-5 w-5" aria-hidden />
              <span className="text-xs font-medium uppercase tracking-[0.08em]">
                Nível
              </span>
            </div>
            <span className="tabular-nums text-sm font-semibold text-brand-strong">
              {gamificacao.xp} XP
            </span>
          </div>
          <p className="mt-3 text-4xl font-semibold tabular-nums text-brand-strong">
            {gamificacao.nivel}
          </p>
          <div className="mt-4">
            <div className="h-3 w-full overflow-hidden rounded-full bg-surface-card/70">
              <div
                className="h-full rounded-full bg-brand"
                style={{ width: `${Math.max(progressoPct, gamificacao.xpNoNivel > 0 ? 4 : 0)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-brand-strong/80 tabular-nums">
              {gamificacao.xpParaProximoNivel > 0
                ? `${gamificacao.xpNoNivel} / ${gamificacao.xpParaProximoNivel} XP para o nível ${gamificacao.nivel + 1}`
                : "Nível máximo atingido"}
            </p>
          </div>
          {stats.rankingPosicao != null && (
            <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-strong">
              <Trophy className="h-4 w-4" aria-hidden />
              {stats.rankingPosicao}º lugar na imobiliária
            </p>
          )}
        </div>

        {/* Grade de conquistas */}
        <div className="rounded-2xl border border-border bg-surface-card p-6 shadow-[var(--shadow-soft)] lg:col-span-2">
          <h2 className="text-lg font-semibold text-foreground">Conquistas</h2>
          <p className="mt-1 text-sm text-muted">
            {gamificacao.conquistas.filter((c) => c.desbloqueada).length} de{" "}
            {gamificacao.conquistas.length} desbloqueadas.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {gamificacao.conquistas.map((c) => (
              <div
                key={c.id}
                className={`flex items-start gap-3 rounded-xl border p-4 transition-colors ${
                  c.desbloqueada
                    ? "border-gold/40 bg-gold-soft"
                    : "border-border bg-surface opacity-70"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    c.desbloqueada
                      ? "bg-gold text-gold-contrast"
                      : "bg-surface-strong text-subtle"
                  }`}
                  aria-hidden
                >
                  {c.desbloqueada ? (
                    <Trophy className="h-4 w-4" />
                  ) : (
                    <Lock className="h-4 w-4" />
                  )}
                </span>
                <div>
                  <p
                    className={`text-sm font-semibold ${
                      c.desbloqueada ? "text-gold-strong" : "text-muted"
                    }`}
                  >
                    {c.titulo}
                  </p>
                  <p className="text-xs text-subtle">{c.descricao}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ————— STATS ————— */}
      <section className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <CardStat
          icone={<Handshake className="h-5 w-5" aria-hidden />}
          rotulo="Negócios ganhos"
          valor={String(stats.negociosGanhos)}
        />
        <CardStat
          icone={<Wallet className="h-5 w-5" aria-hidden />}
          rotulo="Valor vendido"
          valor={formatarReais(stats.valorVendido)}
          destaque
        />
        <CardStat
          icone={<Percent className="h-5 w-5" aria-hidden />}
          rotulo="Conversão"
          valor={`${Math.round(stats.taxaConversao * 100)}%`}
        />
        <CardStat
          icone={<Home className="h-5 w-5" aria-hidden />}
          rotulo="Imóveis na carteira"
          valor={String(stats.imoveis)}
        />
      </section>

      {/* ————— CARTEIRA DE IMÓVEIS (gestão; só quando a página passa carteira) ————— */}
      {carteira != null && (
        <section className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Carteira de imóveis
              </h2>
              <p className="mt-1 text-sm text-muted tabular-nums">
                {carteira.totais.imoveis}{" "}
                {carteira.totais.imoveis === 1 ? "imóvel" : "imóveis"} ·{" "}
                {carteira.totais.visualizacoes} visualizações ·{" "}
                {carteira.totais.simulacoes} simulações ·{" "}
                {carteira.totais.favoritos} favoritos
              </p>
            </div>
            {/* CTAs de gestão levam à carteira do VIEWER — só fazem sentido no próprio perfil. */}
            {donoAqui && (
              <div className="flex items-center gap-2">
                <Link
                  href="/corretor/imoveis/novo"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-contrast shadow-[var(--shadow-soft)] transition-colors hover:bg-brand-hover"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Adicionar imóvel
                </Link>
                <Link
                  href="/corretor/imoveis"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border-strong bg-surface-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-brand/40 hover:bg-surface"
                >
                  <SlidersHorizontal className="h-4 w-4" aria-hidden />
                  Gerenciar
                </Link>
              </div>
            )}
          </div>

          {carteira.imoveis.length === 0 ? (
            <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border-strong bg-surface-card p-10 text-center">
              <Home className="h-8 w-8 text-subtle" aria-hidden />
              <p className="text-sm font-medium text-foreground">
                {donoAqui
                  ? "Você ainda não tem imóveis na carteira"
                  : "Este corretor ainda não tem imóveis na carteira"}
              </p>
              <p className="text-sm text-subtle">
                {donoAqui
                  ? "Cadastre seu primeiro imóvel e acompanhe as interações aqui."
                  : "Os imóveis e as interações da carteira aparecerão aqui."}
              </p>
              {donoAqui && (
                <Link
                  href="/corretor/imoveis/novo"
                  className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-contrast shadow-[var(--shadow-soft)] transition-colors hover:bg-brand-hover"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Adicionar imóvel
                </Link>
              )}
            </div>
          ) : (
            <>
              <p className="mt-4 text-xs font-medium uppercase tracking-[0.08em] text-subtle">
                Mais acessados
              </p>
              <ol className="mt-2 flex flex-col gap-3">
                {carteira.imoveis.slice(0, 6).map((im) => (
                  <li key={im.imovelId}>
                    <CardImovelCarteira imovel={im} />
                  </li>
                ))}
              </ol>
            </>
          )}

          <p className="mt-3 text-xs text-subtle">
            Interações de clientes que autorizaram o compartilhamento de dados
            (LGPD).
          </p>
        </section>
      )}

      {/* ————— HISTÓRICO DE VENDAS ————— */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-foreground">Histórico de vendas</h2>
        <p className="mt-1 text-sm text-muted">Negócios fechados com sucesso.</p>
        {historicoVendas.length === 0 ? (
          <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border-strong bg-surface-card p-10 text-center">
            <Trophy className="h-8 w-8 text-subtle" aria-hidden />
            <p className="text-sm font-medium text-foreground">
              Ainda sem vendas registradas
            </p>
            <p className="text-sm text-subtle">
              As vendas fechadas aparecerão nesta linha do tempo.
            </p>
          </div>
        ) : (
          <ol className="mt-4 flex flex-col gap-3">
            {historicoVendas.map((v) => (
              <li
                key={v.negocioId}
                className="flex items-center gap-4 rounded-2xl border border-border bg-surface-card p-4 shadow-[var(--shadow-soft)]"
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-strong"
                  aria-hidden
                >
                  <Trophy className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{v.contato}</p>
                  <p className="truncate text-sm text-subtle">
                    {v.imovelTitulo ?? "Imóvel"}
                    {dataCurta(v.fechadoEm) ? ` · ${dataCurta(v.fechadoEm)}` : ""}
                  </p>
                </div>
                {v.valor != null && (
                  <span className="shrink-0 tabular-nums font-semibold text-brand-strong">
                    {formatarReais(v.valor)}
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* ————— DEPOIMENTOS ————— */}
      <section className="mt-10">
        <Depoimentos
          corretorId={corretorId}
          depoimentos={depoimentos}
          podeGerenciar={podeGerenciar}
        />
      </section>

      <div className="h-8" />
    </div>
  );
}

// —— Card de imóvel da carteira (linha clicável → ficha pública) ——————————————
const SELO_STATUS: Record<
  StatusImovel,
  { rotulo: string; variante: "marca" | "destaque" | "neutro" }
> = {
  disponivel: { rotulo: "Disponível", variante: "marca" },
  reservado: { rotulo: "Reservado", variante: "destaque" },
  vendido: { rotulo: "Vendido", variante: "neutro" },
};

function CardImovelCarteira({ imovel }: { imovel: ImovelDesempenho }) {
  const selo = SELO_STATUS[imovel.status];
  return (
    <Link
      href={`/imoveis/${imovel.imovelId}`}
      className="flex items-center gap-4 rounded-2xl border border-border bg-surface-card p-3 shadow-[var(--shadow-soft)] transition-colors hover:border-brand/40 hover:bg-surface sm:p-4"
    >
      {/* Thumb */}
      {imovel.fotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imovel.fotoUrl}
          alt=""
          className="h-16 w-20 shrink-0 rounded-xl object-cover sm:h-18 sm:w-24"
        />
      ) : (
        <span
          className="flex h-16 w-20 shrink-0 items-center justify-center rounded-xl bg-surface-strong text-subtle sm:h-18 sm:w-24"
          aria-hidden
        >
          <Home className="h-6 w-6" />
        </span>
      )}

      {/* Título + local + preço */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="truncate font-medium text-foreground">{imovel.titulo}</p>
          <Selo variante={selo.variante}>{selo.rotulo}</Selo>
        </div>
        <p className="mt-0.5 truncate text-sm text-subtle">
          {imovel.cidade}/{imovel.uf}
        </p>
        <p className="mt-1 text-sm font-semibold tabular-nums text-brand-strong">
          {formatarReais(imovel.valor)}
        </p>
      </div>

      {/* Contadores de interação */}
      <div className="flex shrink-0 items-center gap-3 text-sm text-muted sm:gap-4">
        <span
          className="inline-flex items-center gap-1.5 tabular-nums"
          title="Visualizações"
        >
          <Eye className="h-4 w-4 text-brand" aria-hidden />
          {imovel.visualizacoes}
        </span>
        <span
          className="inline-flex items-center gap-1.5 tabular-nums"
          title="Simulações"
        >
          <Calculator className="h-4 w-4 text-brand" aria-hidden />
          {imovel.simulacoes}
        </span>
        <span
          className="inline-flex items-center gap-1.5 tabular-nums"
          title="Favoritos"
        >
          <Heart className="h-4 w-4 text-brand" aria-hidden />
          {imovel.favoritos}
        </span>
      </div>
    </Link>
  );
}

// —— Card de stat ————————————————————————————————————————————————————————————
function CardStat({
  icone,
  rotulo,
  valor,
  destaque = false,
}: {
  icone: React.ReactNode;
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border p-5 shadow-[var(--shadow-soft)] ${
        destaque ? "border-brand/30 bg-brand-soft" : "border-border bg-surface-card"
      }`}
    >
      <div className="flex items-center gap-2 text-subtle">
        <span className={destaque ? "text-brand-strong" : "text-brand"}>{icone}</span>
        <span className="text-xs font-medium uppercase tracking-[0.08em]">{rotulo}</span>
      </div>
      <p className="text-2xl font-semibold tabular-nums text-foreground sm:text-3xl">
        {valor}
      </p>
    </div>
  );
}
