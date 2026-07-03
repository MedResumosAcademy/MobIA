"use client";

// CHAT do assistente ImobIA — client component. Envia comandos (texto ou VOZ)
// para executarComando (Server Action) e renderiza as respostas: balões,
// cards de eventos, avisos com nível e link de continuação.
//
// VOZ é PUSH-TO-TALK verdadeiro nos 2 modos: gravar começa no clique e SÓ
// termina quando o usuário clica de novo (botão vira quadrado de parar, com
// timer mm:ss), quando bate o limite de 60s (avisa e envia o que tem) ou no
// X (cancela e descarta). NADA para sozinho no primeiro silêncio.
//   1. GRAVADOR — se o servidor transcreve (prop transcricaoDisponivel, i.e.
//      GROQ_API_KEY presente) e o navegador tem MediaRecorder: grava o áudio
//      (webm/opus com fallback de mimeType, SEM timeslice) e, ao parar, POSTa
//      em /api/transcrever (Groq Whisper) — o texto entra no input e é enviado.
//   2. WEB SPEECH — senão, a Web Speech API com continuous + interimResults;
//      os resultados FINAIS acumulam num buffer (refs) e o interim aparece no
//      input. O Chrome dispara onend sozinho após silêncio — enquanto o
//      usuário não clicou parar, o onend RELIGA o reconhecimento (keep-alive)
//      preservando o buffer. Só envia no clique de parar (ou aos 60s).
//   3. SÓ TEXTO — senão, o mic é desabilitado com um aviso gentil; o chat
//      segue 100% funcional por texto.
// Erros de permissão/transcrição viram mensagem da assistente no chat. pt-BR.

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
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
  Square,
  Users,
  X,
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

// —— Gravação de áudio (nível 1: transcrição no servidor) —————————————————————

/** Como o mic funciona neste navegador/servidor (decidido só no client). */
type ModoVoz = "gravador" | "web-speech" | "nenhum";

function suportaGravacao(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.MediaRecorder !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

// Preferência de formato: webm/opus (Chrome/Edge/Firefox) com fallbacks
// (Safari grava audio/mp4). Sem match, o MediaRecorder decide sozinho.
const TIPOS_GRAVACAO = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
] as const;

function melhorTipoGravacao(): string | undefined {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) {
    return undefined;
  }
  return TIPOS_GRAVACAO.find((tipo) => MediaRecorder.isTypeSupported(tipo));
}

/** Extensão coerente com o mimeType gravado (o servidor usa para nomear). */
function extensaoDoTipo(mime: string): string {
  const base = mime.split(";")[0]?.trim().toLowerCase() ?? "";
  if (base.includes("mp4")) return "m4a";
  if (base.includes("ogg")) return "ogg";
  if (base.includes("wav")) return "wav";
  return "webm";
}

function formatarTempo(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = String(segundos % 60).padStart(2, "0");
  return `${m}:${s}`;
}

/** Teto de uma captura de voz: aos 60s avisamos e enviamos o que já foi dito. */
const LIMITE_VOZ_MS = 60_000;

/** Junta pedaços de fala com espaço único (transcripts variam no espaçamento). */
function montarFala(...pedacos: string[]): string {
  return pedacos.join(" ").replace(/\s+/g, " ").trim();
}

/** Chave do localStorage da dica de primeira vez do mic. */
const CHAVE_DICA_MIC = "imobia:dica-mic-vista";

// O suporte do navegador não muda durante a sessão — useSyncExternalStore com
// assinatura vazia lê o valor real no client e um chute otimista no servidor
// (mesmo markup da hidratação), sem setState em efeito.
const assinaturaImutavel = () => () => {};

function lerModoVoz(transcricaoDisponivel: boolean): ModoVoz {
  if (transcricaoDisponivel && suportaGravacao()) {
    return "gravador";
  }
  return obterConstrutorVoz() !== null ? "web-speech" : "nenhum";
}

// —— Constantes de apresentação ———————————————————————————————————————————————

