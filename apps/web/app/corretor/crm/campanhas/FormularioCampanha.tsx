"use client";

// FORMULÁRIO de nova campanha (gestor/admin): nome, template aprovado na Meta,
// mensagem com PREVIEW estilo WhatsApp e o SEGMENTO em pílulas (etapas do
// funil, temperaturas e tags). "Prever alcance" usa preverAlcanceAction — a
// MESMA segmentação do disparo — e mostra o número honesto: alvo + excluídos
// sem consentimento (LGPD) + sem telefone. Salvar cria o rascunho e navega
// para a página da campanha (onde vive o disparo).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Target } from "lucide-react";
import {
  ETAPAS_NEGOCIO,
  TEMPERATURAS,
  type EtapaNegocio,
  type Segmento,
  type Temperatura,
} from "@imobia/domain";
import { Botao } from "@/components/ui/Botao";
import { Campo, CampoTextarea, GrupoCampo } from "@/components/ui/Campo";
import { PilulasCategoria } from "@/components/ui/PilulasCategoria";
import { preverAlcanceAction, salvarCampanhaAction } from "@/lib/dados/campanhas";
import { plural } from "@/lib/plural";
import { ROTULO_ETAPA } from "../../negocios/rotulos";
import { ROTULO_TEMPERATURA } from "../rotulos";

type Previsao = {
  alvo: number;
  excluidos: { semConsentimento: number; semTelefone: number };
};

function alternar<T extends string>(lista: T[], valor: T): T[] {
  return lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];
}

