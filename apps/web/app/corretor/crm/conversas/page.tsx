// CAIXA DE ENTRADA do atendimento (CRM 2.0, estágio IA). Server Component em
// DUAS COLUNAS: à esquerda as FILAS em chips com contadores (Precisam / IA /
// Minhas / Todas) + a lista de conversas; à direita a THREAD do contato
// selecionado (?contato=id) com bolhas, selo IA (autor_ia 0031), ticks ✓✓,
// ações de fila e composer. Contato de SIMULAÇÃO ganha banner + input
// "responder como cliente" (a IA responde de verdade; a Meta nunca é chamada).
// Abrir a thread zera nao_lidas (MarcarLida) — visto é visto.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Bell,
  Bot,
  CheckCheck,
  Clock,
  FlaskConical,
  Inbox,
  MessagesSquare,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { EstadoVazio } from "@/components/EstadoVazio";
import { obterPerfil, obterSessao } from "@/lib/auth/sessao";
import { obterConfigAtendimento } from "@/lib/dados/atendimento-config";
import { FILAS_CONVERSA, type FilaConversa } from "@/lib/dados/atendimento-nucleo";
import {
  listarConversas,
  listarMensagensDoContato,
  obterContatoDaConversa,
  type ConversaResumo,
} from "@/lib/dados/conversas";
import { statusConexaoMeta } from "@/lib/dados/meta-config";
import { obterOrgConfig } from "@/lib/dados/org-config";
import { listarTemplates } from "@/lib/dados/templates";
import { plural } from "@/lib/plural";
import { tempoRelativo } from "../../leads/tempo";
import { TicksMensagem } from "../StatusMensagem";
import { AcoesConversa } from "./AcoesConversa";
import { BotaoSimular } from "./BotaoSimular";
import { ComposerConversa } from "./ComposerConversa";
import { MarcarLida } from "./MarcarLida";
import { SimuladorCliente } from "./SimuladorCliente";

export const metadata: Metadata = { title: "CRM — Conversas" };
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FMT_HORA_SP = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

const CHIP_FILA: Record<FilaConversa, { rotulo: string; icone: React.ReactNode }> = {
  precisam: { rotulo: "Precisam", icone: <Bell className="h-3.5 w-3.5" aria-hidden /> },
  ia: { rotulo: "IA", icone: <Bot className="h-3.5 w-3.5" aria-hidden /> },
  minhas: { rotulo: "Minhas", icone: <UserRound className="h-3.5 w-3.5" aria-hidden /> },
  todas: { rotulo: "Todas", icone: <Inbox className="h-3.5 w-3.5" aria-hidden /> },
};

/** Chip do estado de atendimento no cabeçalho da thread. */
function ChipAtendimento({ atendimento }: { atendimento: string }) {
  if (atendimento === "ia") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-semibold text-brand-strong">
        <Bot className="h-3 w-3" aria-hidden />
        IA cuidando
      </span>
    );
  }
  if (atendimento === "resolvido") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold text-subtle ring-1 ring-inset ring-border-strong/60">
        <CheckCheck className="h-3 w-3" aria-hidden />
        Resolvido
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gold-soft px-2.5 py-1 text-[11px] font-semibold text-gold-strong ring-1 ring-inset ring-gold/40">
      <UserRound className="h-3 w-3" aria-hidden />
      Com a equipe
    </span>
  );
}