/** Aviso ÚNICO do teto de gravação por voz (usado pelos dois modos: gravador e web-speech). */
const AVISO_LIMITE_60S =
  "Chegamos ao limite de 60s de gravação — vou enviar o que você falou até aqui.";

const SUGESTOES = [
  "Minha agenda de hoje",
  "Passa a Sofia para proposta",
  "Mensagem de follow-up para a Sofia",
  "Fechei com a Camila por 780 mil",
  "Avisos importantes",
  "Me lembra de ligar para a Patrícia amanhã às 9h",
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

export function Chat({ transcricaoDisponivel = false }: { transcricaoDisponivel?: boolean }) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([
    { id: 0, autor: "assistente", resposta: BOAS_VINDAS },
  ]);
  const [texto, setTexto] = useState("");
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [transcrevendo, setTranscrevendo] = useState(false);
  // No servidor assume o melhor caso (mesmo HTML da hidratação); no client lê
  // o suporte real do navegador — sem setState em efeito.
  const modoVoz = useSyncExternalStore(
    assinaturaImutavel,
    () => lerModoVoz(transcricaoDisponivel),
    () => (transcricaoDisponivel ? "gravador" : "web-speech"),
  );
  const [pendente, iniciar] = useTransition();

  // Dica de primeira vez do mic — lida do localStorage só no client (efeito).
  const [mostrarDica, setMostrarDica] = useState(false);

  const proximoId = useRef(1);
  const reconhecimento = useRef<ReconhecimentoVoz | null>(null);
  // Web Speech (push-to-talk com keep-alive): o buffer NUNCA se perde entre
  // re-inícios — finais de sessões anteriores + finais da sessão atual + interim.
  const finaisAnteriores = useRef("");
  const finaisDaSessao = useRef("");
  const parcialVoz = useRef("");
  /** true = o usuário (ou o limite de 60s / cancelar) mandou parar: NÃO religar. */
  const paradaSolicitada = useRef(false);
  /** O que fazer quando o reconhecimento terminar de vez. */
  const encerramentoVoz = useRef<"enviar" | "descartar" | "manter">("enviar");
  const gravador = useRef<MediaRecorder | null>(null);
  const trilhaAudio = useRef<MediaStream | null>(null);
  const pedacos = useRef<Blob[]>([]);
  const cancelado = useRef(false);
  const cronometro = useRef<ReturnType<typeof setInterval> | null>(null);
  const limite = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fimDaLista = useRef<HTMLDivElement | null>(null);

  // Limpa gravação/reconhecimento/timers ao desmontar.
  useEffect(() => {
    return () => {
      paradaSolicitada.current = true;
      encerramentoVoz.current = "descartar";
      reconhecimento.current?.stop();
      cancelado.current = true;
      if (gravador.current && gravador.current.state !== "inactive") {
        gravador.current.stop();
      }
      trilhaAudio.current?.getTracks().forEach((t) => t.stop());
      if (cronometro.current !== null) {
        clearInterval(cronometro.current);
      }
      if (limite.current !== null) {
        clearTimeout(limite.current);
      }
    };
  }, []);

  // Mostra a dica do mic só na primeira vez (persistida no localStorage).
  useEffect(() => {
    if (modoVoz === "nenhum") {
      return;
    }
    try {
      if (window.localStorage.getItem(CHAVE_DICA_MIC) === null) {
        setMostrarDica(true);
      }
    } catch {
      // localStorage indisponível (modo privado etc.) — segue sem dica.
    }
  }, [modoVoz]);

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

  // —— Timers compartilhados dos 2 modos (cronômetro mm:ss + teto de 60s) ——

  function iniciarTimers(aoAtingirLimite: () => void) {
    setSegundos(0);
    cronometro.current = setInterval(() => setSegundos((s) => s + 1), 1000);
    limite.current = setTimeout(aoAtingirLimite, LIMITE_VOZ_MS);
  }

  function pararTimers() {
    if (cronometro.current !== null) {
      clearInterval(cronometro.current);
      cronometro.current = null;
    }
    if (limite.current !== null) {
      clearTimeout(limite.current);
      limite.current = null;
    }
  }

  /** Some com a dica de primeira vez e persiste que o mic já foi usado. */
  function marcarDicaComoVista() {
    if (!mostrarDica) {
      return;
    }
    setMostrarDica(false);
    try {
      window.localStorage.setItem(CHAVE_DICA_MIC, "1");
    } catch {
      // sem localStorage a dica só some nesta sessão — sem problema.
    }
  }

  // —— Voz nível 1: gravar áudio e transcrever no servidor (Groq Whisper) ——

  async function transcreverEEnviar(audio: Blob) {
    if (audio.size === 0) {
      return;
    }
    setTranscrevendo(true);
    try {
      const dados = new FormData();
      dados.append("audio", audio, `comando.${extensaoDoTipo(audio.type)}`);
      const resposta = await fetch("/api/transcrever", { method: "POST", body: dados });
      const corpo: unknown = await resposta.json().catch(() => null);
      const textoOuvido =
        resposta.ok &&
        typeof corpo === "object" && corpo !== null && "texto" in corpo &&
        typeof (corpo as { texto: unknown }).texto === "string"
          ? (corpo as { texto: string }).texto.trim()
          : "";
      if (textoOuvido === "") {
        avisarNoChat("Não consegui entender o áudio — tente de novo ou digite o comando.");
        return;
      }
      setTexto(textoOuvido);
      enviar(textoOuvido); // texto no input + envio automático
    } catch {
      avisarNoChat("Não consegui falar com o servidor agora — tente de novo ou digite o comando.");
    } finally {
      setTranscrevendo(false);
    }
  }

  async function iniciarGravacao() {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      avisarNoChat(
        "Preciso da permissão do microfone para te ouvir — libere nas configurações do navegador ou digite o comando.",
      );
      return;
    }
    let rec: MediaRecorder;
    try {
      const tipo = melhorTipoGravacao();
      rec = tipo ? new MediaRecorder(stream, { mimeType: tipo }) : new MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      avisarNoChat("Não consegui iniciar a gravação — tente de novo ou digite o comando.");
      return;
    }
    pedacos.current = [];
    cancelado.current = false;
    trilhaAudio.current = stream;
    rec.ondataavailable = (evento) => {
      if (evento.data.size > 0) {
        pedacos.current.push(evento.data);
      }
    };
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      trilhaAudio.current = null;
      gravador.current = null;
      pararTimers();
      setGravando(false);
      if (!cancelado.current) {
        const audio = new Blob(pedacos.current, { type: rec.mimeType || "audio/webm" });
        void transcreverEEnviar(audio);
      }
      pedacos.current = [];
    };
    gravador.current = rec;
    setGravando(true);
    // Teto de 60s: avisa e envia o que foi gravado até aqui. Fora isso, a
    // gravação SÓ para no clique do usuário (botão de parar ou X) — sem
    // timeslice, sem detecção de silêncio, sem auto-stop.
    iniciarTimers(() => {
      avisarNoChat(AVISO_LIMITE_60S);
      if (gravador.current && gravador.current.state !== "inactive") {
        gravador.current.stop();
      }
    });
    rec.start(); // sem timeslice: um único blob no stop
  }

  /** Descarta a gravação em andamento sem transcrever (botão X). */
  function cancelarGravacao() {
    cancelado.current = true;
    if (gravador.current && gravador.current.state !== "inactive") {
      gravador.current.stop();
    }
  }

  // —— Voz nível 2: Web Speech API em push-to-talk com keep-alive ——
  //
  // continuous + interimResults; os FINAIS acumulam em refs e o interim vai
  // para o input. O Chrome encerra a sessão sozinho após um silêncio — o
  // onend RELIGA o reconhecimento (preservando o buffer) enquanto o usuário
  // não clicou parar. Só enviamos no clique de parar (ou no teto de 60s).

  function iniciarVoz() {
    const Construtor = obterConstrutorVoz();
    if (!Construtor) {
      // Na prática inalcançável (modoVoz "web-speech" implica suporte).
      avisarNoChat("Seu navegador não suporta voz — digite o comando que eu resolvo igual.");
      return;
    }
    const rec = new Construtor();
    rec.lang = "pt-BR";
    rec.interimResults = true;
    rec.continuous = true;
    finaisAnteriores.current = "";
    finaisDaSessao.current = "";
    parcialVoz.current = "";
    paradaSolicitada.current = false;
    encerramentoVoz.current = "enviar";

    rec.onresult = (evento) => {
      let final = "";
      let parcial = "";
      for (let i = 0; i < evento.results.length; i += 1) {
        const resultado = evento.results[i];
        if (resultado.isFinal) {
          final += ` ${resultado[0].transcript}`;
        } else {
          parcial += ` ${resultado[0].transcript}`;
        }
      }
      finaisDaSessao.current = final;
      parcialVoz.current = parcial;
      // Buffer acumulado + finais desta sessão + interim, ao vivo no input.
      setTexto(montarFala(finaisAnteriores.current, final, parcial));
    };

    rec.onerror = (evento) => {
      // no-speech (silêncio) e aborted são esperados no keep-alive: o onend
      // religa o reconhecimento sem perder o buffer. Erros fatais param de
      // ouvir SEM enviar — o texto já ouvido fica no input para o usuário.
      if (evento.error === "no-speech" || evento.error === "aborted") {
        return;
      }
      paradaSolicitada.current = true;
      encerramentoVoz.current = "manter";
      if (evento.error === "not-allowed" || evento.error === "service-not-allowed") {
        avisarNoChat(
          "Preciso da permissão do microfone para te ouvir — libere nas configurações do navegador ou digite o comando.",
        );
      } else {
        avisarNoChat("Não consegui te ouvir direito — tente de novo ou digite o comando.");
      }
    };

    rec.onend = () => {
      // Consolida a sessão que terminou no buffer — inclui um interim que o
      // navegador não chegou a finalizar (quando finaliza, o último onresult
      // já o moveu para os finais e zerou o parcial; não há duplicação).
      finaisAnteriores.current = montarFala(
        finaisAnteriores.current,
        finaisDaSessao.current,
        parcialVoz.current,
      );
      finaisDaSessao.current = "";
      parcialVoz.current = "";
      if (!paradaSolicitada.current) {
        // Silêncio derrubou a sessão, mas o usuário NÃO clicou parar:
        // keep-alive — religa preservando o buffer acumulado.
        try {
          rec.start();
          return;
        } catch {
          // Não conseguiu religar — encerra de vez com o que já foi ouvido.
        }
      }
      pararTimers();
      setGravando(false);
      reconhecimento.current = null;
      const dito = finaisAnteriores.current;
      finaisAnteriores.current = "";
      if (encerramentoVoz.current === "descartar") {
        setTexto("");
        return;
      }
      setTexto(dito);
      if (encerramentoVoz.current === "enviar" && dito !== "") {
        enviar(dito); // só chega aqui por clique do usuário ou teto de 60s
      }
      // "manter" (erro fatal): o texto fica no input para revisar/enviar.
    };

    reconhecimento.current = rec;
    setGravando(true);
    setTexto("");
    // Teto de 60s: avisa e envia o que foi dito até aqui.
    iniciarTimers(() => {
      avisarNoChat(AVISO_LIMITE_60S);
      paradaSolicitada.current = true;
      encerramentoVoz.current = "enviar";
      reconhecimento.current?.stop();
    });
    rec.start();
  }

  /** Clique do usuário no botão de parar: encerra e ENVIA o acumulado. */
  function pararVozEEnviar() {
    paradaSolicitada.current = true;
    encerramentoVoz.current = "enviar";
    reconhecimento.current?.stop();
  }

  /** Botão X no modo Web Speech: encerra e DESCARTA o acumulado. */
  function cancelarVoz() {
    paradaSolicitada.current = true;
    encerramentoVoz.current = "descartar";
    reconhecimento.current?.stop();
  }

  // —— Mic: despacha para o melhor nível disponível ——
  function alternarMic() {
    if (!gravando) {
      marcarDicaComoVista();
    }
    if (modoVoz === "gravador") {
      if (gravando) {
        if (gravador.current && gravador.current.state !== "inactive") {
          gravador.current.stop(); // onstop transcreve e envia
        }
      } else {
        void iniciarGravacao();
      }
      return;
    }
    if (gravando) {
      pararVozEEnviar();
    } else {
      iniciarVoz();
    }
  }

  /** Botão X (qualquer modo): descarta a captura em andamento. */
  function cancelarCaptura() {
    if (modoVoz === "gravador") {
      cancelarGravacao();
    } else {
      cancelarVoz();
    }
  }

  const suportaVoz = modoVoz !== "nenhum";

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
          onClick={alternarMic}
          disabled={!suportaVoz || transcrevendo}
          aria-pressed={gravando}
          aria-label={
            !suportaVoz
              ? "Voz indisponível neste navegador"
              : gravando
                ? "Parar a gravação e enviar"
                : "Falar com a assistente"
          }
          title={
            !suportaVoz
              ? "Seu navegador não suporta voz — digite o comando"
              : gravando
                ? "Parar a gravação e enviar"
                : "Falar com a assistente"
          }
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors ${
            gravando
              ? "animate-pulse bg-brand text-brand-contrast shadow-[var(--shadow-soft)]"
              : "bg-brand-soft text-brand-strong hover:bg-brand-soft/70"
          } disabled:cursor-not-allowed disabled:opacity-40`}
        >
          {gravando ? (
            <Square className="h-4 w-4 fill-current" aria-hidden />
          ) : (
            <Mic className="h-5 w-5" aria-hidden />
          )}
        </button>

        {gravando && (
          <>
            <span
              className="shrink-0 text-xs font-semibold tabular-nums text-brand-strong"
              aria-label={`Gravando há ${segundos} segundos`}
            >
              {formatarTempo(segundos)}
            </span>
            <button
              type="button"
              onClick={cancelarCaptura}
              aria-label="Cancelar gravação"
              title="Cancelar gravação"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-subtle transition-colors hover:border-brand/40 hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </>
        )}

        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={
            transcrevendo
              ? "Transcrevendo o áudio…"
              : gravando
                ? "Gravando…"
                : "Digite ou fale seu comando…"
          }
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
          {`Gravando… toque para enviar (${formatarTempo(segundos)}) — o X cancela.`}
        </p>
      )}
      {transcrevendo && (
        <p className="px-5 pb-4 text-xs font-medium text-brand-strong" aria-live="polite">
          Transcrevendo o que você falou…
        </p>
      )}
      {!gravando && !transcrevendo && suportaVoz && mostrarDica && (
        <p className="px-5 pb-4 text-xs text-subtle">
          Toque no microfone, fale com calma e toque de novo para enviar.
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
          {resposta.viaIa && (
            <span
              className="mb-1.5 inline-flex items-center rounded-full border border-gold/40 bg-gold-soft px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-gold-strong"
              title="Comando entendido com ajuda de IA"
            >
              IA
            </span>
          )}
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
              <LinkDeAcao href={resposta.acaoRealizada.href}>
                {resposta.acaoRealizada.rotulo}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </LinkDeAcao>
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

// Link da acaoRealizada: hrefs EXTERNOS (ex.: wa.me da mensagem de WhatsApp)
// abrem em nova aba com rel seguro; internos seguem no next/link.
function LinkDeAcao({ href, children }: { href: string; children: React.ReactNode }) {
  const classes =
    "mt-3 inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand-soft px-3.5 py-1.5 text-xs font-semibold text-brand-strong transition-colors hover:bg-brand-soft/70";
  if (/^https?:\/\//.test(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
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
