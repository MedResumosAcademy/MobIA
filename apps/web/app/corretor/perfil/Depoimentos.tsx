"use client";

// Seção de DEPOIMENTOS (client) — renderiza os cards com estrelas e, quando o
// visitante pode gerenciar (próprio perfil ou gestor), oferece um formulário de
// "Adicionar depoimento" (autor, relação, nota 1-5, texto) e botões de remover.
// Finas camadas sobre as Server Actions adicionarDepoimento/removerDepoimento
// (lib/dados/perfil.ts): a validação e a RLS estão no server; aqui só interação.
// Após cada ação, router.refresh() re-renderiza o Server Component pai.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star, Plus, Trash2, X, MessageSquareQuote } from "lucide-react";
import type { DepoimentoPerfil } from "@/lib/dados/perfil";
import { adicionarDepoimento, removerDepoimento } from "@/lib/dados/perfil";
import { Botao } from "@/components/ui/Botao";
import { GrupoCampo, Campo, CampoTextarea, CampoSelect } from "@/components/ui/Campo";

type Props = {
  corretorId: string;
  depoimentos: DepoimentoPerfil[];
  /** true no próprio perfil ou quando gestor — habilita adicionar/remover. */
  podeGerenciar: boolean;
};

// Estrelas da nota (1-5). Preenchidas em âmbar; vazias esmaecidas.
function Estrelas({ nota }: { nota: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Nota ${nota} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${
            i <= nota ? "fill-gold text-gold" : "text-border-strong"
          }`}
          aria-hidden
        />
      ))}
    </span>
  );
}

export function Depoimentos({ corretorId, depoimentos, podeGerenciar }: Props) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const [autorNome, setAutorNome] = useState("");
  const [autorRelacao, setAutorRelacao] = useState("");
  const [nota, setNota] = useState("5");
  const [texto, setTexto] = useState("");

  function limpar() {
    setAutorNome("");
    setAutorRelacao("");
    setNota("5");
    setTexto("");
    setErro(null);
  }

  function adicionar() {
    setErro(null);
    iniciar(async () => {
      const r = await adicionarDepoimento(corretorId, {
        autorNome,
        autorRelacao: autorRelacao || undefined,
        nota: nota ? Number(nota) : undefined,
        texto,
      });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      limpar();
      setAberto(false);
      router.refresh();
    });
  }

  function remover(id: string) {
    iniciar(async () => {
      const r = await removerDepoimento(id);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Depoimentos</h2>
          <p className="mt-1 text-sm text-muted">
            O que clientes e parceiros dizem.
          </p>
        </div>
        {podeGerenciar && !aberto && (
          <Botao
            variante="secundario"
            tamanho="sm"
            onClick={() => setAberto(true)}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Adicionar
          </Botao>
        )}
      </div>

      {/* Formulário de adição */}
      {podeGerenciar && aberto && (
        <div className="mt-4 rounded-2xl border border-brand/30 bg-surface-card p-6 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Novo depoimento</h3>
            <button
              type="button"
              onClick={() => {
                setAberto(false);
                limpar();
              }}
              className="rounded-lg p-1 text-subtle transition-colors hover:bg-surface hover:text-foreground"
              aria-label="Fechar formulário"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <GrupoCampo rotulo="Autor" htmlFor="dep-autor" obrigatorio>
              <Campo
                id="dep-autor"
                value={autorNome}
                onChange={(e) => setAutorNome(e.target.value)}
                placeholder="Nome do cliente"
              />
            </GrupoCampo>

            <GrupoCampo rotulo="Relação" htmlFor="dep-relacao">
              <Campo
                id="dep-relacao"
                value={autorRelacao}
                onChange={(e) => setAutorRelacao(e.target.value)}
                placeholder="Cliente, Parceiro..."
              />
            </GrupoCampo>

            <GrupoCampo rotulo="Nota" htmlFor="dep-nota">
              <CampoSelect
                id="dep-nota"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
              >
                <option value="5">5 estrelas</option>
                <option value="4">4 estrelas</option>
                <option value="3">3 estrelas</option>
                <option value="2">2 estrelas</option>
                <option value="1">1 estrela</option>
              </CampoSelect>
            </GrupoCampo>

            <GrupoCampo
              rotulo="Depoimento"
              htmlFor="dep-texto"
              obrigatorio
              className="sm:col-span-2"
            >
              <CampoTextarea
                id="dep-texto"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Escreva o depoimento..."
                maxLength={800}
              />
            </GrupoCampo>
          </div>

          {erro && <p className="mt-4 text-sm text-brand-strong">{erro}</p>}

          <div className="mt-5 flex items-center gap-3">
            <Botao onClick={adicionar} disabled={pendente} className="gap-1.5">
              <Plus className="h-4 w-4" aria-hidden />
              {pendente ? "Enviando..." : "Adicionar depoimento"}
            </Botao>
            <Botao
              variante="fantasma"
              onClick={() => {
                setAberto(false);
                limpar();
              }}
              disabled={pendente}
            >
              Cancelar
            </Botao>
          </div>
        </div>
      )}

      {/* Erro fora do formulário (ex.: falha ao remover) */}
      {erro && !aberto && <p className="mt-4 text-sm text-brand-strong">{erro}</p>}

      {/* Lista de depoimentos */}
      {depoimentos.length === 0 ? (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border-strong bg-surface-card p-10 text-center">
          <MessageSquareQuote className="h-8 w-8 text-subtle" aria-hidden />
          <p className="text-sm font-medium text-foreground">Sem depoimentos ainda</p>
          <p className="text-sm text-subtle">
            Os elogios de clientes aparecerão aqui.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {depoimentos.map((d) => (
            <figure
              key={d.id}
              className="relative flex flex-col gap-3 rounded-2xl border border-border bg-surface-card p-5 shadow-[var(--shadow-soft)]"
            >
              {d.nota != null && <Estrelas nota={d.nota} />}
              <blockquote className="text-sm leading-relaxed text-foreground">
                “{d.texto}”
              </blockquote>
              <figcaption className="mt-auto flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {d.autorNome}
                  </p>
                  {d.autorRelacao && (
                    <p className="text-xs text-subtle">{d.autorRelacao}</p>
                  )}
                </div>
                {podeGerenciar && (
                  <button
                    type="button"
                    onClick={() => remover(d.id)}
                    disabled={pendente}
                    className="rounded-lg p-1.5 text-subtle transition-colors hover:bg-surface hover:text-brand-strong disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={`Remover depoimento de ${d.autorNome}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
