"use client";

// Wrapper de reveal-on-scroll: filhos entram com fade-up quando o bloco
// aparece na viewport (IntersectionObserver, uma vez só). SSR-safe: o HTML
// chega VISÍVEL e só é ocultado no mount — sem JS (ou com reduced-motion,
// ou já dentro da viewport) nada some. Delay escalonável via prop `atraso`.

import { useEffect, useRef, useState, type ReactNode } from "react";

interface RevelarAoRolarProps {
  children: ReactNode;
  /** Delay da transição em ms (para escalonar cards irmãos). */
  atraso?: number;
  className?: string;
}

export function RevelarAoRolar({
  children,
  atraso = 0,
  className,
}: RevelarAoRolarProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Só oculta DEPOIS de montar (nunca no HTML do servidor).
  const [oculto, setOculto] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el === null) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Já visível no primeiro paint? Não esconde (evita piscar acima da dobra).
    if (el.getBoundingClientRect().top < window.innerHeight * 0.85) return;

    setOculto(true);
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setOculto(false);
          observador.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none ${
        oculto ? "translate-y-4 opacity-0" : "translate-y-0 opacity-100"
      }${className !== undefined ? ` ${className}` : ""}`}
      style={atraso > 0 ? { transitionDelay: `${atraso}ms` } : undefined}
    >
      {children}
    </div>
  );
}
