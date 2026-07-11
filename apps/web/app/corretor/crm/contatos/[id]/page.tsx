// FICHA DO CONTATO (a estrela do CRM 2.0). Server Component: cabeçalho com
// ações de contato + tags editáveis, TIMELINE UNIFICADA (negócios, atividades,
// tarefas e mensagens com ticks de status) e coluna lateral com consentimento
// LGPD, negócios vinculados, janela de 24h e o composer de mensagem. Os status
// das mensagens vêm de listarMensagensDoContato (a timeline pura não os
// carrega) casados pelo id embutido na chave "mensagem:<id>".

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckSquare,
  Clock,
  Handshake,
  History,
  Mail,
  MessageCircle,
  Phone,
  StickyNote,
} from "lucide-react";
import { formatarReais } from "@imobia/core";
import { EstadoVazio } from "@/components/EstadoVazio";
import { classesBotao } from "@/components/ui/Botao";
import { listarMensagensDoContato } from "@/lib/dados/conversas";
import { obterContato } from "@/lib/dados/contatos";
import { statusConexaoMeta } from "@/lib/dados/meta-config";
import { plural } from "@/lib/plural";
import type { OrigemTimeline } from "@/lib/dados/crm-nucleo";
import { tempoRelativo } from "../../../leads/tempo";
import { ROTULO_ETAPA, ROTULO_RESULTADO } from "../../../negocios/rotulos";
import { TicksMensagem } from "../../StatusMensagem";
import { ComposerMensagem } from "./ComposerMensagem";
import { ConsentimentoContato } from "./ConsentimentoContato";
import { TagsContato } from "./TagsContato";
import type { ResultadoNegocio } from "@imobia/domain";

export const metadata: Metadata = { title: "Contato" };
export const dynamic = "force-dynamic";

// Id fora do formato UUID nunca existe — 404 direto (evita 500 no cast uuid).
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FMT_HORA_SP = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

/** Ícone + cor do ponto da timeline por origem do item. */
const ESTILO_ORIGEM: Record<
  OrigemTimeline,
  { icone: React.ReactNode; classes: string }
> = {
  negocio: {
    icone: <Handshake className="h-4 w-4" aria-hidden />,
    classes: "bg-brand-soft text-brand-strong",
  },
  atividade: {
    icone: <StickyNote className="h-4 w-4" aria-hidden />,
    classes: "bg-gold-soft text-gold-strong",
  },
  tarefa: {
    icone: <CheckSquare className="h-4 w-4" aria-hidden />,
    classes: "bg-surface text-subtle",
  },
  mensagem: {
    icone: <MessageCircle className="h-4 w-4" aria-hidden />,
    classes: "bg-brand-soft text-brand-strong",
  },
};

function rotuloResultado(resultado: string | null): string | null {
  if (resultado !== "ganho" && resultado !== "perdido") {
    return null;
  }
  return ROTULO_RESULTADO[resultado as ResultadoNegocio];
}

