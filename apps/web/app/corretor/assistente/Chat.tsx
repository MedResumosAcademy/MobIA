"use client";

// CHAT do assistente ImobIA — client component. Envia comandos (texto ou VOZ)
// para executarComando (Server Action) e renderiza as respostas: balões,
// cards de eventos, avisos com nível e link de continuação.
//
// VOZ: Web Speech API nativa (SEM lib) — (window.SpeechRecognition ||
// window.webkitSpeechRecognition), lang pt-BR, interimResults: a transcrição
// parcial aparece no input em tempo real e, ao final do reconhecimento, o
// comando é ENVIADO automaticamente. Sem suporte (Firefox/Safari antigos) o
// mic some e um aviso gentil aparece — o chat segue 100% funcional por texto.
// Erros de permissão do microfone viram mensagem no próprio chat. pt-BR.

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarClock,
  Info,
  MapPin,
  Mic,
  Send,
  Sparkles,
  Users,
} from "lucide-react";
import type { TipoEventoAgenda } from "@imobia/domain";
import { Badge, type VarianteBadge } from "@/components/ui/Badge";
import type {
  AvisoAssistente,
  NivelAviso,
  RespostaAssistente,
} from "@/lib/dados/assistente";
import type { EventoAgenda } from "@/lib/dados/agenda";
import { formatarHora, ROTULOS_TIPO_EVENTO } from "../agenda/formato";
import { executarComando } from "./acoes";

// —— Tipos locais ————————————————————————————————————————————————————————————

type Mensagem =
  | { id: number; autor: "usuario"; texto: string }
  | { id: number; autor: "assistente"; resposta: RespostaAssistente };

