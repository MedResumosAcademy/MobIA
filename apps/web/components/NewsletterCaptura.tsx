"use client";

// Captura pública de e-mail para a newsletter (ESCOPO §V2, item 16).
// LGPD: o checkbox de consentimento é OBRIGATÓRIO (schema exige literal true).
// Duas apresentações:
//   compacto  → coluna "Novidades" do rodapé (só e-mail + consentimento)
//   completo  → bloco de destaque na landing (nome opcional + e-mail)
// Estados: sucesso ("Você está dentro! 📬"), já-inscrito (idempotente) e erro.

import { useState, useTransition } from "react";
import { CheckCircle2, Mail } from "lucide-react";
import { Botao } from "@/components/ui/Botao";
import { Campo } from "@/components/ui/Campo";
import { inscreverNewsletterAction } from "@/lib/dados/newsletter";

type Estado = "inicial" | "sucesso" | "jaInscrito" | "erro";

export function NewsletterCaptura({ compacto = false }: { compacto?: boolean }) {
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [consentiu, setConsentiu] = useState(false);
  const [estado, setEstado] = useState<Estado>("inicial");
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!consentiu) {
      return;
    }
    setMensagemErro(null);
    iniciar(async () => {
      const resultado = await inscreverNewsletterAction({
        email,
        nome: nome.trim() === "" ? undefined : nome,
        consentimento: true,
      });
      if (resultado.ok) {
        setEstado(resultado.jaInscrito ? "jaInscrito" : "sucesso");
      } else {
        setEstado("erro");
        setMensagemErro(resultado.erro);
      }
    });
  }

  if (estado === "sucesso" || estado === "jaInscrito") {
    return (
      <div
        className={`flex items-start gap-2 rounded-xl border border-brand/30 bg-brand-soft p-4 ${
          compacto ? "text-sm" : ""
        }`}
        role="status"
      >
        <CheckCircle2
          size={compacto ? 18 : 22}
          strokeWidth={2}
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-brand-strong"
        />
        <div>
          <p className="font-semibold text-brand-strong">
            {estado === "sucesso" ? "Você está dentro! 📬" : "Você já está inscrito 📬"}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {estado === "sucesso"
              ? "As melhores oportunidades vão chegar no seu e-mail."
              : "Este e-mail já recebe as nossas novidades — tudo certo."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-3">
      {!compacto && (
        <Campo
          type="text"
          name="nome"
          autoComplete="name"
          placeholder="Seu nome (opcional)"
          maxLength={120}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          disabled={pendente}
        />
      )}
      <div className={compacto ? "flex flex-col gap-2" : "flex flex-col gap-3 sm:flex-row"}>
        <div className="relative flex-1">
          <Mail
            size={16}
            strokeWidth={2}
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-brand"
          />
          <Campo
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="seu@email.com"
            className="pl-9"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pendente}
            aria-label="Seu e-mail para receber a newsletter"
          />
        </div>
        <Botao
          type="submit"
          variante="primario"
          tamanho={compacto ? "sm" : "md"}
          disabled={pendente || !consentiu}
          className={compacto ? "w-full" : "shrink-0"}
        >
          {pendente ? "Inscrevendo…" : "Quero receber"}
        </Botao>
      </div>

      <label className="flex items-start gap-2 text-xs leading-5 text-muted">
        <input
          type="checkbox"
          required
          checked={consentiu}
          onChange={(e) => setConsentiu(e.target.checked)}
          disabled={pendente}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-border-strong accent-[#DB6414]"
        />
        <span>
          Aceito receber novidades e oportunidades da ImobIA por e-mail (LGPD —
          você pode cancelar quando quiser).
        </span>
      </label>

      {estado === "erro" && mensagemErro && (
        <p className="text-xs text-brand-strong" role="alert">
          {mensagemErro}
        </p>
      )}
    </form>
  );
}