export default async function PaginaContato({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    notFound();
  }
  const [detalhe, mensagens] = await Promise.all([
    obterContato(id),
    listarMensagensDoContato(id),
  ]);
  if (!detalhe) {
    notFound();
  }
  const { contato, negocios, timeline, janela } = detalhe;
  const meta = statusConexaoMeta();

  // Ticks: status por id de mensagem (a chave da timeline é "mensagem:<id>").
  const mensagemPorId = new Map(mensagens.map((m) => [m.id, m]));

  return (
    <>
      <Link
        href="/corretor/crm"
        className="text-sm text-muted transition-colors hover:text-brand-strong"
      >
        ← Voltar aos contatos
      </Link>

      {/* Cabeçalho: nome + ações de contato + tags editáveis */}
      <header className="mt-4">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {contato.nome}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {[contato.telefoneFormatado, contato.email].filter(Boolean).join(" · ") ||
            "Sem telefone nem e-mail cadastrados"}
          {contato.responsavelNome ? ` · responsável: ${contato.responsavelNome}` : ""}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {contato.telefone && (
            <a href={`tel:${contato.telefone}`} className={classesBotao("secundario", "sm")}>
              <Phone className="h-4 w-4" aria-hidden />
              Ligar
            </a>
          )}
          {contato.telefone && (
            <a
              href={`https://wa.me/${contato.telefone}`}
              target="_blank"
              rel="noopener noreferrer"
              className={classesBotao("secundario", "sm")}
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              WhatsApp
            </a>
          )}
          {contato.email && (
            <a href={`mailto:${contato.email}`} className={classesBotao("secundario", "sm")}>
              <Mail className="h-4 w-4" aria-hidden />
              E-mail
            </a>
          )}
        </div>
        <div className="mt-4">
          <TagsContato contatoId={contato.id} tags={contato.tags} />
        </div>
        {contato.observacao && (
          <p className="mt-4 rounded-xl border border-border bg-surface p-3 text-sm text-muted">
            {contato.observacao}
          </p>
        )}
      </header>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Coluna principal: TIMELINE UNIFICADA */}
        <section aria-label="Linha do tempo do contato">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <History className="h-5 w-5 text-brand-strong" aria-hidden />
            Linha do tempo
          </h2>
          {timeline.length === 0 ? (
            <EstadoVazio
              className="mt-4"
              icone={<History className="h-6 w-6" aria-hidden />}
              titulo="Nada por aqui ainda"
              descricao="Mensagens, negócios, tarefas e atividades deste contato aparecem aqui, do mais recente ao mais antigo."
            />
          ) : (
            <ol className="mt-4 flex flex-col gap-4 border-l border-border pl-5">
              {timeline.map((item) => {
                const estilo = ESTILO_ORIGEM[item.origem];
                const mensagem =
                  item.origem === "mensagem"
                    ? mensagemPorId.get(item.chave.slice("mensagem:".length))
                    : undefined;
                const entrada = mensagem?.direcao === "entrada";
                return (
                  <li key={item.chave} className="relative">
                    <span
                      className={`absolute -left-[37px] top-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface-card ${estilo.classes}`}
                      aria-hidden
                    >
                      {item.origem === "mensagem" ? (
                        entrada ? (
                          <ArrowDownLeft className="h-4 w-4" aria-hidden />
                        ) : (
                          <ArrowUpRight className="h-4 w-4" aria-hidden />
                        )
                      ) : (
                        estilo.icone
                      )}
                    </span>
                    <div className="ml-1 rounded-xl border border-border bg-surface-card p-3 shadow-[var(--shadow-soft)]">
                      <p className="text-sm text-foreground">{item.titulo}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-subtle">
                        {item.detalhe && <span>{item.detalhe}</span>}
                        {mensagem && !entrada && <TicksMensagem status={mensagem.status} />}
                        <span>{tempoRelativo(item.data)}</span>
                        {item.negocioId && (
                          <Link
                            href={`/corretor/negocios/${item.negocioId}`}
                            className="font-medium text-brand-strong underline-offset-2 hover:underline"
                          >
                            Ver negócio
                          </Link>
                        )}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {/* Coluna lateral: LGPD, negócios, janela de 24h e composer */}
        <aside className="flex flex-col gap-4">
          <ConsentimentoContato
            contatoId={contato.id}
            consentimentoEm={contato.consentimentoMarketingEm}
            fonte={contato.consentimentoFonte}
          />

          <section
            aria-label="Negócios do contato"
            className="rounded-2xl border border-border bg-surface-card p-4 shadow-[var(--shadow-soft)]"
          >
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Handshake className="h-4 w-4 text-brand-strong" aria-hidden />
              Negócios ({negocios.length})
            </h2>
            {negocios.length === 0 ? (
              <p className="mt-2 text-xs text-subtle">
                Nenhum negócio vinculado.{" "}
                <Link
                  href="/corretor/negocios/novo"
                  className="font-medium text-brand-strong underline-offset-2 hover:underline"
                >
                  Criar no funil
                </Link>
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {negocios.map((n) => {
                  const etapaRotulo =
                    n.etapa in ROTULO_ETAPA
                      ? ROTULO_ETAPA[n.etapa as keyof typeof ROTULO_ETAPA]
                      : n.etapa;
                  const fechado = rotuloResultado(n.resultado);
                  return (
                    <li key={n.id}>
                      <Link
                        href={`/corretor/negocios/${n.id}`}
                        className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface p-3 transition-colors hover:border-brand/40 hover:bg-surface-card"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-foreground">
                            {n.imovelTitulo ?? "Negócio sem imóvel"}
                          </span>
                          <span className="mt-0.5 block text-xs text-subtle">
                            {fechado ?? etapaRotulo}
                            {n.valor !== null ? ` · ${formatarReais(n.valor)}` : ""}
                          </span>
                        </span>
                        <span aria-hidden className="shrink-0 text-brand">
                          →
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section
            aria-label="Conversa por WhatsApp"
            className="rounded-2xl border border-border bg-surface-card p-4 shadow-[var(--shadow-soft)]"
          >
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <MessageCircle className="h-4 w-4 text-brand-strong" aria-hidden />
              Conversa
            </h2>
            <p
              className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                janela.aberta
                  ? "bg-brand-soft text-brand-strong"
                  : "bg-surface text-subtle ring-1 ring-inset ring-border-strong/60"
              }`}
            >
              <Clock className="h-3 w-3" aria-hidden />
              {janela.aberta && janela.expiraEmISO
                ? `Janela aberta até ${FMT_HORA_SP.format(new Date(janela.expiraEmISO))}`
                : "Janela de 24h fechada"}
            </p>
            {!janela.aberta && (
              <p className="mt-2 text-xs text-subtle">
                A janela abre quando o contato manda mensagem; fora dela, a Meta
                só aceita template aprovado.
              </p>
            )}
            {mensagens.length > 0 && (
              <p className="mt-2 text-xs text-subtle">
                {mensagens.length}{" "}
                {plural(mensagens.length, "mensagem no histórico", "mensagens no histórico")}{" "}
                — a conversa completa está na linha do tempo.
              </p>
            )}
            <div className="mt-3">
              <ComposerMensagem
                contatoId={contato.id}
                telefone={contato.telefone}
                janelaAberta={janela.aberta}
                metaConectada={meta.conectado}
              />
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
