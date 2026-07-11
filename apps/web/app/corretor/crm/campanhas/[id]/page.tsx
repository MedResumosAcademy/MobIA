// PÁGINA DA CAMPANHA (CRM 2.0): status, mensagem, segmento e o RESUMO honesto
// dos envios (motor puro resumoCampanha) com o detalhe das exclusões
// LGPD/telefone. Gestor/admin com campanha disparável ganham o bloco de
// disparo em dois passos (DispararCampanha). Corretor vê tudo read-only.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Megaphone } from "lucide-react";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Badge } from "@/components/ui/Badge";
import { obterPerfil, obterSessao } from "@/lib/auth/sessao";
import { obterCampanha } from "@/lib/dados/campanhas";
import { statusConexaoMeta } from "@/lib/dados/meta-config";
import { tempoRelativo } from "../../../leads/tempo";
import { ROTULO_ETAPA } from "../../../negocios/rotulos";
import {
  BADGE_STATUS_CAMPANHA,
  ROTULO_STATUS_CAMPANHA,
  ROTULO_TEMPERATURA,
} from "../../rotulos";
import { DispararCampanha } from "./DispararCampanha";

export const metadata: Metadata = { title: "Campanha" };
export const dynamic = "force-dynamic";
// O disparo (server action desta página) envia 1 a 1 com pausa — precisa de
// mais que o timeout padrão da Vercel para não morrer no meio da campanha.
export const maxDuration = 300;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaCampanha({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    notFound();
  }
  const sessao = await obterSessao();
  if (!sessao) {
    redirect("/entrar");
  }
  const [perfil, campanha] = await Promise.all([
    obterPerfil(sessao.usuarioId),
    obterCampanha(id),
  ]);
  if (!campanha) {
    notFound();
  }
  const papel = perfil?.papel ?? "cliente";
  const ehGestor = papel === "gestor" || papel === "admin";
  const meta = statusConexaoMeta();

  const disparavel =
    campanha.status === "rascunho" ||
    campanha.status === "pronta" ||
    campanha.status === "falhou" ||
    // Envio interrompido no meio (processo morto): 'enviando' parado além do
    // limite ganha o caminho de retomada (a action re-reivindica com o mesmo
    // corte — quem já recebeu nunca recebe de novo).
    campanha.envioTravado;

  // Progresso do envio: processados (enviado+falha+excluídos) sobre o alvo.
  const processados =
    campanha.resumo.enviados + campanha.resumo.falhas + campanha.resumo.excluidos;
  const pctProgresso =
    campanha.totalAlvo > 0
      ? Math.min(100, Math.round((processados / campanha.totalAlvo) * 100))
      : 0;

  const chipsSegmento = [
    ...(campanha.segmento.etapas ?? []).map((e) => ROTULO_ETAPA[e]),
    ...(campanha.segmento.temperaturas ?? []).map((t) => ROTULO_TEMPERATURA[t]),
    ...(campanha.segmento.tags ?? []),
  ];

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link
        href="/corretor/crm/campanhas"
        className="text-sm text-muted transition-colors hover:text-brand-strong"
      >
        ← Voltar às campanhas
      </Link>

      <header className="mt-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {campanha.nome}
          </h1>
          <Badge variante={BADGE_STATUS_CAMPANHA[campanha.status]}>
            {ROTULO_STATUS_CAMPANHA[campanha.status]}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted">
          {campanha.templateNome
            ? `Template "${campanha.templateNome}"`
            : "Sem template definido"}{" "}
          · criada {tempoRelativo(campanha.criadoEm)}
        </p>
      </header>

      {/* Mensagem (preview em bolha) */}
      <section className="mt-6 rounded-2xl border border-border bg-surface-card p-6 shadow-[var(--shadow-soft)]">
        <h2 className="text-lg font-semibold text-foreground">Mensagem</h2>
        <div className="mt-3 flex items-start rounded-xl border border-border bg-surface p-4">
          <div className="max-w-full rounded-2xl rounded-tl-sm bg-brand-soft px-4 py-3 shadow-[var(--shadow-soft)]">
            <p className="whitespace-pre-wrap break-words text-sm text-foreground">
              {campanha.mensagem}
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm font-medium text-foreground">Segmento</p>
        {chipsSegmento.length === 0 ? (
          <p className="mt-1 text-sm text-subtle">
            Todos os contatos com consentimento de marketing.
          </p>
        ) : (
          <p className="mt-2 flex flex-wrap gap-1.5">
            {chipsSegmento.map((chip) => (
              <span
                key={chip}
                className="inline-flex items-center rounded-full bg-badge-neutro-bg px-2.5 py-1 text-xs font-medium text-badge-neutro-fg ring-1 ring-inset ring-border-strong/60"
              >
                {chip}
              </span>
            ))}
          </p>
        )}
      </section>

      {/* Resumo dos envios */}
      <section className="mt-6 rounded-2xl border border-border bg-surface-card p-6 shadow-[var(--shadow-soft)]">
        <h2 className="text-lg font-semibold text-foreground">Resultado</h2>
        {campanha.resumo.alvo === 0 && disparavel ? (
          <EstadoVazio
            className="mt-4"
            icone={<Megaphone className="h-6 w-6" aria-hidden />}
            titulo="Ainda não disparada"
            descricao="Os números do envio aparecem aqui em tempo real depois do disparo — enviadas, falhas e exclusões LGPD, sem maquiagem."
          />
        ) : (
          <>
            {campanha.status === "enviando" && (
              <div className="mt-4" role="status" aria-label="Progresso do envio">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium text-foreground">Enviando…</span>
                  <span className="tabular-nums text-subtle">
                    {processados} de {campanha.totalAlvo} processados
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-surface">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${pctProgresso}%` }}
                  />
                </div>
              </div>
            )}
            <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <NumeroResumo rotulo="Alvo" valor={campanha.resumo.alvo} />
              <NumeroResumo rotulo="Enviadas" valor={campanha.resumo.enviados} destaque />
              <NumeroResumo rotulo="Falhas" valor={campanha.resumo.falhas} />
              <NumeroResumo rotulo="Excluídos" valor={campanha.resumo.excluidos} />
            </dl>
            <p className="mt-3 text-xs text-subtle">
              Exclusões: {campanha.exclusoes.semConsentimento} sem consentimento de
              marketing (LGPD) · {campanha.exclusoes.semTelefone} sem telefone
              {campanha.exclusoes.bloqueadosModoTeste > 0 &&
                ` · ${campanha.exclusoes.bloqueadosModoTeste} bloqueado(s) pelo modo teste`}{" "}
              — a Meta nunca é chamada para eles.
            </p>
          </>
        )}
      </section>

      {ehGestor && disparavel && (
        <div className="mt-6">
          {campanha.envioTravado && (
            <p className="mb-3 text-sm font-medium text-gold-strong" role="status">
              O envio parou no meio (sem progresso há mais de 10 minutos). Dispare
              de novo para retomar — quem já recebeu não recebe outra vez.
            </p>
          )}
          <DispararCampanha
            campanhaId={campanha.id}
            segmento={campanha.segmento}
            metaConectada={meta.conectado}
            temTemplate={Boolean(campanha.templateNome?.trim())}
          />
        </div>
      )}
    </div>
  );
}

function NumeroResumo({
  rotulo,
  valor,
  destaque = false,
}: {
  rotulo: string;
  valor: number;
  destaque?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        destaque ? "border-brand/30 bg-brand-soft" : "border-border bg-surface"
      }`}
    >
      <dt className="text-xs font-medium uppercase tracking-[0.08em] text-subtle">
        {rotulo}
      </dt>
      <dd
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          destaque ? "text-brand-strong" : "text-foreground"
        }`}
      >
        {valor}
      </dd>
    </div>
  );
}
