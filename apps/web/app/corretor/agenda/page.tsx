// MINHA AGENDA do corretor (área /corretor — o layout já protege). Server
// Component force-dynamic: HOJE em destaque (timeline vertical) + próximos 7
// dias agrupados por dia (pt-BR: "sexta-feira, 4 de julho"). Tarefas com
// vencimento aparecem inline (ícone próprio) via listarAgenda; eventos
// próprios têm excluir (X) e o "Novo compromisso" é um form client fino.
// "Hoje", o intervalo consultado e as horas exibidas seguem o relógio de
// America/Sao_Paulo (lib/fuso.ts + formato.ts). pt-BR.

import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  CalendarClock,
  CalendarDays,
  CheckSquare,
  MapPin,
  Sparkles,
  Users,
} from "lucide-react";
import type { TipoEventoAgenda } from "@imobia/domain";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Badge, type VarianteBadge } from "@/components/ui/Badge";
import {
  listarAgenda,
  type EntradaAgenda,
  type EventoAgenda,
} from "@/lib/dados/agenda";
import type { TarefaResumo } from "@/lib/dados/tarefas";
import { diaSaoPaulo, intervaloDoDiaSaoPaulo } from "@/lib/fuso";
import { ExcluirEvento } from "./ExcluirEvento";
import { NovoEvento } from "./NovoEvento";
import { formatarDiaLongo, formatarHora, ROTULOS_TIPO_EVENTO } from "./formato";

export const metadata: Metadata = { title: "Minha agenda" };
export const dynamic = "force-dynamic";

const VARIANTE_TIPO: Record<TipoEventoAgenda, VarianteBadge> = {
  compromisso: "neutro",
  visita: "lancamento",
  reuniao: "mcmv",
  lembrete: "destaque",
};

const ICONE_TIPO: Record<TipoEventoAgenda, typeof CalendarClock> = {
  compromisso: CalendarClock,
  visita: MapPin,
  reuniao: Users,
  lembrete: Bell,
};

/** dataISO + n dias (aritmética de calendário em UTC). */
function somarDias(dataISO: string, n: number): string {
  const [ano, mes, dia] = dataISO.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia + n)).toISOString().slice(0, 10);
}

