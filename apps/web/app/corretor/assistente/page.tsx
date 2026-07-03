// ASSISTENTE ImobIA (área /corretor — o layout já exige papel profissional).
// Server Component FINO: só o cabeçalho de apresentação; toda a conversa
// (texto + voz via Web Speech API) vive no client <Chat />. pt-BR.

import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { iaDisponivel } from "@/lib/ia/interpretador-llm";
import { Chat } from "./Chat";

export const metadata: Metadata = { title: "Assistente" };

export default function PaginaAssistente() {
  return (
    <div className="flex flex-1 flex-col items-center bg-background px-6 py-16 font-sans">
      <main className="w-full max-w-3xl">
        <header className="flex items-center gap-4">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand text-brand-contrast shadow-[var(--shadow-soft)]"
            aria-hidden
          >
            <Sparkles className="h-7 w-7" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-strong">
              Sua copiloto de vendas
            </p>
            <h1 className="mt-0.5 text-3xl font-semibold tracking-tight text-foreground">
              Assistente ImobIA
            </h1>
            <p className="mt-1 text-muted">
              Fale ou digite — eu preencho o CRM, cuido da agenda e te aviso do que importa.
            </p>
          </div>
        </header>

        {/* Com GROQ_API_KEY no servidor, o mic grava áudio e transcreve via
            /api/transcrever; sem ela, o Chat degrada para a Web Speech API. */}
        <Chat transcricaoDisponivel={iaDisponivel()} />
      </main>
    </div>
  );
}
