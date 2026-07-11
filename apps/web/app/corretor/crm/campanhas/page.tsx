// CAMPANHAS DE WHATSAPP (CRM 2.0). Server Component: lista as campanhas da
// org (RLS: corretor lê, gestor gerencia). Gestor/admin ganham o CTA "Nova
// campanha"; corretor vê a lista read-only com aviso honesto. Os contadores
// exibidos são os incrementais do disparo (total_alvo/enviado/falha).

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Megaphone, Plus, ShieldAlert } from "lucide-react";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Badge } from "@/components/ui/Badge";
import { classesBotao } from "@/components/ui/Botao";
import { obterPerfil, obterSessao } from "@/lib/auth/sessao";
import { listarCampanhas } from "@/lib/dados/campanhas";
import { obterOrgConfig } from "@/lib/dados/org-config";
import { tempoRelativo } from "../../leads/tempo";
import { BADGE_STATUS_CAMPANHA, ROTULO_STATUS_CAMPANHA } from "../rotulos";

export const metadata: Metadata = { title: "CRM — Campanhas" };
export const dynamic = "force-dynamic";

export default async function PaginaCampanhas() {
  const sessao = await obterSessao();
  if (!sessao) {
    redirect("/entrar");
  }
  const [perfil, campanhas, orgConfig] = await Promise.all([
    obterPerfil(sessao.usuarioId),
    listarCampanhas(),
    obterOrgConfig(),
  ]);
  const papel = perfil?.papel ?? "cliente";
  const ehGestor = papel === "gestor" || papel === "admin";
  const modoTeste = orgConfig === null || orgConfig.whatsappModo !== "producao";

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Campanhas
          </h1>
          <p className="mt-1 text-muted">
            Disparos em massa por template — só para contatos com consentimento
            de marketing (LGPD).
          </p>
        </div>
        {ehGestor && (
          <Link
            href="/corretor/crm/campanhas/nova"
            className={classesBotao("primario", "md")}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Nova campanha
          </Link>
        )}
      </header>

      {/* Banner discreto do MODO TESTE (central de configuração, 0033) */}
      {modoTeste && (
        <p className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-gold/40 bg-gold-soft px-3 py-2 text-xs font-medium text-gold-strong">
          <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Modo teste ativo: disparos só chegam aos números de teste da
          organização — os demais alvos ficam bloqueados (sem envio).
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

      {!ehGestor && (
        <p className="mt-4 rounded-xl border border-border bg-surface p-3 text-sm text-subtle">
          Campanhas são criadas e disparadas pelo gestor da imobiliária — aqui
          você acompanha os resultados.
        </p>
      )}

      {campanhas.length === 0 ? (
        <div className="mt-8">
          <EstadoVazio
            icone={<Megaphone className="h-6 w-6" aria-hidden />}
            titulo="Nenhuma campanha ainda"
            descricao={
              ehGestor
                ? "Crie a primeira campanha: escolha um template aprovado na Meta, segmente os contatos consentidos e acompanhe o envio em tempo real."
                : "Quando o gestor criar campanhas de WhatsApp, elas aparecem aqui com os resultados."
            }
            cta={
              ehGestor
                ? { href: "/corretor/crm/campanhas/nova", rotulo: "Criar campanha" }
                : undefined
            }
          />
        </div>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {campanhas.map((c) => (
            <li key={c.id}>
              <Link
                href={`/corretor/crm/campanhas/${c.id}`}
                className="flex flex-col gap-2 rounded-2xl border border-border bg-surface-card p-4 shadow-[var(--shadow-soft)] transition-[border-color,box-shadow] hover:border-brand/30 hover:shadow-[var(--shadow-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-semibold text-foreground">
                      {c.nome}
                    </span>
                    <Badge variante={BADGE_STATUS_CAMPANHA[c.status]}>
                      {ROTULO_STATUS_CAMPANHA[c.status]}
                    </Badge>
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-muted">
                    {c.templateNome
                      ? `Template "${c.templateNome}"`
                      : "Sem template definido"}{" "}
                    · criada {tempoRelativo(c.criadoEm)}
                  </span>
                </span>
                <span className="shrink-0 text-sm tabular-nums text-subtle">
                  {c.status === "rascunho" || c.status === "pronta"
                    ? "aguardando disparo"
                    : `${c.totalEnviado} enviadas · ${c.totalFalha} falhas · ${c.totalAlvo} no alvo`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
