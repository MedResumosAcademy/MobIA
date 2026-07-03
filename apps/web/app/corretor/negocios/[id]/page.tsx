// Detalhe de um NEGÓCIO (CRM): dados do contato/imóvel, controle de etapa e de
// resultado (ganho/perdido), e a TIMELINE cronológica de atividades com campo
// para registrar nova nota. A visibilidade é da RLS (0011): fora do acesso →
// notFound. Controles interativos vivem no client (Controles.tsx). pt-BR.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { formatarReais } from "@imobia/core";
import { obterNegocio } from "@/lib/dados/negocios";
import { listarTarefasDoNegocio } from "@/lib/dados/tarefas";
import { classesBotao } from "@/components/ui/Botao";
import { ChipTermometro } from "../../leads/termometro";
import { tempoRelativo } from "../../leads/tempo";
import { BotaoConcluir } from "../../tarefas/BotaoConcluir";
import { formatarVencimento } from "../../tarefas/data";
import { AdicionarTarefa } from "./AdicionarTarefa";
import { ControlesNegocio } from "./Controles";
import { EditarNegocio } from "./EditarNegocio";
import { ROTULO_ATIVIDADE, ROTULO_ETAPA, ROTULO_RESULTADO } from "../rotulos";

/** Só dígitos, para montar links tel:/wa.me. Vazio → null. */
function apenasDigitos(valor: string | null): string | null {
  if (!valor) {
    return null;
  }
  const digitos = valor.replace(/\D/g, "");
  return digitos === "" ? null : digitos;
}

export const metadata: Metadata = { title: "Negócio — ImobIA" };
export const dynamic = "force-dynamic";

