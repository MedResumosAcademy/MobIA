// Campos de formulário consistentes do kit ImobIA (paleta QUENTE).
// Componentes PUROS de apresentação: repassam todos os atributos nativos.
// Objetivo: inputs/selects/textarea com o MESMO acabamento (hairline, radii
// rounded-xl, foco laranja, estados hover) nas telas de busca, filtros,
// cadastro, painel do corretor — sem cada tela reinventar o estilo.
//
// Exporta:
//   classesCampo(extra?)  → string de classes base (para casos custom)
//   <Campo>               → <input> estilizado
//   <CampoSelect>         → <select> estilizado (com chevron)
//   <CampoTextarea>       → <textarea> estilizado
//   <Rotulo>              → <label> consistente (com marca de obrigatório)
//   <GrupoCampo>          → wrapper rótulo + campo + auxílio/erro

import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
} from "react";

// Base compartilhada: superfície branca, hairline, radii generoso, foco laranja.
// O anel de foco usa o token --focus-ring (laranja) para consistência a11y.
const BASE_CAMPO =
  "w-full rounded-xl border border-border-strong bg-surface-card px-3.5 py-2.5 text-sm text-foreground shadow-[var(--shadow-soft)] transition-[border-color,box-shadow] duration-200 placeholder:text-subtle hover:border-brand/40 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 disabled:cursor-not-allowed disabled:opacity-60";

/** String de classes do campo base — útil para casos que precisam de <input> custom. */
export function classesCampo(extra = ""): string {
  return `${BASE_CAMPO} ${extra}`.trim();
}

// —— Input ————————————————————————————————————————————————————————————————
type CampoProps = InputHTMLAttributes<HTMLInputElement> & { className?: string };

export function Campo({ className = "", ...props }: CampoProps) {
  return <input className={classesCampo(className)} {...props} />;
}

// —— Select ———————————————————————————————————————————————————————————————
// Chevron desenhado em CSS (SVG data-uri) para não depender de wrapper extra.
type CampoSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  className?: string;
};

const CHEVRON =
  "appearance-none bg-[length:1.1rem] bg-[right_0.85rem_center] bg-no-repeat pr-10 " +
  "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke%3D%22%238A857C%22%20stroke-width%3D%222%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20d%3D%22M6%209l6%206%206-6%22/%3E%3C/svg%3E')]";

export function CampoSelect({ className = "", ...props }: CampoSelectProps) {
  return <select className={classesCampo(`${CHEVRON} ${className}`)} {...props} />;
}

// —— Textarea —————————————————————————————————————————————————————————————
type CampoTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  className?: string;
};

export function CampoTextarea({ className = "", ...props }: CampoTextareaProps) {
  return <textarea className={classesCampo(`min-h-24 resize-y ${className}`)} {...props} />;
}

// —— Rótulo ———————————————————————————————————————————————————————————————
type RotuloProps = LabelHTMLAttributes<HTMLLabelElement> & {
  children: ReactNode;
  /** Marca visual de campo obrigatório (asterisco âmbar). */
  obrigatorio?: boolean;
};

export function Rotulo({
  children,
  obrigatorio = false,
  className = "",
  ...props
}: RotuloProps) {
  return (
    <label
      className={`block text-sm font-medium text-foreground ${className}`}
      {...props}
    >
      {children}
      {obrigatorio && (
        <span className="ml-0.5 text-gold-strong" aria-hidden="true">
          *
        </span>
      )}
    </label>
  );
}

// —— Grupo (rótulo + campo + auxílio/erro) ————————————————————————————————
// Conveniência para blocos de formulário verticais consistentes.
type GrupoCampoProps = {
  children: ReactNode;
  rotulo?: ReactNode;
  obrigatorio?: boolean;
  /** id do campo — liga o <label> via htmlFor. */
  htmlFor?: string;
  /** Texto de auxílio discreto abaixo do campo. */
  auxilio?: ReactNode;
  /** Mensagem de erro (substitui o auxílio quando presente). */
  erro?: ReactNode;
  className?: string;
};

export function GrupoCampo({
  children,
  rotulo,
  obrigatorio,
  htmlFor,
  auxilio,
  erro,
  className = "",
}: GrupoCampoProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {rotulo != null && (
        <Rotulo htmlFor={htmlFor} obrigatorio={obrigatorio}>
          {rotulo}
        </Rotulo>
      )}
      {children}
      {erro != null ? (
        <p className="text-xs text-brand-strong">{erro}</p>
      ) : auxilio != null ? (
        <p className="text-xs text-subtle">{auxilio}</p>
      ) : null}
    </div>
  );
}
