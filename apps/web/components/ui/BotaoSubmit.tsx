"use client";

// BOTÃO DE SUBMIT com estado de envio — camada client fina sobre o Botao puro.
// Usa useFormStatus (react-dom) para, durante o submit de um <form action={…}>,
// desabilitar o botão (evita duplo submit) e trocar o rótulo por
// `rotuloPendente` (ex.: "Entrando…"). Reutilizável em qualquer form de
// server action do app. Deve ser filho direto (ou descendente) do <form>.

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Botao } from "./Botao";

type Props = Omit<ComponentProps<typeof Botao>, "type"> & {
  /** Rótulo exibido enquanto o form está sendo enviado. */
  rotuloPendente: string;
};

export function BotaoSubmit({ rotuloPendente, children, disabled, ...props }: Props) {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" disabled={pending || disabled} {...props}>
      {pending ? rotuloPendente : children}
    </Botao>
  );
}
