// Rota /sonhometro (E5 — H-16/H-17). Descobre "quanto você pode comprar":
// formulário guiado (renda/FGTS/idade/estado civil/dependentes/cidade) que chama
// a Server Action de cálculo e mostra o resultado + detalhamento. O cálculo é
// interativo, mas os efeitos (perfil/cookie/evento) rodam no servidor.
import type { Metadata } from "next";
import { SonhometroFormulario } from "@/components/SonhometroFormulario";

export const metadata: Metadata = { title: "Sonhômetro — MobIA" };

export default function PaginaSonhometro() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 px-6 py-10 font-sans dark:bg-black">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Sonhômetro
          </h1>
          <p className="text-base text-zinc-600 dark:text-zinc-400">
            Descubra quanto você consegue comprar hoje. Preencha seus dados e veja o valor máximo do
            imóvel, a melhor modalidade e o detalhamento — em segundos.
          </p>
        </header>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <SonhometroFormulario />
        </section>
      </main>
    </div>
  );
}
