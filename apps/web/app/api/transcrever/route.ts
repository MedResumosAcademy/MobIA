// TRANSCRIÇÃO DE ÁUDIO no servidor (Groq Whisper) — POST /api/transcrever.
//
// O client (Chat do assistente) grava com MediaRecorder e manda o áudio aqui;
// nós repassamos para a API de audio transcriptions da Groq (fetch direto,
// SEM SDK extra) e devolvemos só { texto }. A chave vive em
// process.env.GROQ_API_KEY (.env.local) e NUNCA é logada/exposta.
//
// Contratos:
//   - Sessão de profissional obrigatória (corretor/gestor/admin) ⇒ 401/403.
//   - FormData com "audio" (webm/ogg/m4a/wav…), até ~10MB ⇒ 400/413.
//   - Sem chave ⇒ 503 { erro: "transcrição indisponível" }.
//   - Falha da Groq/timeout ⇒ 502 { erro } SEM vazar detalhes.

import { NextResponse } from "next/server";
import { obterPerfil, obterSessao } from "@/lib/auth/sessao";

const LIMITE_BYTES = 10 * 1024 * 1024; // ~10MB
const TIMEOUT_MS = 30_000;
const URL_GROQ = "https://api.groq.com/openai/v1/audio/transcriptions";
const MODELO = "whisper-large-v3-turbo";

// Extensões que o Whisper da Groq aceita — usadas para nomear o arquivo
// repassado (a API detecta o formato pela extensão do nome).
const EXTENSOES_ACEITAS = new Set([
  "webm", "ogg", "oga", "opus", "m4a", "mp4", "wav", "mp3", "mpga", "mpeg", "flac",
]);

const EXTENSAO_POR_MIME: Record<string, string> = {
  "audio/webm": "webm",
  "video/webm": "webm",
  "audio/ogg": "ogg",
  "application/ogg": "ogg",
  "audio/opus": "opus",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
  "audio/aac": "m4a",
  "video/mp4": "mp4",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/flac": "flac",
};

/** Nome de arquivo com extensão reconhecível, ou null se o formato é opaco. */
function nomeParaGroq(audio: Blob): string | null {
  // 1º: extensão do próprio nome (quando veio como File).
  if (audio instanceof File && audio.name.includes(".")) {
    const ext = audio.name.split(".").pop()?.toLowerCase() ?? "";
    if (EXTENSOES_ACEITAS.has(ext)) {
      return `audio.${ext}`;
    }
  }
  // 2º: extensão derivada do MIME (ignorando parâmetros tipo ";codecs=opus").
  const mime = audio.type.split(";")[0]?.trim().toLowerCase() ?? "";
  const ext = EXTENSAO_POR_MIME[mime];
  return ext ? `audio.${ext}` : null;
}

function erro(status: number, mensagem: string) {
  return NextResponse.json({ erro: mensagem }, { status });
}

export async function POST(request: Request) {
  // Autenticação/autorização — mesma régua do assistente (área profissional).
  const sessao = await obterSessao();
  if (!sessao) {
    return erro(401, "faça login para usar a transcrição");
  }
  const perfil = await obterPerfil(sessao.usuarioId);
  if (!perfil || perfil.papel === "cliente" || !perfil.orgId) {
    return erro(403, "a transcrição é exclusiva para contas profissionais");
  }

  const chave = process.env.GROQ_API_KEY;
  if (!chave) {
    return erro(503, "transcrição indisponível");
  }

  // Rejeição barata pelo Content-Length antes de ler o corpo inteiro.
  const tamanhoDeclarado = Number(request.headers.get("content-length") ?? "0");
  if (tamanhoDeclarado > LIMITE_BYTES + 64 * 1024) {
    return erro(413, "áudio muito grande — grave um comando mais curto");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return erro(400, "envie o áudio como multipart/form-data no campo 'audio'");
  }

  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return erro(400, "envie o áudio no campo 'audio'");
  }
  if (audio.size > LIMITE_BYTES) {
    return erro(413, "áudio muito grande — grave um comando mais curto");
  }
  const nome = nomeParaGroq(audio);
  if (!nome) {
    return erro(400, "formato de áudio não suportado");
  }

  const corpo = new FormData();
  corpo.append("file", audio, nome);
  corpo.append("model", MODELO);
  corpo.append("language", "pt");
  corpo.append("response_format", "json");

  try {
    const resposta = await fetch(URL_GROQ, {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}` },
      body: corpo,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!resposta.ok) {
      // Nunca repassa o corpo da Groq (pode conter detalhes internos).
      return erro(502, "não consegui transcrever o áudio agora");
    }
    const dados: unknown = await resposta.json();
    const texto =
      typeof dados === "object" && dados !== null && "text" in dados &&
      typeof (dados as { text: unknown }).text === "string"
        ? (dados as { text: string }).text.trim()
        : "";
    if (texto === "") {
      return erro(502, "não consegui transcrever o áudio agora");
    }
    return NextResponse.json({ texto });
  } catch {
    return erro(502, "não consegui transcrever o áudio agora");
  }
}
