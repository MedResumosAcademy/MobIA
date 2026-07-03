"use client";

// Bloco togglável para EDITAR os dados de um negócio: contato (nome/telefone/
// e-mail), valor e origem. Fina camada client sobre atualizarNegocioAction
// (../acoes.ts). NÃO mexe em etapa/resultado (têm controles dedicados). Após a
// ação, router.refresh() re-renderiza o Server Component pai. O escopo é da RLS.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Botao } from "@/components/ui/Botao";
import { Campo, GrupoCampo } from "@/components/ui/Campo";
import { atualizarNegocioAction } from "../acoes";

type Props = {
  id: string;
  nomeContato: string;
  telefoneContato: string | null;
  emailContato: string | null;
  origem: string | null;
  /** Valor em CENTAVOS (como no banco) ou null. */
  valor: number | null;
};

/** Centavos → string de reais para o input (ex.: 128000000 → "1280000.00"). */
function centavosParaReais(centavos: number | null): string {
  if (centavos === null) {
    return "";
  }
  return (centavos / 100).toFixed(2);
}

export function EditarNegocio({
  id,
  nomeContato,
  telefoneContato,
  emailContato,
  origem,
  valor,
}: Props) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [aberto, setAberto] = useState(false);

  const [nome, setNome] = useState(nomeContato);
  const [telefone, setTelefone] = useState(telefoneContato ?? "");
  const [email, setEmail] = useState(emailContato ?? "");
  const [origemForm, setOrigemForm] = useState(origem ?? "");
  const [valorForm, setValorForm] = useState(centavosParaReais(valor));

  function reverter() {
    setNome(nomeContato);
    setTelefone(telefoneContato ?? "");
    setEmail(emailContato ?? "");
    setOrigemForm(origem ?? "");
    setValorForm(centavosParaReais(valor));
  }

  function salvar() {
    if (nome.trim() === "") {
      return;
    }
    iniciar(async () => {
      const fd = new FormData();
      fd.set("id", id);
      fd.set("nomeContato", nome);
      fd.set("telefoneContato", telefone);
      fd.set("emailContato", email);
      fd.set("origem", origemForm);
      fd.set("valor", valorForm);
      await atualizarNegocioAction(fd);
      setAberto(false);
      router.refresh();
    });
  }

  if (!aberto) {
    return (
      <div className="flex justify-end">
        <Botao
          variante="secundario"
          tamanho="sm"
          onClick={() => {
            reverter();
            setAberto(true);
          }}
        >
          <Pencil className="h-4 w-4" aria-hidden />
          Editar dados
        </Botao>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-surface-card p-6 shadow-[var(--shadow-soft)]">
      <h2 className="text-lg font-semibold text-foreground">Editar dados</h2>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <GrupoCampo rotulo="Nome do contato" htmlFor="editar-nome" obrigatorio>
          <Campo
            id="editar-nome"
            value={nome}
            disabled={pendente}
            onChange={(e) => setNome(e.target.value)}
          />
        </GrupoCampo>
        <GrupoCampo rotulo="Telefone" htmlFor="editar-telefone">
          <Campo
            id="editar-telefone"
            type="tel"
            value={telefone}
            disabled={pendente}
            placeholder="Ex.: 11988887777"
            onChange={(e) => setTelefone(e.target.value)}
          />
        </GrupoCampo>
        <GrupoCampo rotulo="E-mail" htmlFor="editar-email">
          <Campo
            id="editar-email"
            type="email"
            value={email}
            disabled={pendente}
            placeholder="contato@exemplo.com"
            onChange={(e) => setEmail(e.target.value)}
          />
        </GrupoCampo>
        <GrupoCampo rotulo="Origem" htmlFor="editar-origem">
          <Campo
            id="editar-origem"
            value={origemForm}
            disabled={pendente}
            placeholder="Ex.: indicação, portal"
            onChange={(e) => setOrigemForm(e.target.value)}
          />
        </GrupoCampo>
        <GrupoCampo
          rotulo="Valor (R$)"
          htmlFor="editar-valor"
          auxilio="Use ponto para centavos. Ex.: 1280000.00"
        >
          <Campo
            id="editar-valor"
            inputMode="decimal"
            value={valorForm}
            disabled={pendente}
            placeholder="Ex.: 1280000.00"
            onChange={(e) => setValorForm(e.target.value)}
          />
        </GrupoCampo>
      </div>
      <div className="mt-5 flex flex-wrap gap-3 border-t border-border pt-5">
        <Botao
          variante="primario"
          disabled={pendente || nome.trim() === ""}
          onClick={salvar}
        >
          {pendente ? "Salvando…" : "Salvar alterações"}
        </Botao>
        <Botao
          variante="secundario"
          disabled={pendente}
          onClick={() => {
            reverter();
            setAberto(false);
          }}
        >
          Cancelar
        </Botao>
      </div>
    </section>
  );
}
