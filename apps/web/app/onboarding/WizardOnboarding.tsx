"use client";

// WIZARD DE ONBOARDING DO CORRETOR (client). 4 etapas com barra de progresso,
// validação por etapa (não avança com obrigatório inválido), máscaras visuais
// (CPF, telefone, R$) e revisão final embutida na etapa 4 — o CPF aparece
// SEMPRE mascarado (***.***.789-09) na revisão. Ao concluir, chama a Server
// Action concluirOnboardingAction e navega para /corretor?bemvindo=1.
//
// Estado 100% local (sem libs novas). Dinheiro digitado vira CENTAVOS.
// Paleta QUENTE ImobIA. pt-BR.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Briefcase,
  TrendingUp,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { formatarReais, validarCpf } from "@imobia/core";
import { Botao } from "@/components/ui/Botao";
import { Campo, CampoTextarea, GrupoCampo } from "@/components/ui/Campo";
import { concluirOnboardingAction } from "@/lib/dados/onboarding";

// —— Máscaras visuais (estado guarda SÓ dígitos; a view formata) ——————————————

/** Dígitos → "000.000.000-00" progressivo enquanto digita. */
function mascaraCpf(d: string): string {
  const p = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9), d.slice(9, 11)];
  let out = p[0];
  if (p[1]) out += `.${p[1]}`;
  if (p[2]) out += `.${p[2]}`;
  if (p[3]) out += `-${p[3]}`;
  return out;
}

/** Dígitos → "(11) 99999-0000" progressivo (10-11 dígitos BR). */
function mascaraTelefone(d: string): string {
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  const corpo = d.slice(2);
  const corte = corpo.length > 8 ? 5 : 4;
  if (corpo.length <= corte) return `(${d.slice(0, 2)}) ${corpo}`;
  return `(${d.slice(0, 2)}) ${corpo.slice(0, corte)}-${corpo.slice(corte)}`;
}

/** CPF (11 dígitos) → "***.***.789-09" para a revisão (nunca o CPF inteiro). */
function cpfMascarado(d: string): string {
  return d.length === 11 ? `***.***.${d.slice(6, 9)}-${d.slice(9)}` : "***.***.***-**";
}

function soDigitos(v: string): string {
  return v.replace(/\D/g, "");
}

function urlValida(v: string): boolean {
  try {
    new URL(v);
    return true;
  } catch {
    return false;
  }
}

/** Iniciais (até 2) — espelha o fallback do avatar da vitrine. */
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  return [partes[0], partes[partes.length - 1]]
    .map((p) => p.charAt(0).toUpperCase())
    .join("")
    .slice(0, 2);
}

// —— Etapas ———————————————————————————————————————————————————————————————————

const ETAPAS = [
  { titulo: "Sobre você", icone: User },
  { titulo: "Vida profissional", icone: Briefcase },
  { titulo: "Sua experiência", icone: TrendingUp },
  { titulo: "Foto & permissões", icone: Camera },
] as const;

type Valores = {
  nome: string;
  /** Só dígitos (11). */
  cpf: string;
  creci: string;
  cidade: string;
  /** Só dígitos (10-11) ou "". */
  telefone: string;
  /** CENTAVOS como string de dígitos ("" = não informado). */
  vendasValorCentavos: string;
  vendasQtd: string;
  bio: string;
  fotoUrl: string;
  instagram: string;
  permitirFoto: boolean;
};

