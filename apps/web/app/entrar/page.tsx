import type { Metadata } from "next";
import Link from "next/link";
import { entrar } from "@/lib/auth/acoes";
import { Botao } from "@/components/ui/Botao";
import { Campo, GrupoCampo } from "@/components/ui/Campo";

export const metadata: Metadata = { title: "Entrar — MobIA" };

const MENSAGENS_ERRO: Record<string, string> = {
  "campos-obrigatorios": "Preencha e-mail e senha.",
  "credenciais-invalidas": "E-mail ou senha incorretos.",
  "email-nao-confirmado": "Confirme seu e-mail antes de entrar.",
  "erro-inesperado": "Não foi possível entrar agora. Tente novamente em instantes.",
};

const MENSAGENS_AVISO: Record<string, string> = {
  "confirme-email": "Conta criada! Confira seu e-mail para confirmar o cadastro.",
};

export default async function PaginaEntrar({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; aviso?: string }>;
}) {
  const { erro, aviso } = await searchParams;
  const mensagemErro = erro ? (MENSAGENS_ERRO[erro] ?? MENSAGENS_ERRO["erro-inesperado"]) : null;
  const mensagemAviso = aviso ? MENSAGENS_AVISO[aviso] : null;

  return (
    <div className="flex flex-1 items-center justify-center bg-background px-6 py-16 font-sans">
      <main className="w-full max-w-sm rounded-2xl border border-border bg-surface-card p-8 shadow-[var(--shadow-soft)]">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Entrar
        </h1>
        <p className="mt-1 text-sm text-muted">
          Acesse sua conta para montar sua compra.
        </p>

        {mensagemAviso && (
          <p
            role="status"
            className="mt-4 rounded-xl border border-gold/40 bg-gold-soft px-3.5 py-2.5 text-sm text-gold-strong"
          >
            {mensagemAviso}
          </p>
        )}
        {mensagemErro && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800"
          >
            {mensagemErro}
          </p>
        )}

        <form action={entrar} className="mt-6 flex flex-col gap-4">
          <GrupoCampo rotulo="E-mail" htmlFor="email" obrigatorio>
            <Campo
              id="email"
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="voce@exemplo.com"
            />
          </GrupoCampo>
          <GrupoCampo rotulo="Senha" htmlFor="senha" obrigatorio>
            <Campo
              id="senha"
              type="password"
              name="senha"
              required
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </GrupoCampo>
          <Botao type="submit" tamanho="lg" className="mt-2 w-full">
            Entrar
          </Botao>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Ainda não tem conta?{" "}
          <Link
            href="/cadastro"
            className="font-medium text-brand-strong underline underline-offset-4 hover:text-brand"
          >
            Cadastre-se
          </Link>
        </p>
      </main>
    </div>
  );
}
