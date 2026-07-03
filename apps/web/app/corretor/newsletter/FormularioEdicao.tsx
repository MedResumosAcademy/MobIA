"use client";

// Formulário de EDIÇÃO da newsletter (criar/editar) — client component fino
// sobre as Server Actions salvarEdicaoAction/atualizarEdicaoAction.
// Seletor de imóveis: checkboxes com thumb + preço, MÁXIMO 6 (limite do schema
// e do template de e-mail). Só imóveis DISPONÍVEIS da org chegam aqui (o
// Server Component pai filtra).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImageOff } from "lucide-react";
import { formatarReais } from "@imobia/core";
import { Botao } from "@/components/ui/Botao";
import { Campo, CampoTextarea, GrupoCampo } from "@/components/ui/Campo";
import {
  atualizarEdicaoAction,
  salvarEdicaoAction,
} from "@/lib/dados/newsletter";

const MAX_IMOVEIS = 6;

export type ImovelSelecionavel = {
  id: string;
  titulo: string;
  cidade: string;
  uf: string;
  /** Centavos. */
  valor: number;
  fotoCapa: string | null;
};

type EdicaoInicial = {
  id: string;
  titulo: string;
  assunto: string;
  introducao: string | null;
  imovelIds: string[];
};

export function FormularioEdicao({
  imoveis,
  edicao,
}: {
  imoveis: ImovelSelecionavel[];
  /** Presente = modo edição; ausente = nova edição (rascunho). */
  edicao?: EdicaoInicial;
}) {
  const router = useRouter();
  const [titulo, setTitulo] = useState(edicao?.titulo ?? "");
  const [assunto, setAssunto] = useState(edicao?.assunto ?? "");
  const [introducao, setIntroducao] = useState(edicao?.introducao ?? "");
  const [selecionados, setSelecionados] = useState<string[]>(
    () => edicao?.imovelIds ?? [],
  );
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function alternarImovel(id: string) {
    setSelecionados((atuais) => {
      if (atuais.includes(id)) {
        return atuais.filter((i) => i !== id);
      }
      if (atuais.length >= MAX_IMOVEIS) {
        return atuais; // limite atingido — checkbox também fica desabilitado
      }
      return [...atuais, id];
    });
  }

  function salvar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    iniciar(async () => {
      const payload = {
        titulo,
        assunto,
        introducao: introducao.trim() === "" ? undefined : introducao,
        imovelIds: selecionados,
      };
      const resultado = edicao
        ? await atualizarEdicaoAction(edicao.id, payload)
        : await salvarEdicaoAction(payload);
      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }
      router.push(`/corretor/newsletter/${resultado.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={salvar} className="mt-8 flex flex-col gap-6">
      <GrupoCampo
        rotulo="Título"
        obrigatorio
        htmlFor="nl-titulo"
        auxilio="Aparece como manchete no corpo do e-mail."
      >
        <Campo
          id="nl-titulo"
          required
          maxLength={160}
          placeholder="Ex.: As oportunidades da semana"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          disabled={pendente}
        />
      </GrupoCampo>

      <GrupoCampo
        rotulo="Assunto do e-mail"
        obrigatorio
        htmlFor="nl-assunto"
        auxilio="É o que o inscrito vê na caixa de entrada."
      >
        <Campo
          id="nl-assunto"
          required
          maxLength={160}
          placeholder="Ex.: 🏡 6 imóveis para você ver antes de todo mundo"
          value={assunto}
          onChange={(e) => setAssunto(e.target.value)}
          disabled={pendente}
        />
      </GrupoCampo>

      <GrupoCampo
        rotulo="Introdução"
        htmlFor="nl-introducao"
        auxilio="Texto de abertura, logo abaixo do título (opcional, até 1000 caracteres)."
      >
        <CampoTextarea
          id="nl-introducao"
          maxLength={1000}
          placeholder="Escreva uma abertura curta e pessoal…"
          value={introducao}
          onChange={(e) => setIntroducao(e.target.value)}
          disabled={pendente}
        />
      </GrupoCampo>

      {/* Seletor de imóveis (até 6) */}
      <fieldset>
        <legend className="text-sm font-medium text-foreground">
          Imóveis da edição{" "}
          <span className="font-normal text-subtle">
            ({selecionados.length}/{MAX_IMOVEIS})
          </span>
        </legend>
        <p className="mt-1 text-xs text-subtle">
          Escolha até {MAX_IMOVEIS} imóveis disponíveis da sua carteira.
        </p>
        {imoveis.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-border-strong bg-surface-card p-6 text-center text-sm text-subtle">
            Nenhum imóvel disponível na carteira — cadastre imóveis para incluí-los.
          </p>
        ) : (
          <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {imoveis.map((imovel) => {
              const marcado = selecionados.includes(imovel.id);
              const bloqueado =
                !marcado && selecionados.length >= MAX_IMOVEIS;
              return (
                <li key={imovel.id}>
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 shadow-[var(--shadow-soft)] transition-colors ${
                      marcado
                        ? "border-brand/50 bg-brand-soft"
                        : "border-border bg-surface-card hover:border-brand/30"
                    } ${bloqueado ? "cursor-not-allowed opacity-50" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={marcado}
                      disabled={pendente || bloqueado}
                      onChange={() => alternarImovel(imovel.id)}
                      className="h-4 w-4 shrink-0 rounded border-border-strong accent-[#DB6414]"
                    />
                    {imovel.fotoCapa ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imovel.fotoCapa}
                        alt=""
                        width={64}
                        height={48}
                        className="h-12 w-16 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <span className="flex h-12 w-16 shrink-0 items-center justify-center rounded-lg bg-surface text-subtle">
                        <ImageOff size={16} aria-hidden />
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {imovel.titulo}
                      </span>
                      <span className="block text-xs text-subtle">
                        {imovel.cidade}/{imovel.uf} ·{" "}
                        <span className="font-semibold text-brand-strong">
                          {formatarReais(imovel.valor)}
                        </span>
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>

      {erro && (
        <p className="text-sm text-brand-strong" role="alert">
          {erro}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Botao type="submit" variante="primario" disabled={pendente}>
          {pendente
            ? "Salvando…"
            : edicao
              ? "Salvar alterações"
              : "Salvar rascunho"}
        </Botao>
        <Botao
          type="button"
          variante="fantasma"
          disabled={pendente}
          onClick={() => router.back()}
        >
          Cancelar
        </Botao>
      </div>
    </form>
  );
}