export function WizardOnboarding({
  nomeInicial,
  email,
  creciInicial,
}: {
  nomeInicial: string;
  email: string;
  creciInicial: string;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [etapa, setEtapa] = useState(0);
  const [maxVisitada, setMaxVisitada] = useState(0);
  const [tentouAvancar, setTentouAvancar] = useState(false);
  const [cpfTocado, setCpfTocado] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);

  const [v, setV] = useState<Valores>({
    nome: nomeInicial,
    cpf: "",
    creci: creciInicial,
    cidade: "",
    telefone: "",
    vendasValorCentavos: "",
    vendasQtd: "",
    bio: "",
    fotoUrl: "",
    instagram: "",
    permitirFoto: false,
  });

  function definir<K extends keyof Valores>(chave: K, valor: Valores[K]) {
    setV((atual) => ({ ...atual, [chave]: valor }));
  }

  // — Validação por etapa —
  const cpfValido = validarCpf(v.cpf);
  const telefoneValido =
    v.telefone === "" || (v.telefone.length >= 10 && v.telefone.length <= 11);
  const fotoValida = v.fotoUrl.trim() === "" || urlValida(v.fotoUrl.trim());

  function etapaValida(i: number): boolean {
    if (i === 0) return v.nome.trim().length >= 3 && cpfValido;
    if (i === 1)
      return v.creci.trim().length >= 2 && v.cidade.trim().length >= 2 && telefoneValido;
    if (i === 2) return true; // tudo opcional
    return fotoValida;
  }

  function avancar() {
    if (!etapaValida(etapa)) {
      setTentouAvancar(true);
      return;
    }
    setTentouAvancar(false);
    const proxima = Math.min(etapa + 1, ETAPAS.length - 1);
    setEtapa(proxima);
    setMaxVisitada((m) => Math.max(m, proxima));
  }

  function voltar() {
    setTentouAvancar(false);
    setEtapa((e) => Math.max(0, e - 1));
  }

  function irPara(i: number) {
    if (i <= maxVisitada) {
      setTentouAvancar(false);
      setEtapa(i);
    }
  }

  function concluir() {
    if (!etapaValida(3)) {
      setTentouAvancar(true);
      return;
    }
    setErroEnvio(null);
    iniciar(async () => {
      const r = await concluirOnboardingAction({
        nome: v.nome.trim(),
        cpf: v.cpf,
        creci: v.creci.trim(),
        cidade: v.cidade.trim(),
        telefone: v.telefone || undefined,
        vendasPreviasValor: v.vendasValorCentavos
          ? Number(v.vendasValorCentavos)
          : undefined,
        vendasPreviasQtd: v.vendasQtd ? Number(v.vendasQtd) : undefined,
        bio: v.bio.trim() || undefined,
        instagram: v.instagram.trim() || undefined,
        fotoUrl: v.fotoUrl.trim(),
        permitirFoto: v.permitirFoto,
      });
      if (!r.ok) {
        setErroEnvio(r.erro);
        return;
      }
      router.push("/corretor?bemvindo=1");
    });
  }

  const progresso = ((etapa + 1) / ETAPAS.length) * 100;
  const fotoPreview = v.fotoUrl.trim() && urlValida(v.fotoUrl.trim()) ? v.fotoUrl.trim() : null;

  return (
    <main className="w-full max-w-2xl">
      {/* Cabeçalho / wordmark */}
      <header className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-strong">
          Imob<span className="text-gold-strong">IA</span>
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
          Bem-vindo(a) ao ImobIA
        </h1>
        <p className="mt-2 text-sm text-muted">
          Vamos montar sua vitrine de corretor em 4 passos rápidos.
        </p>
      </header>

      {/* Barra de progresso + steps clicáveis (já visitados) */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-strong tabular-nums">
            Etapa {etapa + 1} de {ETAPAS.length}
          </p>
          <p className="text-xs text-subtle">{ETAPAS[etapa].titulo}</p>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-strong">
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-300"
            style={{ width: `${progresso}%` }}
          />
        </div>
        <ol className="mt-4 grid grid-cols-4 gap-2">
          {ETAPAS.map((e, i) => {
            const Icone = e.icone;
            const atual = i === etapa;
            const visitada = i <= maxVisitada;
            return (
              <li key={e.titulo}>
                <button
                  type="button"
                  onClick={() => irPara(i)}
                  disabled={!visitada}
                  aria-current={atual ? "step" : undefined}
                  className={`flex w-full flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 text-center transition-colors ${
                    atual
                      ? "border-brand/40 bg-brand-soft text-brand-strong"
                      : visitada
                        ? "border-border bg-surface-card text-muted hover:border-brand/40 hover:text-brand-strong"
                        : "cursor-not-allowed border-border bg-surface text-subtle opacity-60"
                  }`}
                >
                  <Icone className="h-4 w-4" aria-hidden />
                  <span className="text-[0.65rem] font-semibold leading-tight">
                    {e.titulo}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Card da etapa */}
      <section className="mt-6 rounded-3xl border border-border bg-surface-card p-6 shadow-[var(--shadow-card)] sm:p-8">
        {etapa === 0 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-foreground">Sobre você</h2>
            <GrupoCampo
              rotulo="Nome completo"
              obrigatorio
              htmlFor="onb-nome"
              erro={
                tentouAvancar && v.nome.trim().length < 3
                  ? "Informe seu nome completo."
                  : undefined
              }
            >
              <Campo
                id="onb-nome"
                value={v.nome}
                onChange={(e) => definir("nome", e.target.value)}
                placeholder="Maria da Silva"
                autoComplete="name"
              />
            </GrupoCampo>

            <GrupoCampo
              rotulo="E-mail"
              htmlFor="onb-email"
              auxilio="Vem da sua conta — não dá para alterar aqui."
            >
              <Campo id="onb-email" value={email} readOnly disabled />
            </GrupoCampo>

            <GrupoCampo
              rotulo="CPF"
              obrigatorio
              htmlFor="onb-cpf"
              auxilio="Usado apenas para o seu cadastro — nunca aparece no seu perfil."
              erro={
                (cpfTocado || tentouAvancar) && v.cpf !== "" && !cpfValido
                  ? "CPF inválido — confira os dígitos."
                  : tentouAvancar && v.cpf === ""
                    ? "Informe seu CPF."
                    : undefined
              }
            >
              <Campo
                id="onb-cpf"
                value={mascaraCpf(v.cpf)}
                onChange={(e) => definir("cpf", soDigitos(e.target.value).slice(0, 11))}
                onBlur={() => setCpfTocado(true)}
                placeholder="000.000.000-00"
                inputMode="numeric"
                className={
                  (cpfTocado || tentouAvancar) && v.cpf !== "" && !cpfValido
                    ? "border-brand focus:ring-brand/25"
                    : ""
                }
              />
            </GrupoCampo>
          </div>
        )}

        {etapa === 1 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-foreground">Vida profissional</h2>
            <GrupoCampo
              rotulo="CRECI"
              obrigatorio
              htmlFor="onb-creci"
              erro={
                tentouAvancar && v.creci.trim().length < 2
                  ? "Informe seu CRECI."
                  : undefined
              }
            >
              <Campo
                id="onb-creci"
                value={v.creci}
                onChange={(e) => definir("creci", e.target.value)}
                placeholder="SP-123456"
              />
            </GrupoCampo>

            <GrupoCampo
              rotulo="Cidade de atuação"
              obrigatorio
              htmlFor="onb-cidade"
              erro={
                tentouAvancar && v.cidade.trim().length < 2
                  ? "Informe sua cidade."
                  : undefined
              }
            >
              <Campo
                id="onb-cidade"
                value={v.cidade}
                onChange={(e) => definir("cidade", e.target.value)}
                placeholder="São Paulo"
              />
            </GrupoCampo>

            <GrupoCampo
              rotulo="Telefone / WhatsApp"
              htmlFor="onb-telefone"
              auxilio="Opcional — vira botão de contato na sua vitrine."
              erro={
                tentouAvancar && !telefoneValido
                  ? "Telefone deve ter 10 ou 11 dígitos (com DDD)."
                  : undefined
              }
            >
              <Campo
                id="onb-telefone"
                value={mascaraTelefone(v.telefone)}
                onChange={(e) =>
                  definir("telefone", soDigitos(e.target.value).slice(0, 11))
                }
                placeholder="(11) 99999-0000"
                inputMode="tel"
              />
            </GrupoCampo>
          </div>
        )}

        {etapa === 2 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-foreground">Sua experiência</h2>
            <p className="-mt-2 text-sm text-muted">
              Tudo opcional — esses números aparecem como “declarados” na sua
              vitrine, separados dos resultados na plataforma.
            </p>

            <GrupoCampo
              rotulo="Valor total já vendido na carreira"
              htmlFor="onb-vendas-valor"
              auxilio="Estimativa em reais do que você já vendeu como corretor(a)."
            >
              <Campo
                id="onb-vendas-valor"
                value={
                  v.vendasValorCentavos
                    ? formatarReais(Number(v.vendasValorCentavos))
                    : ""
                }
                onChange={(e) =>
                  definir(
                    "vendasValorCentavos",
                    soDigitos(e.target.value).replace(/^0+(?=\d)/, "").slice(0, 15),
                  )
                }
                placeholder="R$ 0,00"
                inputMode="numeric"
              />
            </GrupoCampo>

            <GrupoCampo
              rotulo="Quantidade de vendas"
              htmlFor="onb-vendas-qtd"
              auxilio="Quantos imóveis você já vendeu, aproximadamente."
            >
              <Campo
                id="onb-vendas-qtd"
                value={v.vendasQtd}
                onChange={(e) =>
                  definir("vendasQtd", soDigitos(e.target.value).slice(0, 6))
                }
                placeholder="0"
                inputMode="numeric"
              />
            </GrupoCampo>

            <GrupoCampo
              rotulo="Bio curta"
              htmlFor="onb-bio"
              auxilio={
                <span className="tabular-nums">
                  {v.bio.length}/400 — uma apresentação breve para clientes e colegas.
                </span>
              }
            >
              <CampoTextarea
                id="onb-bio"
                value={v.bio}
                onChange={(e) => definir("bio", e.target.value.slice(0, 400))}
                maxLength={400}
                placeholder="Especialista em imóveis residenciais na zona oeste..."
              />
            </GrupoCampo>
          </div>
        )}

        {etapa === 3 && (
          <div className="flex flex-col gap-5">
            <h2 className="text-lg font-semibold text-foreground">Foto & permissões</h2>

            <div className="flex items-start gap-4">
              {/* Preview circular (foto ao digitar URL válida; senão iniciais) */}
              {fotoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={fotoPreview}
                  alt="Prévia da sua foto"
                  className="h-20 w-20 shrink-0 rounded-full border-4 border-surface object-cover shadow-[var(--shadow-soft)]"
                />
              ) : (
                <div
                  className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-4 border-surface bg-brand text-xl font-semibold text-brand-contrast shadow-[var(--shadow-soft)]"
                  aria-hidden
                >
                  {iniciais(v.nome)}
                </div>
              )}
              <div className="flex-1">
                <GrupoCampo
                  rotulo="Foto de perfil (URL)"
                  htmlFor="onb-foto"
                  auxilio="Link de uma imagem quadrada sua."
                  erro={
                    tentouAvancar && !fotoValida
                      ? "Informe uma URL válida (https://...) ou deixe em branco."
                      : undefined
                  }
                >
                  <Campo
                    id="onb-foto"
                    value={v.fotoUrl}
                    onChange={(e) => definir("fotoUrl", e.target.value)}
                    placeholder="https://..."
                    inputMode="url"
                  />
                </GrupoCampo>
              </div>
            </div>

            <GrupoCampo rotulo="Instagram" htmlFor="onb-instagram">
              <Campo
                id="onb-instagram"
                value={v.instagram}
                onChange={(e) => definir("instagram", e.target.value)}
                placeholder="@seu.perfil"
              />
            </GrupoCampo>

            {/* Consentimento destacado */}
            <label
              htmlFor="onb-permitir-foto"
              className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors ${
                v.permitirFoto
                  ? "border-gold/40 bg-gold-soft"
                  : "border-border-strong bg-surface"
              }`}
            >
              <input
                id="onb-permitir-foto"
                type="checkbox"
                checked={v.permitirFoto}
                onChange={(e) => definir("permitirFoto", e.target.checked)}
                className="mt-0.5 h-4.5 w-4.5 shrink-0 accent-[var(--color-brand)]"
              />
              <span>
                <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <ShieldCheck className="h-4 w-4 text-gold-strong" aria-hidden />
                  Autorizo a exibição da minha foto no meu perfil e na comunidade
                  ImobIA
                </span>
                <span className="mt-1 block text-xs text-muted">
                  {v.permitirFoto
                    ? "Sua foto aparecerá na vitrine e nas suas publicações."
                    : "Sem problema! Enquanto não autorizar, seu avatar mostrará suas iniciais."}
                </span>
              </span>
            </label>

            {/* Revisão final */}
            <div className="rounded-2xl border border-brand/30 bg-brand-soft p-4">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-brand-strong">
                <Sparkles className="h-4 w-4" aria-hidden />
                Revise antes de concluir
              </p>
              <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                <LinhaRevisao rotulo="Nome" valor={v.nome.trim() || "—"} />
                <LinhaRevisao rotulo="CPF" valor={cpfMascarado(v.cpf)} />
                <LinhaRevisao rotulo="E-mail" valor={email || "—"} />
                <LinhaRevisao rotulo="CRECI" valor={v.creci.trim() || "—"} />
                <LinhaRevisao rotulo="Cidade" valor={v.cidade.trim() || "—"} />
                <LinhaRevisao
                  rotulo="Telefone"
                  valor={v.telefone ? mascaraTelefone(v.telefone) : "—"}
                />
                <LinhaRevisao
                  rotulo="Vendas na carreira"
                  valor={
                    v.vendasValorCentavos || v.vendasQtd
                      ? [
                          v.vendasValorCentavos
                            ? formatarReais(Number(v.vendasValorCentavos))
                            : null,
                          v.vendasQtd ? `${v.vendasQtd} venda(s)` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")
                      : "—"
                  }
                />
                <LinhaRevisao
                  rotulo="Foto na comunidade"
                  valor={v.permitirFoto ? "Autorizada" : "Iniciais no avatar"}
                />
              </dl>
            </div>

            {erroEnvio && (
              <p className="rounded-xl border border-brand/40 bg-brand-soft px-4 py-2.5 text-sm font-medium text-brand-strong">
                {erroEnvio}
              </p>
            )}
          </div>
        )}

        {/* Navegação */}
        <div className="mt-8 flex items-center justify-between gap-3">
          {etapa > 0 ? (
            <Botao variante="secundario" onClick={voltar} disabled={pendente} className="gap-1.5">
              <ChevronLeft className="h-4 w-4" aria-hidden />
              Voltar
            </Botao>
          ) : (
            <span />
          )}

          {etapa < ETAPAS.length - 1 ? (
            <Botao onClick={avancar} className="gap-1.5">
              Continuar
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Botao>
          ) : (
            <Botao onClick={concluir} disabled={pendente} variante="premium" className="gap-1.5">
              <Check className="h-4 w-4" aria-hidden />
              {pendente ? "Salvando..." : "Concluir cadastro"}
            </Botao>
          )}
        </div>
      </section>
    </main>
  );
}

function LinhaRevisao({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 sm:justify-start">
      <dt className="text-xs font-medium uppercase tracking-[0.06em] text-brand-strong/70">
        {rotulo}
      </dt>
      <dd className="truncate font-medium text-foreground">{valor}</dd>
    </div>
  );
}
