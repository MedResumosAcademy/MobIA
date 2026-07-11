"use client";

// FORMULÁRIO de template de WhatsApp (criar/editar o ESPELHO local). O slug
// precisa ser o EXATO registrado na Meta; o corpo usa {{1}}, {{2}}… Editar o
// conteúdo VOLTA o status para 'rascunho' (o texto local deixou de ser o
// aprovado lá) — o aviso da tela deixa isso claro.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { CATEGORIAS_TEMPLATE, type CategoriaTemplate } from "@imobia/domain";
import { Botao } from "@/components/ui/Botao";
import { Campo, CampoSelect, CampoTextarea, GrupoCampo } from "@/components/ui/Campo";
import { atualizarTemplateAction, criarTemplateAction } from "@/lib/dados/templates";
import { ROTULO_CATEGORIA_TEMPLATE } from "../rotulos";

export type TemplateInicial = {
  id?: string;
  nome: string;
  idioma: string;
  corpo: string;
  categoria: CategoriaTemplate;
};

export function FormTemplate({ inicial }: { inicial: TemplateInicial }) {
  const router = useRouter();
  const [nome, setNome] = useState(inicial.nome);
  const [idioma, setIdioma] = useState(inicial.idioma);
  const [corpo, setCorpo] = useState(inicial.corpo);
  const [categoria, setCategoria] = useState<CategoriaTemplate>(inicial.categoria);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const editando = inicial.id !== undefined;

  function salvar() {
    setErro(null);
    iniciar(async () => {
      const input = {
        nome: nome.trim(),
        idioma: idioma.trim() === "" ? "pt_BR" : idioma.trim(),
        corpo: corpo.trim(),
        categoria,
      };
      const r = editando
        ? await atualizarTemplateAction(inicial.id as string, input)
        : await criarTemplateAction(input);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      router.push("/corretor/crm/templates");
      router.refresh();
    });
  }

  return (
    <form
      className="mt-4 flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        salvar();
      }}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_10rem_12rem]">
        <GrupoCampo
          rotulo="Nome (slug da Meta)"
          obrigatorio
          htmlFor="template-nome"
          auxilio="Minúsculas, números e _ — idêntico ao registrado na Meta."
        >
          <Campo
            id="template-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="boas_vindas_imobiliaria"
            maxLength={120}
            pattern="[a-z0-9_]+"
            required
          />
        </GrupoCampo>
        <GrupoCampo rotulo="Idioma" htmlFor="template-idioma">
          <Campo
            id="template-idioma"
            value={idioma}
            onChange={(e) => setIdioma(e.target.value)}
            placeholder="pt_BR"
            maxLength={15}
          />
        </GrupoCampo>
        <GrupoCampo rotulo="Categoria" obrigatorio htmlFor="template-categoria">
          <CampoSelect
            id="template-categoria"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as CategoriaTemplate)}
          >
            {CATEGORIAS_TEMPLATE.map((c) => (
              <option key={c} value={c}>
                {ROTULO_CATEGORIA_TEMPLATE[c]}
              </option>
            ))}
          </CampoSelect>
        </GrupoCampo>
      </div>
      <GrupoCampo
        rotulo="Corpo"
        obrigatorio
        htmlFor="template-corpo"
        auxilio={
          <>
            Variáveis com chaves duplas: {"{{1}}"}, {"{{2}}"}… Máx. 1024
            caracteres.
          </>
        }
      >
        <CampoTextarea
          id="template-corpo"
          value={corpo}
          onChange={(e) => setCorpo(e.target.value)}
          placeholder={"Olá {{1}}! Aqui é a equipe da imobiliária…"}
          maxLength={1024}
          className="min-h-28"
          required
        />
      </GrupoCampo>
      {editando && (
        <p className="rounded-xl border border-gold/40 bg-gold-soft px-3 py-2 text-xs font-medium text-gold-strong">
          Editar o conteúdo volta o status para Rascunho — o texto local deixa
          de ser o que a Meta aprovou.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Botao type="submit" disabled={pendente || nome.trim() === "" || corpo.trim() === ""}>
          <Save className="h-4 w-4" aria-hidden />
          {pendente ? "Salvando…" : editando ? "Salvar alterações" : "Criar template"}
        </Botao>
        {erro !== null && (
          <p className="text-sm font-medium text-gold-strong" role="status">
            {erro}
          </p>
        )}
      </div>
    </form>
  );
}
