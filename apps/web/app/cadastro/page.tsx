import type { Metadata } from "next";
import Link from "next/link";
import { cadastrar } from "@/lib/auth/acoes";
import { Botao } from "@/components/ui/Botao";
import { Campo, GrupoCampo } from "@/components/ui/Campo";

export const metadata: Metadata = { title: "Cadastro — ImobIA" };

const MENSAGENS_ERRO: Record<string, string> = {
  "campos-obrigatorios": "Preencha e-mail e senha.",
  "senha-curta": "A senha precisa ter pelo menos 6 caracteres.",
  "senha-fraca": "Senha muito fraca. Use uma combinação mais difícil de adivinhar.",
  "email-ja-cadastrado": "Este e-mail já tem cadastro. Tente entrar.",
  "erro-inesperado": "Não foi possível criar sua conta agora. Tente novamente em instantes.",
};

export default async function PaginaCadastro({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const mensagemErro = erro ? (MENSAGENS_ERRO[erro] ?? MENSAGENS_ERRO["erro-inesperado"]) : null;

  return (
    <div className="flex flex-1 items-center justify-center bg-background px-6 py-16 font-sans">
      <main className="w-full max-w-sm rounded-2xl border border-border bg-surface-card p-8 shadow-[var(--shadow-soft)]">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Criar conta
        </h1>
        <p className="mt-1 text-sm text-muted">
          Cadastre-se para descobrir quanto você consegue comprar.
        </p>

        {mensagemErro && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800"
          >
            {mensagemErro}
          </p>
        )}

        <form action={cadastrar} className="mt-6 flex flex-col gap-4">
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
          <GrupoCampo
            rotulo="Senha"
            htmlFor="senha"
            obrigatorio
            auxilio="Mínimo de 6 caracteres."
          >
            <Campo
              id="senha"
              type="password"
              name="senha"
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="Mínimo de 6 caracteres"
            />
          </GrupoCampo>
          <Botao type="submit" tamanho="lg" className="mt-2 w-full">
            Criar conta
          </Botao>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Já tem conta?{" "}
          <Link
            href="/entrar"
            className="font-medium text-brand-strong underline underline-offset-4 hover:text-brand"
          >
            Entrar
          </Link>
        </p>
      </main>
    </div>
  );
}