export function FormularioCampanha({ tagsDisponiveis }: { tagsDisponiveis: string[] }) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [templateNome, setTemplateNome] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [etapas, setEtapas] = useState<EtapaNegocio[]>([]);
  const [temperaturas, setTemperaturas] = useState<Temperatura[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [previsao, setPrevisao] = useState<Previsao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [prevendo, iniciarPrevisao] = useTransition();
  const [salvando, iniciarSalvar] = useTransition();

  function montarSegmento(): Segmento {
    const seg: Segmento = {};
    if (etapas.length > 0) {
      seg.etapas = etapas;
    }
    if (temperaturas.length > 0) {
      seg.temperaturas = temperaturas;
    }
    if (tags.length > 0) {
      seg.tags = tags;
    }
    return seg;
  }

  function preverAlcance() {
    setErro(null);
    iniciarPrevisao(async () => {
      const r = await preverAlcanceAction(montarSegmento());
      if (r.ok) {
        setPrevisao({ alvo: r.alvo, excluidos: r.excluidos });
      } else {
        setPrevisao(null);
        setErro(r.erro);
      }
    });
  }

  function salvar() {
    setErro(null);
    iniciarSalvar(async () => {
      const r = await salvarCampanhaAction({
        nome: nome.trim(),
        mensagem: mensagem.trim(),
        templateNome: templateNome.trim() === "" ? undefined : templateNome.trim(),
        segmento: montarSegmento(),
      });
      if (r.ok) {
        router.push(`/corretor/crm/campanhas/${r.id}`);
      } else {
        setErro(r.erro);
      }
    });
  }

  return (
    <form
      className="mt-6 flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        salvar();
      }}
    >
      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-card p-6 shadow-[var(--shadow-soft)]">
        <GrupoCampo rotulo="Nome da campanha" obrigatorio htmlFor="campanha-nome">
          <Campo
            id="campanha-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Lançamento Jardins — julho"
            maxLength={120}
            required
          />
        </GrupoCampo>
        <GrupoCampo
          rotulo="Template aprovado na Meta"
          htmlFor="campanha-template"
          auxilio="Campanha inicia conversa fora da janela de 24h — o disparo exige um template aprovado. Dá para salvar o rascunho sem ele."
        >
          <Campo
            id="campanha-template"
            value={templateNome}
            onChange={(e) => setTemplateNome(e.target.value)}
            placeholder="lancamento_jardins_v1"
            maxLength={120}
          />
        </GrupoCampo>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <GrupoCampo
            rotulo="Mensagem"
            obrigatorio
            htmlFor="campanha-mensagem"
            auxilio="Registrada no histórico de cada contato; o texto entregue é o do template."
          >
            <CampoTextarea
              id="campanha-mensagem"
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              placeholder="Olá! Acabou de sair o lançamento no Jardins com condições especiais…"
              maxLength={4096}
              className="min-h-32"
              required
            />
          </GrupoCampo>
          {/* Preview estilo bolha de WhatsApp */}
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium text-foreground">Preview</p>
            <div className="flex flex-1 items-start rounded-xl border border-border bg-surface p-4">
              <div className="max-w-full rounded-2xl rounded-tl-sm bg-brand-soft px-4 py-3 shadow-[var(--shadow-soft)]">
                <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                  {mensagem.trim() === ""
                    ? "A mensagem aparece aqui como o contato veria."
                    : mensagem}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface-card p-6 shadow-[var(--shadow-soft)]">
        <h2 className="text-lg font-semibold text-foreground">Segmento</h2>
        <p className="mt-1 text-sm text-muted">
          Filtros combinados por E — sem nenhum filtro, a campanha vai para
          todos os contatos consentidos.
        </p>

        <p className="mt-4 text-sm font-medium text-foreground">Etapa do funil</p>
        <PilulasCategoria
          className="mt-2"
          tamanho="sm"
          aria="Filtrar por etapa do funil"
          opcoes={ETAPAS_NEGOCIO.map((e) => ({ valor: e, rotulo: ROTULO_ETAPA[e] }))}
          selecionados={etapas}
          aoAlternar={(v) => setEtapas((atual) => alternar(atual, v as EtapaNegocio))}
        />

        <p className="mt-4 text-sm font-medium text-foreground">Temperatura do lead</p>
        <PilulasCategoria
          className="mt-2"
          tamanho="sm"
          aria="Filtrar por temperatura"
          opcoes={TEMPERATURAS.map((t) => ({ valor: t, rotulo: ROTULO_TEMPERATURA[t] }))}
          selecionados={temperaturas}
          aoAlternar={(v) => setTemperaturas((atual) => alternar(atual, v as Temperatura))}
        />

        <p className="mt-4 text-sm font-medium text-foreground">Tags</p>
        {tagsDisponiveis.length === 0 ? (
          <p className="mt-2 text-xs text-subtle">
            Nenhuma tag cadastrada nos contatos ainda.
          </p>
        ) : (
          <PilulasCategoria
            className="mt-2"
            tamanho="sm"
            aria="Filtrar por tag"
            opcoes={tagsDisponiveis.map((t) => ({ valor: t, rotulo: t }))}
            selecionados={tags}
            aoAlternar={(v) => setTags((atual) => alternar(atual, v))}
          />
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-5">
          <Botao variante="secundario" onClick={preverAlcance} disabled={prevendo}>
            <Target className="h-4 w-4" aria-hidden />
            {prevendo ? "Calculando…" : "Prever alcance"}
          </Botao>
          {previsao && (
            <p className="text-sm font-medium text-foreground" role="status">
              {previsao.alvo} {plural(previsao.alvo, "contato alvo", "contatos alvo")} ·{" "}
              {previsao.excluidos.semConsentimento}{" "}
              {plural(previsao.excluidos.semConsentimento, "excluído", "excluídos")} sem
              consentimento · {previsao.excluidos.semTelefone} sem telefone
            </p>
          )}
        </div>
      </section>

      {erro && (
        <p className="text-sm font-medium text-brand-strong" role="status">
          {erro}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Botao
          type="submit"
          disabled={salvando || nome.trim() === "" || mensagem.trim() === ""}
        >
          {salvando ? "Salvando…" : "Salvar rascunho"}
        </Botao>
        <Botao
          variante="fantasma"
          onClick={() => router.push("/corretor/crm/campanhas")}
        >
          Cancelar
        </Botao>
        <p className="text-xs text-subtle">
          O disparo acontece na página da campanha, com confirmação do alcance.
        </p>
      </div>
    </form>
  );
}