export default async function PaginaConversas({
  searchParams,
}: {
  searchParams: Promise<{ fila?: string; contato?: string }>;
}) {
  const sessao = await obterSessao();
  if (!sessao) {
    redirect("/entrar");
  }
  const perfil = await obterPerfil(sessao.usuarioId);
  const ehGestor = perfil?.papel === "gestor" || perfil?.papel === "admin";

  const { fila: filaParam, contato: contatoParam } = await searchParams;
  const fila: FilaConversa = (FILAS_CONVERSA as readonly string[]).includes(
    filaParam ?? "",
  )
    ? (filaParam as FilaConversa)
    : "todas";
  const contatoId =
    contatoParam !== undefined && UUID_RE.test(contatoParam) ? contatoParam : null;

  const [{ conversas: daFila, contadores }, configIa, templates, aberta, orgConfig] =
    await Promise.all([
      listarConversas({ fila }),
      obterConfigAtendimento(),
      listarTemplates(),
      contatoId !== null ? obterContatoDaConversa(contatoId) : Promise.resolve(null),
      obterOrgConfig(),
    ]);
  const modoTeste = orgConfig === null || orgConfig.whatsappModo !== "producao";
  const mensagens =
    aberta !== null ? await listarMensagensDoContato(aberta.contatoId, 200) : [];
  const meta = statusConexaoMeta();
  const iaAtiva = configIa?.config.iaAtiva ?? false;
  const templatesAprovados = templates
    .filter((t) => t.statusMeta === "aprovado")
    .map((t) => t.nome);

  const hrefFila = (f: FilaConversa) =>
    `/corretor/crm/conversas?fila=${f}${aberta !== null ? `&contato=${aberta.contatoId}` : ""}`;
  const hrefConversa = (c: ConversaResumo) =>
    `/corretor/crm/conversas?fila=${fila}&contato=${c.contatoId}`;

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Conversas
          </h1>
          <p className="mt-1 text-muted">
            A caixa de entrada do atendimento — a IA responde o que sabe e só o
            que precisa de gente sobe para a fila.
          </p>
        </div>
        {ehGestor && <BotaoSimular />}
      </header>

      {/* Banner discreto do MODO TESTE (central de configuração, 0033) */}
      {modoTeste && (
        <p className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-gold/40 bg-gold-soft px-3 py-2 text-xs font-medium text-gold-strong">
          <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Modo teste ativo: mensagens reais só saem para os números de teste da
          organização ({orgConfig?.whatsappNumerosTeste.length ?? 0} cadastrado(s)).
          {ehGestor && (
            <Link
              href="/corretor/config#whatsapp"
              className="font-semibold underline underline-offset-2 hover:opacity-80"
            >
              Ajustar na central →
            </Link>
          )}
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)]">
        {/* ——— Coluna esquerda: filas + lista ——— */}
        <section aria-label="Filas de conversas">
          <nav aria-label="Filas de atendimento" className="flex flex-wrap gap-1.5">
            {FILAS_CONVERSA.map((f) => {
              const ativo = f === fila;
              return (
                <Link
                  key={f}
                  href={hrefFila(f)}
                  aria-current={ativo ? "page" : undefined}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25 ${
                    ativo
                      ? "border-brand bg-brand text-brand-contrast"
                      : "border-border-strong bg-surface-card text-muted hover:border-brand/50 hover:text-foreground"
                  }`}
                >
                  {CHIP_FILA[f].icone}
                  {CHIP_FILA[f].rotulo}
                  <span
                    className={`inline-flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                      ativo ? "bg-brand-contrast/20" : "bg-surface text-subtle"
                    }`}
                  >
                    {contadores[f]}
                  </span>
                </Link>
              );
            })}
          </nav>

          {daFila.length === 0 ? (
            <EstadoVazio
              className="mt-4"
              icone={<MessagesSquare className="h-6 w-6" aria-hidden />}
              titulo={
                fila === "todas" ? "Nenhuma conversa ainda" : "Fila vazia — bom sinal"
              }
              descricao={
                fila === "todas"
                  ? meta.webhookPronto
                    ? "Quando um contato mandar mensagem no número conectado, a conversa aparece aqui na hora."
                    : "Assim que a integração com a Meta estiver conectada, as mensagens recebidas viram conversas nesta tela."
                  : "Nada esperando nesta fila agora. As outras abas mostram o restante das conversas."
              }
              cta={
                fila === "todas" && !meta.webhookPronto
                  ? { href: "/corretor/crm/conexao", rotulo: "Ver conexão" }
                  : undefined
              }
            />
          ) : (
            <ul className="mt-4 flex flex-col gap-2" aria-label="Conversas da fila">
              {daFila.map((c) => {
                const selecionadaAqui = aberta !== null && c.contatoId === aberta.contatoId;
                return (
                  <li key={c.contatoId}>
                    <Link
                      href={hrefConversa(c)}
                      aria-current={selecionadaAqui ? "true" : undefined}
                      className={`flex items-center gap-3 rounded-2xl border p-3 shadow-[var(--shadow-soft)] transition-[border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25 ${
                        selecionadaAqui
                          ? "border-brand bg-brand-soft/60"
                          : "border-border bg-surface-card hover:border-brand/30 hover:shadow-[var(--shadow-card)]"
                      }`}
                    >
                      <span
                        aria-hidden
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand-strong"
                      >
                        {c.contatoNome.trim().charAt(0).toUpperCase() || "?"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold text-foreground">
                            {c.contatoNome}
                          </span>
                          {c.atendimento === "ia" && (
                            <Bot
                              className="h-3.5 w-3.5 shrink-0 text-brand-strong"
                              aria-label="IA cuidando desta conversa"
                            />
                          )}
                          {c.simulacao && (
                            <FlaskConical
                              className="h-3.5 w-3.5 shrink-0 text-gold-strong"
                              aria-label="Conversa de teste do simulador"
                            />
                          )}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                          {c.ultimaMensagem.direcao === "saida" && (
                            <TicksMensagem status={c.ultimaMensagem.status} />
                          )}
                          <span className="truncate">{c.ultimaMensagem.corpo}</span>
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-[11px] text-subtle">
                          {tempoRelativo(c.ultimaMensagem.criadoEm)}
                        </span>
                        {c.naoLidas > 0 && (
                          <span
                            className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand px-1.5 py-0.5 text-[11px] font-bold text-brand-contrast"
                            aria-label={`${c.naoLidas} ${plural(c.naoLidas, "mensagem não lida", "mensagens não lidas")}`}
                          >
                            {c.naoLidas}
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ——— Coluna direita: thread ——— */}
        <section
          aria-label="Conversa aberta"
          className="flex min-h-[24rem] flex-col rounded-2xl border border-border bg-surface-card shadow-[var(--shadow-soft)]"
        >
          {aberta === null ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <EstadoVazio
                className="w-full border-0 shadow-none"
                icone={<MessagesSquare className="h-6 w-6" aria-hidden />}
                titulo="Escolha uma conversa"
                descricao="Selecione um contato na lista ao lado para ver o histórico e responder por aqui."
              />
            </div>
          ) : (
            <>
              <MarcarLida contatoId={aberta.contatoId} naoLidas={aberta.naoLidas} />

              {/* Cabeçalho da thread */}
              <div className="border-b border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand-strong"
                    >
                      {aberta.contatoNome.trim().charAt(0).toUpperCase() || "?"}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">
                        {aberta.contatoNome}
                      </p>
                      <p className="flex flex-wrap items-center gap-2 text-xs text-subtle">
                        {aberta.telefoneFormatado !== null && (
                          <span>{aberta.telefoneFormatado}</span>
                        )}
                        <ChipAtendimento atendimento={aberta.atendimento} />
                        {aberta.janela.aberta && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand-strong">
                            <Clock className="h-3 w-3" aria-hidden />
                            Janela aberta
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/corretor/crm/contatos/${aberta.contatoId}`}
                    className="shrink-0 text-sm font-medium text-brand-strong underline-offset-2 hover:underline"
                  >
                    Ver ficha →
                  </Link>
                </div>
                <div className="mt-3">
                  <AcoesConversa
                    contatoId={aberta.contatoId}
                    atendimento={aberta.atendimento}
                    atribuidaAMim={aberta.atribuidoA === sessao.usuarioId}
                    iaAtiva={iaAtiva}
                  />
                </div>
              </div>

              {/* Banner de simulação */}
              {aberta.simulacao && (
                <p className="mx-4 mt-3 flex items-center gap-2 rounded-xl border border-gold/40 bg-gold-soft px-3 py-2 text-xs font-medium text-gold-strong">
                  <FlaskConical className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Conversa de teste — nada sai para o WhatsApp.
                </p>
              )}

              {/* Histórico (col-reverse ancora o scroll na última mensagem) */}
              <div
                className="flex max-h-[26rem] flex-1 flex-col-reverse gap-2 overflow-y-auto p-4"
                aria-label={`Histórico da conversa com ${aberta.contatoNome}`}
              >
                {mensagens.length === 0 ? (
                  <p className="text-center text-sm text-subtle">
                    Sem mensagens ainda.
                    {aberta.simulacao &&
                      " Envie a primeira como cliente, logo abaixo, e veja a IA trabalhar."}
                  </p>
                ) : (
                  [...mensagens].reverse().map((m) => {
                    const entrada = m.direcao === "entrada";
                    return (
                      <div
                        key={m.id}
                        className={`flex ${entrada ? "justify-start" : "justify-end"}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-3.5 py-2 shadow-[var(--shadow-soft)] ${
                            entrada
                              ? "rounded-tl-sm border border-border bg-surface"
                              : "rounded-tr-sm bg-brand-soft"
                          }`}
                        >
                          {!entrada && m.autorIa && (
                            <p className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold text-brand-strong">
                              <Bot className="h-3 w-3" aria-hidden />
                              IA
                            </p>
                          )}
                          <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                            {m.corpo}
                          </p>
                          <p className="mt-1 flex items-center justify-end gap-2 text-[11px] text-subtle">
                            <span>{FMT_HORA_SP.format(new Date(m.criadoEm))}</span>
                            {!entrada && <TicksMensagem status={m.status} />}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Composer + simulador */}
              <div className="flex flex-col gap-3 border-t border-border p-4">
                <ComposerConversa
                  contatoId={aberta.contatoId}
                  telefone={aberta.telefone}
                  janelaAberta={aberta.janela.aberta}
                  metaConectada={meta.conectado}
                  simulacao={aberta.simulacao}
                  templatesAprovados={templatesAprovados}
                />
                {aberta.simulacao && ehGestor && (
                  <SimuladorCliente contatoId={aberta.contatoId} />
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}