export default async function PaginaAgenda() {
  const hoje = diaSaoPaulo(new Date());
  const ate = somarDias(hoje, 7);
  const dias = await listarAgenda(
    intervaloDoDiaSaoPaulo(hoje).deISO,
    intervaloDoDiaSaoPaulo(ate).ateISO,
  );

  const itensDeHoje = dias.find((d) => d.data === hoje)?.itens ?? [];
  const proximosDias = dias.filter((d) => d.data !== hoje);

  return (
    <div className="flex flex-1 flex-col items-center bg-background px-6 py-16 font-sans">
      <main className="w-full max-w-3xl">
        {/* Cabeçalho */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-strong">
              Meu dia a dia
            </p>
            <h1 className="mt-1 flex items-center gap-2.5 text-3xl font-semibold tracking-tight text-foreground">
              <CalendarDays className="h-7 w-7 text-brand" aria-hidden />
              Minha agenda
            </h1>
            <p className="mt-1 text-muted">Compromissos e tarefas dos próximos 7 dias.</p>
          </div>
          <NovoEvento hojeISO={hoje} />
        </header>

        {/* HOJE em destaque */}
        <section className="mt-8 rounded-2xl border border-brand/30 bg-surface-card p-6 shadow-[var(--shadow-soft)]">
          <h2 className="text-lg font-semibold text-foreground">
            Hoje
            <span className="ml-2 text-sm font-normal text-muted">
              {formatarDiaLongo(hoje)}
            </span>
          </h2>
          {itensDeHoje.length === 0 ? (
            <EstadoVazio
              className="mt-5"
              icone={<CalendarClock className="h-6 w-6" aria-hidden />}
              titulo="Dia livre por aqui ✨"
              descricao="Nenhum compromisso ou tarefa para hoje. Que tal aproveitar para avançar um negócio do funil?"
              cta={{ href: "/corretor/negocios", rotulo: "Ver funil de negócios" }}
            />
          ) : (
            <ol className="mt-5">
              {itensDeHoje.map((entrada, i) => (
                <li
                  key={chaveEntrada(entrada)}
                  className={`relative border-l-2 border-brand/20 pl-5 ${
                    i === itensDeHoje.length - 1 ? "" : "pb-5"
                  }`}
                >
                  <span
                    className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full border-2 border-surface-card bg-brand"
                    aria-hidden
                  />
                  <LinhaEntrada entrada={entrada} />
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Próximos 7 dias */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-foreground">Próximos 7 dias</h2>
          {proximosDias.length === 0 ? (
            <EstadoVazio
              className="mt-4"
              icone={<CalendarDays className="h-6 w-6" aria-hidden />}
              titulo="Semana aberta"
              descricao="Nada marcado nos próximos 7 dias — boa hora para agendar novas visitas com seus leads."
              cta={{ href: "/corretor/leads", rotulo: "Ver leads" }}
            />
          ) : (
            <div className="mt-4 flex flex-col gap-4">
              {proximosDias.map((dia) => (
                <div
                  key={dia.data}
                  className="rounded-2xl border border-border bg-surface-card p-5 shadow-[var(--shadow-soft)]"
                >
                  <h3 className="text-sm font-semibold text-brand-strong">
                    {formatarDiaLongo(dia.data)}
                  </h3>
                  <ul className="mt-3 flex flex-col gap-2.5">
                    {dia.itens.map((entrada) => (
                      <li key={chaveEntrada(entrada)}>
                        <LinhaEntrada entrada={entrada} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* CTA — assistente */}
        <Link
          href="/corretor/assistente"
          className="mt-8 flex items-center justify-between gap-4 rounded-2xl border border-brand/30 bg-brand-soft p-6 shadow-[var(--shadow-soft)] transition-colors hover:bg-brand-soft/70"
        >
          <div>
            <p className="flex items-center gap-2 text-base font-semibold text-brand-strong">
              <Sparkles className="h-5 w-5" aria-hidden />
              Prefere falar? Use a assistente
            </p>
            <p className="mt-1 text-sm text-brand-strong/80">
              &ldquo;Agendar visita com Sofia amanhã às 15h&rdquo; — ela marca por você.
            </p>
          </div>
          <ArrowRight className="h-5 w-5 shrink-0 text-brand-strong" aria-hidden />
        </Link>
      </main>
    </div>
  );
}

// —— Apresentação ————————————————————————————————————————————————————————————

function chaveEntrada(entrada: EntradaAgenda): string {
  return entrada.tipo === "evento" ? `e-${entrada.evento.id}` : `t-${entrada.tarefa.id}`;
}

function LinhaEntrada({ entrada }: { entrada: EntradaAgenda }) {
  return entrada.tipo === "evento" ? (
    <LinhaEvento evento={entrada.evento} />
  ) : (
    <LinhaTarefa tarefa={entrada.tarefa} />
  );
}

function LinhaEvento({ evento }: { evento: EventoAgenda }) {
  const Icone = ICONE_TIPO[evento.tipo];
  return (
    <div className="flex items-start gap-3">
      <span className="w-12 shrink-0 pt-0.5 text-sm font-semibold tabular-nums text-brand-strong">
        {formatarHora(evento.inicioISO)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">{evento.titulo}</span>
          <Badge variante={VARIANTE_TIPO[evento.tipo]}>
            <Icone className="h-3 w-3" aria-hidden />
            {ROTULOS_TIPO_EVENTO[evento.tipo]}
          </Badge>
          {evento.criadoVia === "assistente" && (
            <span title="Criado pela assistente">
              <Sparkles className="h-3.5 w-3.5 text-gold-strong" aria-hidden />
            </span>
          )}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-subtle">
          {evento.fimISO && <span>até {formatarHora(evento.fimISO)}</span>}
          {evento.local && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" aria-hidden />
              {evento.local}
            </span>
          )}
          {evento.negocioId && (
            <Link
              href={`/corretor/negocios/${evento.negocioId}`}
              className="font-medium text-brand-strong transition-colors hover:text-brand"
            >
              {evento.negocioContato
                ? `Ver negócio de ${evento.negocioContato} →`
                : "Ver negócio →"}
            </Link>
          )}
        </p>
      </div>
      <ExcluirEvento id={evento.id} titulo={evento.titulo} />
    </div>
  );
}

function LinhaTarefa({ tarefa }: { tarefa: TarefaResumo }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex w-12 shrink-0 justify-start pt-0.5 text-subtle">
        <CheckSquare className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">{tarefa.titulo}</span>
          <Badge variante={tarefa.atrasada ? "marca" : "neutro"}>
            {tarefa.atrasada ? "Tarefa atrasada" : "Tarefa"}
          </Badge>
        </p>
        <p className="mt-0.5 text-xs text-subtle">
          {tarefa.negocioNomeContato && <>{tarefa.negocioNomeContato} · </>}
          <Link
            href={`/corretor/negocios/${tarefa.negocioId}`}
            className="font-medium text-brand-strong transition-colors hover:text-brand"
          >
            Ver negócio →
          </Link>
        </p>
      </div>
    </div>
  );
}
