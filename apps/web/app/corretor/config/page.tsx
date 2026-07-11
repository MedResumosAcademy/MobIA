// CENTRAL DE CONFIGURAÇÕES (/corretor/config) — gestor/admin. Governa os
// ENVIOS (WhatsApp teste/produção, e-mail simulado/real), as INTEGRAÇÕES
// (endpoint de captação + tokens, webhook Meta informativo, webhooks de
// saída assinados), a EQUIPE (membros + convites via RPCs 0033), as METAS do
// time (metas_corretor) e os MOTIVOS DE PERDA. Corretor é redirecionado ao
// painel com aviso. Seções em cards verticais com âncoras (#whatsapp,
// #email, #integracoes, #webhooks, #equipe, #metas, #motivos).

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Bot,
  Cable,
  CheckCircle2,
  Clock,
  KeyRound,
  LayoutTemplate,
  Mail,
  MessagesSquare,
  Plug,
  Target,
  TrendingDown,
  UsersRound,
  Webhook,
} from "lucide-react";
import type { Papel } from "@imobia/domain";
import { obterPapelEOrg } from "@/lib/dados/gestor";
import { obterOrgConfig } from "@/lib/dados/org-config";
import { statusConexaoMeta } from "@/lib/dados/meta-config";
import {
  listarConvites,
  listarMembrosDaOrg,
  listarMetasDoTime,
  listarTokensCaptacao,
  listarWebhooksSaida,
} from "@/lib/dados/config-central";
import { BotaoCopiar } from "./BotaoCopiar";
import { Convites } from "./Convites";
import { MetasTime } from "./MetasTime";
import { SecaoEmail } from "./SecaoEmail";
import { SecaoMotivos } from "./SecaoMotivos";
import { SecaoWhatsapp } from "./SecaoWhatsapp";
import { TokensCaptacao } from "./TokensCaptacao";
import { WebhooksSaida } from "./WebhooksSaida";

export const metadata: Metadata = { title: "Configurações" };
export const dynamic = "force-dynamic";

const URL_CAPTACAO = "https://mob-ia.vercel.app/api/captacao";
const URL_WEBHOOK_META = "https://mob-ia.vercel.app/api/meta/webhook";

const ROTULO_PAPEL: Record<Papel, string> = {
  cliente: "Cliente",
  corretor: "Corretor",
  gestor: "Gestor",
  admin: "Admin",
};

const ANCORAS = [
  { href: "#whatsapp", rotulo: "WhatsApp" },
  { href: "#email", rotulo: "E-mail" },
  { href: "#integracoes", rotulo: "APIs & Integrações" },
  { href: "#webhooks", rotulo: "Webhooks de saída" },
  { href: "#equipe", rotulo: "Equipe" },
  { href: "#metas", rotulo: "Metas" },
  { href: "#motivos", rotulo: "Motivos de perda" },
];

