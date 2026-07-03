"use client";

// Formulário compacto de NOVO COMPROMISSO da agenda (título, tipo, data, hora,
// local) — fina camada client sobre a action criarEvento (acoes.ts). Data/hora
// digitadas são PAREDE de São Paulo: o início vira um instante real com o
// offset de America/Sao_Paulo (lib/fuso.ts — mesma convenção do motor do
// assistente e da formatação em formato.ts). Após criar, router.refresh()
// re-renderiza o Server Component da agenda. pt-BR.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, X } from "lucide-react";
import { tiposEventoAgenda, type TipoEventoAgenda } from "@imobia/domain";
import { Botao } from "@/components/ui/Botao";
import { Campo, CampoSelect, GrupoCampo } from "@/components/ui/Campo";
import { instanteDeParedeSaoPaulo } from "@/lib/fuso";
import { criarEvento } from "./acoes";
import { ROTULOS_TIPO_EVENTO } from "./formato";

export function NovoEvento({ hojeISO }: { hojeISO: string }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<TipoEventoAgenda>("compromisso");
  const [data, setData] = useState(hojeISO);
  const [hora, setHora] = useState("09:00");
  const [local, setLocal] = useState("");

  function limpar() {
    setTitulo("");
    setTipo("compromisso");
    setData(hojeISO);
    setHora("09:00");
    setLocal("");
    setErro(null);
  }

  function salvar() {
    if (titulo.trim() === "" || data === "" || hora === "") {
      return;
    }
    setErro(null);
    iniciar(async () => {
      const resultado = await criarEvento({
        titulo: titulo.trim(),
        tipo,
        inicio: instanteDeParedeSaoPaulo(data, hora),
        ...(local.trim() !== "" ? { local: local.trim() } : {}),
      });
      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }
      limpar();
      setAberto(false);
      router.refresh();
    });
  }

  if (!aberto) {
    return (
      <Botao variante="primario" onClick={() => setAberto(true)}>
        <CalendarPlus className="h-4 w-4" aria-hidden />
        Novo compromisso
      </Botao>
    );
  }

  return (
    <div className="mt-2 w-full rounded-2xl border border-brand/30 bg-surface-card p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">Novo compromisso</h2>
        <button
          type="button"
          onClick={() => setAberto(false)}
          aria-label="Fechar formulário de novo compromisso"
          className="rounded-full p-1.5 text-subtle transition-colors hover:bg-surface hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <GrupoCampo rotulo="Título" htmlFor="evento-titulo" obrigatorio className="sm:col-span-2">
          <Campo
            id="evento-titulo"
            value={titulo}
            disabled={pendente}
            placeholder="Ex.: visita ao apartamento da Rua Augusta"
            onChange={(e) => setTitulo(e.target.value)}
          />
        </GrupoCampo>
        <GrupoCampo rotulo="Tipo" htmlFor="evento-tipo">
          <CampoSelect
            id="evento-tipo"
            value={tipo}
            disabled={pendente}
            onChange={(e) => setTipo(e.target.value as TipoEventoAgenda)}
          >
            {tiposEventoAgenda.map((t) => (
              <option key={t} value={t}>
                {ROTULOS_TIPO_EVENTO[t]}
              </option>
            ))}
          </CampoSelect>
        </GrupoCampo>
        <GrupoCampo rotulo="Local" htmlFor="evento-local">
          <Campo
            id="evento-local"
            value={local}
            disabled={pendente}
            placeholder="Opcional"
            onChange={(e) => setLocal(e.target.value)}
          />
        </GrupoCampo>
        <GrupoCampo rotulo="Data" htmlFor="evento-data" obrigatorio>
          <Campo
            id="evento-data"
            type="date"
            value={data}
            disabled={pendente}
            onChange={(e) => setData(e.target.value)}
          />
        </GrupoCampo>
        <GrupoCampo rotulo="Hora" htmlFor="evento-hora" obrigatorio>
          <Campo
            id="evento-hora"
            type="time"
            value={hora}
            disabled={pendente}
            onChange={(e) => setHora(e.target.value)}
          />
        </GrupoCampo>
      </div>

      {erro && <p className="mt-3 text-xs text-brand-strong">{erro}</p>}

      <div className="mt-4 flex items-center gap-2">
        <Botao
          variante="primario"
          disabled={pendente || titulo.trim() === "" || data === "" || hora === ""}
          onClick={salvar}
        >
          {pendente ? "Salvando…" : "Salvar compromisso"}
        </Botao>
        <Botao variante="fantasma" disabled={pendente} onClick={() => setAberto(false)}>
          Cancelar
        </Botao>
      </div>
    </div>
  );
}
