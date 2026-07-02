import type { Metadata } from "next";
import { obterPerfil, obterSessao } from "@/lib/auth/sessao";

export const metadata: Metadata = { title: "Painel do corretor — MobIA" };

export default async function PainelCorretor() {
  const sessao = await obterSessao();
  const perfil = sessao ? await obterPerfil(sessao.usuarioId) : null;

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-6 py-16 font-sans dark:bg-black">
      <main className="w-full max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Painel do corretor
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Olá, {perfil?.nome ?? sessao?.email ?? "corretor"}.
        </p>

        <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-950">
          <dl className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-sm text-zinc-500 dark:text-zinc-400">Papel</dt>
              <dd className="text-base font-medium text-zinc-950 dark:text-zinc-50">
                {perfil?.papel ?? "corretor"}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-sm text-zinc-500 dark:text-zinc-400">Organização</dt>
              <dd className="text-base font-medium text-zinc-950 dark:text-zinc-50">
                {perfil?.orgId ?? "org não configurada"}
              </dd>
            </div>
          </dl>
          <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
            Em breve: seus imóveis, leads e simulações dos clientes.
          </p>
        </section>
      </main>
    </div>
  );
}