// Tipagem mínima da Web Speech API (não faz parte do lib.dom padrão).
interface AlternativaVoz {
  transcript: string;
}
interface ResultadoVoz {
  isFinal: boolean;
  0: AlternativaVoz;
}
interface EventoResultadoVoz {
  results: ArrayLike<ResultadoVoz>;
}
interface EventoErroVoz {
  error: string;
}
interface ReconhecimentoVoz {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((evento: EventoResultadoVoz) => void) | null;
  onerror: ((evento: EventoErroVoz) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type ConstrutorVoz = new () => ReconhecimentoVoz;

function obterConstrutorVoz(): ConstrutorVoz | null {
  if (typeof window === "undefined") {
    return null;
  }
  const w = window as unknown as {
    SpeechRecognition?: ConstrutorVoz;
    webkitSpeechRecognition?: ConstrutorVoz;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// —— Constantes de apresentação ———————————————————————————————————————————————

const SUGESTOES = [
  "Minha agenda de hoje",
  "Agendar visita com Sofia amanha as 15h",
  "Avisos importantes",
  "Novo negocio com Carlos de 450 mil",
  "Me lembra de ligar para a Patricia amanha as 9h",
] as const;

const BOAS_VINDAS: RespostaAssistente = {
  texto: [
    "Oi! Eu sou a assistente da ImobIA 👋",
    "Fale ou digite e eu resolvo: agendo visitas e lembretes, crio negócios e tarefas, anoto recados na ficha do cliente, mostro sua agenda e te aviso do que pede atenção.",
    'Experimente um dos atalhos abaixo ou diga algo como "agendar visita com Sofia amanhã às 15h".',
  ].join("\n\n"),
  tipo: "ajuda",
};

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

const ESTILO_AVISO: Record<NivelAviso, { Icone: typeof Info; cor: string; rotulo: string }> = {
  critico: { Icone: AlertTriangle, cor: "text-brand-strong", rotulo: "Urgente" },
  alto: { Icone: AlertCircle, cor: "text-gold-strong", rotulo: "Atenção" },
  medio: { Icone: Info, cor: "text-brand-strong", rotulo: "Oportunidade" },
};

// —— Componente ———————————————————————————————————————————————————————————————

export function Chat() {
  const [mensagens, setMensagens] = useState<Mensagem[]>([
    { id: 0, autor: "assistente", resposta: BOAS_VINDAS },
  ]);
  const [texto, setTexto] = useState("");
  const [gravando, setGravando] = useState(false);
  const [suportaVoz, setSuportaVoz] = useState(true);
  const [pendente, iniciar] = useTransition();

  const proximoId = useRef(1);
  const reconhecimento = useRef<ReconhecimentoVoz | null>(null);
  const transcricaoFinal = useRef("");
  const fimDaLista = useRef<HTMLDivElement | null>(null);

  // Detecta o suporte a voz só no client (evita divergência de hidratação).
  useEffect(() => {
    setSuportaVoz(obterConstrutorVoz() !== null);
    return () => reconhecimento.current?.stop();
  }, []);

  // Rola para a última mensagem a cada novidade.
  useEffect(() => {
    fimDaLista.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensagens, pendente]);

  type NovaMensagem =
    | { autor: "usuario"; texto: string }
    | { autor: "assistente"; resposta: RespostaAssistente };

  function adicionar(mensagem: NovaMensagem) {
    setMensagens((atual) => [...atual, { ...mensagem, id: proximoId.current++ }]);
  }

  function avisarNoChat(textoAviso: string) {
    adicionar({ autor: "assistente", resposta: { texto: textoAviso, tipo: "erro" } });
  }

  function enviar(bruto: string) {
    const comando = bruto.trim();
    if (comando === "" || pendente) {
      return;
    }
    setTexto("");
    adicionar({ autor: "usuario", texto: comando });
    iniciar(async () => {
      try {
        const resposta = await executarComando(comando);
        adicionar({ autor: "assistente", resposta });
      } catch {
        avisarNoChat("Não consegui falar com o servidor agora — tente de novo em instantes.");
      }
    });
  }

  // —— Voz ——
  function alternarVoz() {
    if (gravando) {
      reconhecimento.current?.stop();
      return;
    }
    const Construtor = obterConstrutorVoz();
    if (!Construtor) {
      setSuportaVoz(false);
      avisarNoChat("Seu navegador não suporta voz — digite o comando que eu resolvo igual.");
      return;
    }
    const rec = new Construtor();
    rec.lang = "pt-BR";
    rec.interimResults = true;
    rec.continuous = false;
    transcricaoFinal.current = "";

    rec.onresult = (evento) => {
      let final = "";
      let parcial = "";
      for (let i = 0; i < evento.results.length; i += 1) {
        const resultado = evento.results[i];
        if (resultado.isFinal) {
          final += resultado[0].transcript;
        } else {
          parcial += resultado[0].transcript;
        }
      }
      transcricaoFinal.current = final;
      // Transcrição (parcial + final) aparece no input em tempo real.
      setTexto((final + parcial).trim());
    };

    rec.onerror = (evento) => {
      transcricaoFinal.current = "";
      setGravando(false);
      if (evento.error === "not-allowed" || evento.error === "service-not-allowed") {
        avisarNoChat(
          "Preciso da permissão do microfone para te ouvir — libere nas configurações do navegador ou digite o comando.",
        );
      } else if (evento.error !== "aborted" && evento.error !== "no-speech") {
        avisarNoChat("Não consegui te ouvir direito — tente de novo ou digite o comando.");
      }
    };

    rec.onend = () => {
      setGravando(false);
      reconhecimento.current = null;
      const dito = transcricaoFinal.current.trim();
      if (dito !== "") {
        enviar(dito); // envia automaticamente o que foi falado
      }
    };

    reconhecimento.current = rec;
    setGravando(true);
    setTexto("");
    rec.start();
  }

  return (
    <section
      className="mt-8 flex flex-col overflow-hidden rounded-2xl border border-border bg-surface-card shadow-[var(--shadow-soft)]"
      aria-label="Conversa com a assistente ImobIA"
    >
      {/* Mensagens */}
      <div
        role="log"
        aria-live="polite"
        className="flex h-[55vh] min-h-80 flex-col gap-4 overflow-y-auto bg-surface p-5"
      >
        {mensagens.map((m) =>
          m.autor === "usuario" ? (
            <div key={m.id} className="flex justify-end">
              <p className="max-w-[85%] whitespace-pre-line rounded-2xl rounded-br-md bg-brand-soft px-4 py-2.5 text-sm text-foreground">
                {m.texto}
              </p>
            </div>
          ) : (
            <BalaoAssistente key={m.id} resposta={m.resposta} />
          ),
        )}
        {pendente && (
          <div className="flex justify-start">
            <p
              className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-border bg-surface-card px-4 py-3"
              aria-label="A assistente está pensando"
            >
              <Pontinho atraso="0ms" />
              <Pontinho atraso="150ms" />
              <Pontinho atraso="300ms" />
            </p>
          </div>
        )}
        <div ref={fimDaLista} />
      </div>

      {/* Sugestões */}
      <div className="flex flex-wrap gap-2 border-t border-border bg-surface-card px-5 pt-4">
        {SUGESTOES.map((s) => (
          <button
            key={s}
            type="button"
            disabled={pendente}
            onClick={() => enviar(s)}
            className="rounded-full border border-brand/30 bg-brand-soft px-3 py-1.5 text-xs font-medium text-brand-strong transition-colors hover:bg-brand-soft/70 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Entrada */}
      <form
        className="flex items-center gap-3 bg-surface-card p-5"
        onSubmit={(e) => {
          e.preventDefault();
          enviar(texto);
        }}
      >
        <button
          type="button"
          onClick={alternarVoz}
          disabled={!suportaVoz}
          aria-pressed={gravando}
          aria-label={
            !suportaVoz
              ? "Voz indisponível neste navegador"
              : gravando
                ? "Parar de ouvir"
                : "Falar com a assistente"
          }
          title={
            !suportaVoz
              ? "Seu navegador não suporta voz — digite o comando"
              : gravando
                ? "Parar de ouvir"
                : "Falar com a assistente"
          }
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors ${
            gravando
              ? "animate-pulse bg-brand text-brand-contrast shadow-[var(--shadow-soft)]"
              : "bg-brand-soft text-brand-strong hover:bg-brand-soft/70"
          } disabled:cursor-not-allowed disabled:opacity-40`}
        >
          <Mic className="h-5 w-5" aria-hidden />
        </button>

        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={gravando ? "Ouvindo…" : "Digite ou fale seu comando…"}
          aria-label="Mensagem para a assistente"
          disabled={pendente}
          className="w-full rounded-xl border border-border-strong bg-surface-card px-3.5 py-2.5 text-sm text-foreground shadow-[var(--shadow-soft)] transition-[border-color,box-shadow] duration-200 placeholder:text-subtle hover:border-brand/40 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 disabled:opacity-60"
        />

        <button
          type="submit"
          disabled={pendente || texto.trim() === ""}
          aria-label="Enviar comando"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-brand-contrast shadow-[var(--shadow-soft)] transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send className="h-5 w-5" aria-hidden />
        </button>
      </form>

      {/* Estados de voz abaixo do input */}
      {gravando && (
        <p className="px-5 pb-4 text-xs font-medium text-brand-strong" aria-live="polite">
          Ouvindo… fale seu comando — envio sozinha quando você terminar.
        </p>
      )}
      {!suportaVoz && (
        <p className="px-5 pb-4 text-xs text-subtle">
          Seu navegador não suporta voz — digite o comando que funciona do mesmo jeito.
        </p>
      )}
    </section>
  );
}

// —— Balão da assistente (texto + payloads) ——————————————————————————————————

function BalaoAssistente({ resposta }: { resposta: RespostaAssistente }) {
  return (
    <div className="flex justify-start">
      <div className="flex max-w-[90%] items-start gap-2.5">
        <span
          className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-brand-contrast"
          aria-hidden
        >
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 rounded-2xl rounded-bl-md border border-border bg-surface-card px-4 py-2.5 shadow-[var(--shadow-soft)]">
          <p className="whitespace-pre-line text-sm text-foreground">{resposta.texto}</p>

          {resposta.eventos && resposta.eventos.length > 0 && (
            <ul className="mt-3 flex flex-col gap-2">
              {resposta.eventos.map((evento) => (
                <CardEvento key={evento.id} evento={evento} />
              ))}
            </ul>
          )}

          {resposta.avisos && resposta.avisos.length > 0 && (
            <ul className="mt-3 flex flex-col gap-2">
              {resposta.avisos.map((aviso, i) => (
                <CardAviso key={`${aviso.href}-${i}`} aviso={aviso} />
              ))}
            </ul>
          )}

          {resposta.acaoRealizada &&
            (resposta.acaoRealizada.href ? (
              <Link
                href={resposta.acaoRealizada.href}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand-soft px-3.5 py-1.5 text-xs font-semibold text-brand-strong transition-colors hover:bg-brand-soft/70"
              >
                {resposta.acaoRealizada.rotulo}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            ) : (
              <p className="mt-3 text-xs font-semibold text-brand-strong">
                {resposta.acaoRealizada.rotulo}
              </p>
            ))}
        </div>
      </div>
    </div>
  );
}

function CardEvento({ evento }: { evento: EventoAgenda }) {
  const Icone = ICONE_TIPO[evento.tipo];
  return (
    <li className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
      <span className="text-sm font-semibold tabular-nums text-brand-strong">
        {formatarHora(evento.inicioISO)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">
          {evento.titulo}
        </span>
        {evento.local && (
          <span className="mt-0.5 flex items-center gap-1 text-xs text-subtle">
            <MapPin className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate">{evento.local}</span>
          </span>
        )}
      </span>
      <Badge variante={VARIANTE_TIPO[evento.tipo]}>
        <Icone className="h-3 w-3" aria-hidden />
        {ROTULOS_TIPO_EVENTO[evento.tipo]}
      </Badge>
    </li>
  );
}

function CardAviso({ aviso }: { aviso: AvisoAssistente }) {
  const { Icone, cor, rotulo } = ESTILO_AVISO[aviso.nivel];
  return (
    <li>
      <Link
        href={aviso.href}
        className="group flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 transition-colors hover:border-brand/40 hover:bg-surface-card"
      >
        <Icone className={`h-4 w-4 shrink-0 ${cor}`} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">
            {aviso.titulo}
          </span>
          <span className="block truncate text-xs text-subtle">{aviso.subtitulo}</span>
        </span>
        <span className={`shrink-0 text-[0.65rem] font-semibold uppercase tracking-[0.06em] ${cor}`}>
          {rotulo}
        </span>
        <ArrowRight
          className="h-3.5 w-3.5 shrink-0 -translate-x-1 text-subtle opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
          aria-hidden
        />
      </Link>
    </li>
  );
}

function Pontinho({ atraso }: { atraso: string }) {
  return (
    <span
      className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand"
      style={{ animationDelay: atraso }}
    />
  );
}
