// CONEXÃO META (WhatsApp Cloud API) — fotografia honesta da integração via
// statusConexaoMeta(): cards Conectado/Pendente por item (envio, webhook,
// service role), a lista do que falta (SÓ NOMES de env — NUNCA valores), a
// SAÚDE do atendimento (IA, mensagens do dia, fila humana, webhook vivo) e o
// passo a passo resumido com a URL do webhook para colar na Meta. Toda a
// equipe vê o status; os detalhes de configuração aparecem para gestor/admin.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  Bot,
  Cable,
  CheckCircle2,
  Clock,
  KeyRound,
  Send,
  Webhook,
} from "lucide-react";
import { obterPerfil, obterSessao } from "@/lib/auth/sessao";
import { obterConfigAtendimento } from "@/lib/dados/atendimento-config";
import { statusConexaoMeta } from "@/lib/dados/meta-config";
import { saudeDoAtendimento } from "@/lib/dados/saude-atendimento";
import { tempoRelativo } from "../../leads/tempo";

export const metadata: Metadata = { title: "CRM — Conexão" };
export const dynamic = "force-dynamic";

const URL_WEBHOOK = "https://mob-ia.vercel.app/api/meta/webhook";

const ENVS_ENVIO = ["META_WHATSAPP_TOKEN", "META_WHATSAPP_PHONE_NUMBER_ID"];
const ENVS_WEBHOOK = ["META_WEBHOOK_VERIFY_TOKEN", "META_APP_SECRET"];
const ENVS_SERVICE = ["SUPABASE_SERVICE_ROLE_KEY"];