export default async function PaginaConfiguracoes() {
  const contexto = await obterPapelEOrg();
  if (contexto === null) {
    redirect("/entrar");
  }
  if (contexto.papel !== "gestor" && contexto.papel !== "admin") {
    redirect("/corretor?aviso=area-restrita-gestor");
  }

  const [config, tokens, webhooks, membros, convites, metasTime] = await Promise.all([
    obterOrgConfig(),
    listarTokensCaptacao(),
    listarWebhooksSaida(),
    listarMembrosDaOrg(),
    listarConvites(),
    listarMetasDoTime(),
  ]);
  const meta = statusConexaoMeta();
  const envioRealDisponivel = Boolean(process.env.RESEND_API_KEY);
  const modoTeste = config === null || config.whatsappModo === "teste";
  const emailSimulado = config === null || config.emailModo === "simulado";

  return (
    <div className="flex flex-1 flex-col items-center bg-background px-6 py-16 font-sans">
      <main className="w-full max-w-5xl">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-strong">
            Central de configurações
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
            Configurações
          </h1>
          <p className="mt-1 text-muted">
            Modo de envio, integrações, equipe e metas — tudo que governa a
            operação da imobiliária, num lugar só.
          </p>
        </header>

        {/* Âncoras das seções */}
        <nav aria-label="Seções da página" className="mt-6 flex flex-wrap gap-2">
          {ANCORAS.map((a) => (
            <a
              key={a.href}
              href={a.href}
              className="inline-flex items-center rounded-full border border-border-strong bg-surface-card px-3.5 py-1.5 text-xs font-medium text-muted transition-colors hover:border-brand/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25"
            >
              {a.rotulo}
            </a>
          ))}
        </nav>

        {/* 💬 WhatsApp */}
        <section
          id="whatsapp"
          aria-label="WhatsApp — modo de envio"
          className="mt-8 scroll-mt-24 rounded-2xl border border-border bg-surface-card p-6 shadow-[var(--shadow-soft)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <MessagesSquare className="h-5 w-5 text-brand-strong" aria-hidden />
              WhatsApp — modo de envio
            </h2>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ring-1 ring-inset ${
                modoTeste
                  ? "bg-gold-soft text-gold-strong ring-gold/40"
                  : "bg-brand text-brand-contrast ring-brand/15"
              }`}
            >
              {modoTeste ? "Modo teste" : "Produção"}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">
            Vale para conversas, campanhas e as respostas da IA — toda saída de
            WhatsApp passa por este modo.
          </p>
          <div className="mt-5">
            <SecaoWhatsapp
              modoInicial={config?.whatsappModo ?? "teste"}
              numerosIniciais={config?.whatsappNumerosTeste ?? []}
            />
          </div>
        </section>

        {/* ✉️ E-mail */}
        <section
          id="email"
          aria-label="E-mail — modo de envio"
          className="mt-6 scroll-mt-24 rounded-2xl border border-border bg-surface-card p-6 shadow-[var(--shadow-soft)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <Mail className="h-5 w-5 text-brand-strong" aria-hidden />
              E-mail — newsletter
            </h2>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ring-1 ring-inset ${
                emailSimulado
                  ? "bg-gold-soft text-gold-strong ring-gold/40"
                  : "bg-brand text-brand-contrast ring-brand/15"
              }`}
            >
              {emailSimulado ? "Simulado" : "Envio real"}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">
            Controla o botão de envio das edições da newsletter.
          </p>
          <div className="mt-5">
            <SecaoEmail
              modoInicial={config?.emailModo ?? "simulado"}
              envioRealDisponivel={envioRealDisponivel}
            />
          </div>
        </section>

        {/* 🔌 APIs & Integrações */}
        <section
          id="integracoes"
          aria-label="APIs e integrações"
          className="mt-6 scroll-mt-24 rounded-2xl border border-border bg-surface-card p-6 shadow-[var(--shadow-soft)]"
        >
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Plug className="h-5 w-5 text-brand-strong" aria-hidden />
            APIs &amp; Integrações
          </h2>

          {/* Endpoint de captação */}
          <div className="mt-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <KeyRound className="h-4 w-4 text-brand-strong" aria-hidden />
              Endpoint de captação de leads
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-subtle">
              Formulários externos (site, landing pages) postam leads direto no
              CRM: <strong>POST JSON</strong> autenticado com{" "}
              <code className="rounded bg-surface px-1 py-0.5">
                Authorization: Bearer &lt;token&gt;
              </code>
              . Cada origem tem o próprio token — revogue um sem derrubar os
              outros.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="min-w-0 break-all rounded-lg border border-border bg-surface px-2.5 py-1.5 font-mono text-xs text-foreground">
                {URL_CAPTACAO}
              </code>
              <BotaoCopiar valor={URL_CAPTACAO} rotulo="Copiar URL" />
            </div>
            <div className="mt-4">
              <TokensCaptacao tokens={tokens} />
            </div>
          </div>

          {/* Webhook Meta (informativo) */}
          <div className="mt-6 rounded-xl border border-border bg-surface p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Cable className="h-4 w-4 text-brand-strong" aria-hidden />
              Webhook da Meta (WhatsApp)
              <span
                className={`ml-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ring-1 ring-inset ${
                  meta.conectado && meta.webhookPronto
                    ? "bg-brand-soft text-brand-strong ring-brand/15"
                    : "bg-gold-soft text-gold-strong ring-gold/40"
                }`}
              >
                {meta.conectado && meta.webhookPronto ? (
                  <CheckCircle2 className="h-3 w-3" aria-hidden />
                ) : (
                  <Clock className="h-3 w-3" aria-hidden />
                )}
                {meta.conectado && meta.webhookPronto ? "Conectado" : "Pendente"}
              </span>
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-subtle">
              É por onde as mensagens dos clientes chegam. Configure na Meta com
              a URL abaixo e o verify token do ambiente — passo a passo completo
              na tela de Conexão.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="min-w-0 break-all rounded-lg border border-border bg-surface-card px-2.5 py-1.5 font-mono text-xs text-foreground">
                {URL_WEBHOOK_META}
              </code>
              <BotaoCopiar valor={URL_WEBHOOK_META} rotulo="Copiar URL" />
              <Link
                href="/corretor/crm/conexao"
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-strong underline-offset-2 hover:underline"
              >
                Abrir Conexão
                <ArrowRight className="h-3 w-3" aria-hidden />
              </Link>
            </div>
          </div>
        </section>

        {/* 🔔 Webhooks de saída */}
        <section
          id="webhooks"
          aria-label="Webhooks de saída"
          className="mt-6 scroll-mt-24 rounded-2xl border border-border bg-surface-card p-6 shadow-[var(--shadow-soft)]"
        >
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Webhook className="h-5 w-5 text-brand-strong" aria-hidden />
            Webhooks de saída
          </h2>
          <p className="mt-1 text-sm text-muted">
            Avise Zapier, Make ou RD Station quando um contato entrar, mudar de
            etapa ou um negócio for ganho. Cada entrega é assinada com
            HMAC-SHA256 no header{" "}
            <code className="rounded bg-surface px-1 py-0.5 text-xs">x-imobia-signature</code>;
            5 falhas seguidas desativam o webhook até você reativar.
          </p>
          <div className="mt-5">
            <WebhooksSaida webhooks={webhooks} />
          </div>
        </section>

        {/* 👥 Equipe & acessos */}
        <section
          id="equipe"
          aria-label="Equipe e acessos"
          className="mt-6 scroll-mt-24 rounded-2xl border border-border bg-surface-card p-6 shadow-[var(--shadow-soft)]"
        >
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <UsersRound className="h-5 w-5 text-brand-strong" aria-hidden />
            Equipe &amp; acessos
          </h2>
          <p className="mt-1 text-sm text-muted">
            Quem faz parte da imobiliária e os convites em aberto.
          </p>

          {membros.length > 0 && (
            <ul className="mt-4 flex flex-col gap-2">
              {membros.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-border bg-surface p-3"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                    {m.nome ?? "Sem nome"}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ring-1 ring-inset ${
                      m.papel === "gestor" || m.papel === "admin"
                        ? "bg-gold-soft text-gold-strong ring-gold/40"
                        : "bg-brand-soft text-brand-strong ring-brand/15"
                    }`}
                  >
                    {ROTULO_PAPEL[m.papel]}
                  </span>
                  <span className="text-xs text-subtle">
                    desde{" "}
                    {new Date(m.desde).toLocaleDateString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <h3 className="mt-6 text-sm font-semibold text-foreground">Convites</h3>
          <p className="mt-1 text-xs text-subtle">
            O convidado se cadastra com o e-mail do convite pelo link gerado e
            já entra com o papel certo — sem promoção manual.
          </p>
          <div className="mt-3">
            <Convites convites={convites} />
          </div>
        </section>

        {/* 🎯 Metas */}
        <section
          id="metas"
          aria-label="Metas"
          className="mt-6 scroll-mt-24 rounded-2xl border border-border bg-surface-card p-6 shadow-[var(--shadow-soft)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <Target className="h-5 w-5 text-brand-strong" aria-hidden />
              Metas
            </h2>
            <Link
              href="/corretor/equipe"
              className="inline-flex items-center gap-1.5 rounded-xl border border-brand/30 bg-brand-soft px-3 py-2 text-xs font-semibold text-brand-strong transition-colors hover:bg-brand-soft/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25"
            >
              Metas da empresa (editor da Equipe)
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
          <p className="mt-1 text-sm text-muted">
            As metas da EMPRESA são definidas no dashboard da equipe; aqui você
            distribui o alvo individual de cada pessoa do time.
          </p>
          <div className="mt-5">
            <MetasTime linhas={metasTime} />
          </div>
        </section>

        {/* 📉 Motivos de perda */}
        <section
          id="motivos"
          aria-label="Motivos de perda"
          className="mt-6 scroll-mt-24 rounded-2xl border border-border bg-surface-card p-6 shadow-[var(--shadow-soft)]"
        >
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <TrendingDown className="h-5 w-5 text-brand-strong" aria-hidden />
            Motivos de perda
          </h2>
          <p className="mt-1 text-sm text-muted">
            O vocabulário do seu funil quando um negócio não fecha.
          </p>
          <div className="mt-5">
            <SecaoMotivos motivosIniciais={config?.motivosPerda ?? []} />
          </div>
        </section>

        {/* Atalhos */}
        <section aria-label="Atalhos" className="mt-8">
          <h2 className="text-lg font-semibold text-foreground">Atalhos</h2>
          <nav className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <AtalhoConfig
              href="/corretor/crm/treinar-ia"
              icone={<Bot className="h-5 w-5" aria-hidden />}
              titulo="Treinar IA"
              descricao="Persona, FAQ e escalonamento da assistente"
            />
            <AtalhoConfig
              href="/corretor/crm/templates"
              icone={<LayoutTemplate className="h-5 w-5" aria-hidden />}
              titulo="Templates"
              descricao="Modelos aprovados de WhatsApp"
            />
            <AtalhoConfig
              href="/corretor/crm/conexao"
              icone={<Cable className="h-5 w-5" aria-hidden />}
              titulo="Conexão"
              descricao="Status da integração com a Meta"
            />
          </nav>
        </section>
      </main>
    </div>
  );
}

// —— Card de atalho pequeno ————————————————————————————————————————————————
function AtalhoConfig({
  href,
  icone,
  titulo,
  descricao,
}: {
  href: string;
  icone: React.ReactNode;
  titulo: string;
  descricao: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-2xl border border-border bg-surface-card p-5 shadow-[var(--shadow-soft)] transition-colors hover:border-brand/40 hover:bg-surface"
    >
      <span className="text-brand">{icone}</span>
      <span className="flex flex-col gap-0.5">
        <span className="flex items-center gap-1.5 font-semibold text-foreground">
          {titulo}
          <ArrowRight
            className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
            aria-hidden
          />
        </span>
        <span className="text-xs text-subtle">{descricao}</span>
      </span>
    </Link>
  );
}
