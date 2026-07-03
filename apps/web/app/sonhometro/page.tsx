// Rota /sonhometro (E5 — H-16/H-17). Descobre "quanto você pode comprar":
// formulário guiado (renda/FGTS/idade/estado civil/dependentes/cidade) que chama
// a Server Action de cálculo e mostra o resultado + detalhamento. O cálculo é
// interativo, mas os efeitos (perfil/cookie/evento) rodam no servidor.
import type { Metadata } from "next";
import { SonhometroFormulario } from "@/components/SonhometroFormulario";

export const metadata: Metadata = {
  title: "Sonhômetro",
  description:
    "Descubra em minutos quanto imóvel cabe no seu bolso: simule renda, entrada e parcelas e veja imóveis compatíveis com o seu momento.",
};

export default function PaginaSonhometro() {
  return (
    <div className="flex flex-1 flex-col bg-background px-6 py-12 font-sans">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <span className="w-fit rounded-full bg-gold-soft px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gold-strong">
            Ferramenta gratuita
          </span>
          <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Sonhômetro
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-muted">
            Descubra quanto você consegue comprar hoje. Preencha seus dados e veja o valor máximo do
            imóvel, a melhor modalidade e o detalhamento — em segundos.
          </p>
        </header>

        <section className="rounded-2xl border border-border bg-surface-card p-6 shadow-soft sm:p-8">
          <SonhometroFormulario />
        </section>
      </main>
    </div>
  );
}