export default async function PaginaConexao() {
  const sessao = await obterSessao();
  if (!sessao) {
    redirect("/entrar");
  }
  const perfil = await obterPerfil(sessao.usuarioId);
  const papel = perfil?.papel ?? "cliente";
  const ehGestor = papel === "gestor" || papel === "admin";

  const meta = statusConexaoMeta();
  const [configIa, saude] = await Promise.all([
    obterConfigAtendimento(),
    saudeDoAtendimento(),
  ]);
  const faltando = new Set(meta.faltando);
  const pendentes = (envs: string[]) => envs.filter((e) => faltando.has(e));

  const itens = [
    {
      titulo: "Envio — API do WhatsApp",
      descricao: "Token e número conectados para enviar mensagens e templates.",
      icone: <Send className="h-5 w-5" aria-hidden />,
      pronto: meta.conectado,
      envsPendentes: pendentes(ENVS_ENVIO),
    },
    {
      titulo: "Webhook — receber mensagens",
      descricao: "Verificação e assinatura dos eventos que a Meta manda para cá.",
      icone: <Webhook className="h-5 w-5" aria-hidden />,
      pronto: pendentes(ENVS_WEBHOOK).length === 0,
      envsPendentes: pendentes(ENVS_WEBHOOK),
    },
    {
      titulo: "Service role — gravar eventos",
      descricao: "Credencial do servidor para o webhook registrar as mensagens.",
      icone: <KeyRound className="h-5 w-5" aria-hidden />,
      pronto: pendentes(ENVS_SERVICE).length === 0,
      envsPendentes: pendentes(ENVS_SERVICE),
    },
  ];

  const tudoPronto = meta.conectado && meta.webhookPronto;

  return (
    <>
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Conexão WhatsApp
        </h1>
        <p className="mt-1 text-muted">
          Integração oficial com a Meta (WhatsApp Cloud API) — status honesto do
          que já funciona neste ambiente.
        </p>
      </header>

      {tudoPronto ? (
        <p className="mt-6 flex items-center gap-2 rounded-2xl border border-brand/30 bg-brand-soft px-5 py-4 text-sm font-medium text-brand-strong">
          <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />
          Tudo conectado: envio, webhook e gravação de eventos prontos.
        </p>
      ) : (
        <p className="mt-6 flex items-center gap-2 rounded-2xl border border-gold/40 bg-gold-soft px-5 py-4 text-sm text-foreground">
          <Cable className="h-5 w-5 shrink-0 text-gold-strong" aria-hidden />
          Integração pendente — enquanto isso, as conversas 1:1 funcionam pelo
          link do WhatsApp (wa.me) e nada quebra.
        </p>
      )}

      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3" aria-label="Itens da conexão">
        {itens.map((item) => (
          <div
            key={item.titulo}
            className={`flex flex-col gap-3 rounded-2xl border p-5 shadow-[var(--shadow-soft)] ${
              item.pronto ? "border-brand/30 bg-brand-soft" : "border-border bg-surface-card"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className={item.pronto ? "text-brand-strong" : "text-subtle"}>
                {item.icone}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] ${
                  item.pronto
                    ? "bg-brand text-brand-contrast"
                    : "bg-gold-soft text-gold-strong ring-1 ring-inset ring-gold/40"
                }`}
              >
                {item.pronto ? (
                  <CheckCircle2 className="h-3 w-3" aria-hidden />
                ) : (
                  <Clock className="h-3 w-3" aria-hidden />
                )}
                {item.pronto ? "Conectado" : "Pendente"}
              </span>
            </div>
            <p className="font-semibold text-foreground">{item.titulo}</p>
            <p className="text-xs text-subtle">{item.descricao}</p>
            {ehGestor && item.envsPendentes.length > 0 && (
              <p className="flex flex-wrap gap-1.5">
                {item.envsPendentes.map((env) => (
                  <code
                    key={env}
                    className="rounded-md bg-surface px-1.5 py-0.5 text-[11px] text-foreground ring-1 ring-inset ring-border-strong/60"
                  >
                    {env}
                  </code>
                ))}
              </p>
            )}
          </div>
        ))}
      </section>

      {/* ——— SAÚDE do atendimento ——— */}
      <section className="mt-8" aria-label="Saúde do atendimento">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Activity className="h-5 w-5 text-brand-strong" aria-hidden />
          Saúde do atendimento
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* IA */}
          <div
            className={`flex flex-col gap-2 rounded-2xl border p-5 shadow-[var(--shadow-soft)] ${
              configIa?.iaDisponivelNoAmbiente && configIa.config.iaAtiva
                ? "border-brand/30 bg-brand-soft"
                : "border-border bg-surface-card"
            }`}
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Bot className="h-4 w-4 text-brand-strong" aria-hidden />
              IA de atendimento
            </span>
            <p className="text-xs text-muted">
              {!configIa?.iaDisponivelNoAmbiente
                ? "Sem GROQ_API_KEY neste ambiente — a IA não responde e tudo cai na fila humana."
                : configIa.config.iaAtiva
                  ? `Ligada — a ${configIa.config.nomeAssistente} responde e escala o que precisar de gente.`
                  : "Chave presente, mas a IA está desligada na organização."}
            </p>
            {ehGestor && (
              <Link
                href="/corretor/crm/treinar-ia"
                className="text-xs font-medium text-brand-strong underline-offset-2 hover:underline"
              >
                Treinar IA →
              </Link>
            )}
          </div>

          {/* Mensagens de hoje */}
          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface-card p-5 shadow-[var(--shadow-soft)]">
            <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Send className="h-4 w-4 text-brand-strong" aria-hidden />
              Mensagens hoje
            </span>
            <p className="flex flex-wrap items-center gap-3 text-sm text-foreground">
              <span className="inline-flex items-center gap-1">
                <ArrowDownLeft className="h-4 w-4 text-brand-strong" aria-hidden />
                <strong>{saude?.entradasHoje ?? 0}</strong> recebidas
              </span>
              <span className="inline-flex items-center gap-1">
                <ArrowUpRight className="h-4 w-4 text-gold-strong" aria-hidden />
                <strong>{saude?.saidasHoje ?? 0}</strong> enviadas
              </span>
            </p>
            <p className="text-xs text-subtle">Dia-calendário de São Paulo.</p>
          </div>

          {/* Fila humana agora */}
          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface-card p-5 shadow-[var(--shadow-soft)]">
            <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Bell className="h-4 w-4 text-brand-strong" aria-hidden />
              Aguardando humano
            </span>
            <p className="text-2xl font-semibold tracking-tight text-foreground">
              {saude?.aguardandoHumano ?? 0}
            </p>
            <Link
              href="/corretor/crm/conversas?fila=precisam"
              className="text-xs font-medium text-brand-strong underline-offset-2 hover:underline"
            >
              Abrir a fila Precisam →
            </Link>
          </div>

          {/* Webhook vivo */}
          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface-card p-5 shadow-[var(--shadow-soft)]">
            <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Webhook className="h-4 w-4 text-brand-strong" aria-hidden />
              Última recebida
            </span>
            <p className="text-sm text-foreground">
              {saude?.ultimaEntradaEm
                ? tempoRelativo(saude.ultimaEntradaEm)
                : "Nenhuma mensagem recebida ainda."}
            </p>
            <p className="text-xs text-subtle">
              {saude?.ultimaEntradaEm
                ? "Mensagens chegando = webhook vivo."
                : "Quando o webhook receber a primeira mensagem, ela aparece aqui."}
            </p>
          </div>
        </div>
      </section>

      {ehGestor ? (
        <section className="mt-6 rounded-2xl border border-border bg-surface-card p-6 shadow-[var(--shadow-soft)]">
          <h2 className="text-lg font-semibold text-foreground">Como conectar</h2>
          <p className="mt-1 text-sm text-muted">
            Resumo do passo a passo — o guia completo está em{" "}
            <code className="rounded-md bg-surface px-1.5 py-0.5 text-xs ring-1 ring-inset ring-border-strong/60">
              docs/DEPLOY.md
            </code>{" "}
            do repositório (seção &ldquo;Conectar WhatsApp&rdquo;).
          </p>
          <ol className="mt-4 flex list-decimal flex-col gap-2.5 pl-5 text-sm text-foreground">
            <li>
              Crie o app na Meta (Business Manager) e adicione o produto{" "}
              <strong>WhatsApp</strong>.
            </li>
            <li>
              Gere o token permanente de system user e copie o{" "}
              <em>Phone Number ID</em>.
            </li>
            <li>
              Preencha as variáveis de ambiente na Vercel (nomes acima) e faça um
              novo deploy — os valores nunca aparecem nesta tela.
            </li>
            <li>
              Configure o webhook na Meta com a URL abaixo e o mesmo{" "}
              <em>verify token</em> da variável, e assine o campo{" "}
              <strong>messages</strong>.
            </li>
            <li>
              Crie e aprove os templates de mensagem — campanhas e conversas fora
              da janela de 24h só saem por template.
            </li>
          </ol>
          <p className="mt-4 text-sm font-medium text-foreground">URL do webhook</p>
          <p className="mt-1.5 overflow-x-auto rounded-xl border border-border bg-surface p-3">
            <code className="whitespace-nowrap text-sm text-foreground">{URL_WEBHOOK}</code>
          </p>
        </section>
      ) : (
        <p className="mt-6 rounded-xl border border-border bg-surface p-4 text-sm text-subtle">
          A configuração é feita pelo gestor da imobiliária. Quando a conexão
          estiver ativa, as conversas e campanhas passam a sair por aqui
          automaticamente.
        </p>
      )}
    </>
  );
}