export default async function PaginaNegocio({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detalhe = await obterNegocio(id);
  if (!detalhe) {
    notFound();
  }
  const { negocio, timeline, clienteNome } = detalhe;
  const fechado = negocio.resultado !== null;
  const tarefas = await listarTarefasDoNegocio(id);

  const telDigitos = apenasDigitos(negocio.telefoneContato);

  return (
    <div className="flex flex-1 flex-col items-center bg-background px-6 py-16 font-sans">
      <main className="w-full max-w-2xl">
        <Link
          href="/corretor/negocios"
          className="text-sm text-muted transition-colors hover:text-brand-strong"
        >
          ← Voltar ao funil
        </Link>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {negocio.nomeContato}
          </h1>
          {negocio.temperatura && <ChipTermometro temperatura={negocio.temperatura} />}
          {fechado && negocio.resultado && (
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${
                negocio.resultado === "ganho"
                  ? "border-transparent bg-brand text-brand-contrast"
                  : "border-border-strong bg-surface text-subtle"
              }`}
            >
              {ROTULO_RESULTADO[negocio.resultado]}
            </span>
          )}
        </div>

        {!fechado && negocio.atencao !== "ok" && (
          <p
            className={`mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
              negocio.atencao === "parado"
                ? "border-brand/40 bg-brand-soft text-brand-strong"
                : "border-gold/40 bg-gold-soft text-gold-strong"
            }`}
          >
            {negocio.atencao === "parado" ? "Parado" : "Atenção"} há{" "}
            {negocio.diasSemMovimento}{" "}
            {negocio.diasSemMovimento === 1 ? "dia" : "dias"} sem movimento
          </p>
        )}

        <section className="mt-6 rounded-2xl border border-border bg-surface-card p-6 shadow-[var(--shadow-soft)]">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Dado rotulo="Etapa" valor={ROTULO_ETAPA[negocio.etapa]} />
            <Dado
              rotulo="Valor"
              valor={negocio.valor !== null ? formatarReais(negocio.valor) : "—"}
            />
            <Dado rotulo="Imóvel" valor={negocio.imovelTitulo ?? "—"} />
            <Dado rotulo="Cliente" valor={clienteNome ?? "—"} />
            <Dado rotulo="Telefone" valor={negocio.telefoneContato ?? "—"} />
            <Dado rotulo="E-mail" valor={negocio.emailContato ?? "—"} />
          </dl>
          {fechado && negocio.resultado === "perdido" && negocio.motivoPerda && (
            <p className="mt-4 border-t border-border pt-4 text-sm text-muted">
              <span className="text-subtle">Motivo da perda:</span> {negocio.motivoPerda}
            </p>
          )}

          {(telDigitos || negocio.emailContato) && (
            <div className="mt-5 flex flex-wrap gap-3 border-t border-border pt-5">
              {telDigitos && (
                <a
                  href={`tel:${telDigitos}`}
                  className={classesBotao("secundario", "sm")}
                >
                  <Phone className="h-4 w-4" aria-hidden />
                  Ligar
                </a>
              )}
              {telDigitos && (
                <a
                  href={`https://wa.me/${telDigitos}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={classesBotao("secundario", "sm")}
                >
                  <MessageCircle className="h-4 w-4" aria-hidden />
                  WhatsApp
                </a>
              )}
              {negocio.emailContato && (
                <a
                  href={`mailto:${negocio.emailContato}`}
                  className={classesBotao("secundario", "sm")}
                >
                  <Mail className="h-4 w-4" aria-hidden />
                  E-mail
                </a>
              )}
            </div>
          )}
        </section>

        {!fechado && (
          <div className="mt-6">
            <EditarNegocio
              id={negocio.id}
              nomeContato={negocio.nomeContato}
              telefoneContato={negocio.telefoneContato}
              emailContato={negocio.emailContato}
              origem={negocio.origem}
              valor={negocio.valor}
            />
          </div>
        )}

        <div className="mt-8">
          <ControlesNegocio id={negocio.id} etapaAtual={negocio.etapa} fechado={fechado} />
        </div>

        <section className="mt-8 rounded-2xl border border-border bg-surface-card p-6 shadow-[var(--shadow-soft)]">
          <h2 className="text-lg font-semibold text-foreground">Tarefas</h2>
          {tarefas.length === 0 ? (
            <p className="mt-3 text-sm text-subtle">
              Nenhuma tarefa para este negócio. Adicione um próximo passo abaixo.
            </p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {tarefas.map((t) => (
                <li
                  key={t.id}
                  className={`flex items-start gap-3 rounded-xl border p-3 ${
                    t.atrasada
                      ? "border-brand/40 bg-brand-soft"
                      : "border-border bg-surface-card"
                  }`}
                >
                  <BotaoConcluir id={t.id} negocioId={t.negocioId} concluida={t.concluida} />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-medium ${
                        t.concluida
                          ? "text-subtle line-through"
                          : "text-foreground"
                      }`}
                    >
                      {t.titulo}
                    </p>
                    <p className="mt-0.5 text-xs text-subtle">
                      {t.atrasada && (
                        <span className="font-semibold text-brand-strong">Atrasada · </span>
                      )}
                      {formatarVencimento(t.venceEm)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <AdicionarTarefa negocioId={negocio.id} />
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-foreground">Histórico</h2>
          {timeline.length === 0 ? (
            <p className="mt-3 text-sm text-subtle">
              Nenhuma atividade registrada ainda.
            </p>
          ) : (
            <ol className="mt-4 flex flex-col gap-4 border-l border-border pl-5">
              {timeline.map((item) => (
                <li key={item.id} className="relative">
                  <span
                    aria-hidden
                    className="absolute -left-[27px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface-card bg-gold"
                  />
                  <p className="text-xs font-medium uppercase tracking-wide text-subtle">
                    {ROTULO_ATIVIDADE[item.tipo]}
                  </p>
                  <p className="mt-0.5 text-sm text-foreground">{item.descricao}</p>
                  <p className="text-xs text-subtle">{tempoRelativo(item.criadoEm)}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </main>
    </div>
  );
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-subtle">{rotulo}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-foreground">{valor}</dd>
    </div>
  );
}
