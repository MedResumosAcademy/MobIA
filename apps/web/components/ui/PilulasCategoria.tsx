// PilulasCategoria — chips selecionáveis estilo Airbnb (paleta QUENTE).
// Componente PURO e AGNÓSTICO de estado: recebe as opções, o(s) valor(es)
// selecionado(s) e um callback. Não conhece URL nem router — as telas de
// filtro (catálogo, painel do corretor) ligam isso a searchParams/router,
// mantendo o componente reutilizável e testável.
//
// Suporta seleção única (string) ou múltipla (string[]). Renderiza <button>
// acessíveis com aria-pressed; foco herda o ring laranja global.
//
// Uso (single):
//   <PilulasCategoria opcoes={cats} selecionado={cat} aoSelecionar={setCat} />
// Uso (múltipla):
//   <PilulasCategoria opcoes={cats} selecionados={sel} aoAlternar={toggle} />
//
// Para renderizar como links (URL-driven puro, sem JS), passe `hrefDe` —
// cada pílula vira um <a> cujo href é derivado do valor.

import type { ReactNode } from "react";

export type OpcaoPilula = {
  valor: string;
  rotulo: ReactNode;
  /** Ícone opcional (ex.: lucide) à esquerda do rótulo. */
  icone?: ReactNode;
};

type BaseProps = {
  opcoes: OpcaoPilula[];
  /** Tamanho visual das pílulas. */
  tamanho?: "sm" | "md";
  /** Rótulo acessível do grupo (aria-label do container). */
  aria?: string;
  className?: string;
};

// Modo single-select controlado.
type PropsSingle = BaseProps & {
  selecionado?: string | null;
  aoSelecionar?: (valor: string) => void;
  selecionados?: never;
  aoAlternar?: never;
  hrefDe?: never;
};

// Modo multi-select controlado.
type PropsMulti = BaseProps & {
  selecionados?: string[];
  aoAlternar?: (valor: string) => void;
  selecionado?: never;
  aoSelecionar?: never;
  hrefDe?: never;
};

// Modo link (URL-driven, sem estado interno) — cada pílula é um <a>.
type PropsLink = BaseProps & {
  hrefDe: (valor: string) => string;
  /** Valores atualmente ativos (para pintar o estado selecionado). */
  ativos?: string[];
  selecionado?: never;
  aoSelecionar?: never;
  selecionados?: never;
  aoAlternar?: never;
};

type Props = PropsSingle | PropsMulti | PropsLink;

const TAMANHOS = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
} as const;

const BASE_PILULA =
  "inline-flex items-center gap-1.5 rounded-full font-medium transition-[background-color,border-color,color,box-shadow] duration-200 focus-visible:outline-none";
const NAO_SELECIONADA =
  "border border-border-strong bg-surface-card text-muted hover:border-brand/50 hover:text-foreground";
const SELECIONADA =
  "border border-brand bg-brand-soft text-brand-strong shadow-[var(--shadow-soft)]";

export function PilulasCategoria(props: Props) {
  const { opcoes, tamanho = "md", aria, className = "" } = props;

  function estaAtiva(valor: string): boolean {
    if ("hrefDe" in props && props.hrefDe) return props.ativos?.includes(valor) ?? false;
    if ("selecionados" in props && props.selecionados)
      return props.selecionados.includes(valor);
    if ("selecionado" in props) return props.selecionado === valor;
    return false;
  }

  const classesPilula = (ativa: boolean, extra = "") =>
    `${BASE_PILULA} ${TAMANHOS[tamanho]} ${ativa ? SELECIONADA : NAO_SELECIONADA} ${extra}`.trim();

  return (
    <div
      className={`flex flex-wrap gap-2 ${className}`}
      role="group"
      aria-label={aria}
    >
      {opcoes.map((op) => {
        const ativa = estaAtiva(op.valor);
        const conteudo = (
          <>
            {op.icone}
            <span>{op.rotulo}</span>
          </>
        );

        // Modo link (URL-driven puro).
        if ("hrefDe" in props && props.hrefDe) {
          return (
            <a
              key={op.valor}
              href={props.hrefDe(op.valor)}
              aria-pressed={ativa}
              className={classesPilula(ativa)}
            >
              {conteudo}
            </a>
          );
        }

        // Modos controlados (single / multi).
        const aoClicar = () => {
          if ("aoAlternar" in props && props.aoAlternar) props.aoAlternar(op.valor);
          else if ("aoSelecionar" in props && props.aoSelecionar)
            props.aoSelecionar(op.valor);
        };

        return (
          <button
            key={op.valor}
            type="button"
            aria-pressed={ativa}
            onClick={aoClicar}
            className={classesPilula(ativa)}
          >
            {conteudo}
          </button>
        );
      })}
    </div>
  );
}
