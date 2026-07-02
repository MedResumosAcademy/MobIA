"use client";

// Bloco client TOGGLÁVEL de edição do próprio perfil. Fina camada sobre a Server
// Action atualizarMeuPerfil (lib/dados/perfil.ts): valida no server via
// perfilPublicoCamposSchema e grava SÓ as colunas públicas. Após salvar,
// router.refresh() re-renderiza o Server Component pai com os novos dados.
//
// Só aparece no PRÓPRIO perfil (a página só o monta quando ehProprio). Campos:
// bio, telefone, cidade, instagram, foto_url, capa_url. Paleta QUENTE ImobIA.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X, Check } from "lucide-react";
import { Botao } from "@/components/ui/Botao";
import { GrupoCampo, Campo, CampoTextarea } from "@/components/ui/Campo";
import { atualizarMeuPerfil } from "@/lib/dados/perfil";

type Valores = {
  bio: string;
  telefone: string;
  cidade: string;
  instagram: string;
  fotoUrl: string;
  capaUrl: string;
};

type Props = {
  inicial: {
    bio: string | null;
    telefone: string | null;
    cidade: string | null;
    instagram: string | null;
    fotoUrl: string | null;
    capaUrl: string | null;
  };
};

export function EditarPerfil({ inicial }: Props) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const [valores, setValores] = useState<Valores>({
    bio: inicial.bio ?? "",
    telefone: inicial.telefone ?? "",
    cidade: inicial.cidade ?? "",
    instagram: inicial.instagram ?? "",
    fotoUrl: inicial.fotoUrl ?? "",
    capaUrl: inicial.capaUrl ?? "",
  });

  function definir<K extends keyof Valores>(chave: K, valor: string) {
    setValores((v) => ({ ...v, [chave]: valor }));
  }

  function salvar() {
    setErro(null);
    iniciar(async () => {
      // Envia strings vazias como campo omitido não faz sentido aqui: o schema
      // aceita string; limpar um campo grava vazio. Enviamos tudo.
      const r = await atualizarMeuPerfil({
        bio: valores.bio,
        telefone: valores.telefone,
        cidade: valores.cidade,
        instagram: valores.instagram,
        fotoUrl: valores.fotoUrl,
        capaUrl: valores.capaUrl,
      });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setAberto(false);
      router.refresh();
    });
  }

  if (!aberto) {
    return (
      <Botao
        variante="secundario"
        tamanho="sm"
        onClick={() => setAberto(true)}
        className="gap-1.5"
      >
        <Pencil className="h-4 w-4" aria-hidden />
        Editar perfil
      </Botao>
    );
  }

  return (
    <div className="mt-6 rounded-2xl border border-brand/30 bg-surface-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Editar perfil</h3>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="rounded-lg p-1 text-subtle transition-colors hover:bg-surface hover:text-foreground"
          aria-label="Fechar edição"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <GrupoCampo
          rotulo="Bio"
          htmlFor="perfil-bio"
          className="sm:col-span-2"
          auxilio="Uma breve apresentação para seus clientes."
        >
          <CampoTextarea
            id="perfil-bio"
            value={valores.bio}
            onChange={(e) => definir("bio", e.target.value)}
            placeholder="Especialista em imóveis de alto padrão..."
            maxLength={600}
          />
        </GrupoCampo>

        <GrupoCampo rotulo="Telefone / WhatsApp" htmlFor="perfil-telefone">
          <Campo
            id="perfil-telefone"
            value={valores.telefone}
            onChange={(e) => definir("telefone", e.target.value)}
            placeholder="5511999990000"
            inputMode="tel"
          />
        </GrupoCampo>

        <GrupoCampo rotulo="Cidade" htmlFor="perfil-cidade">
          <Campo
            id="perfil-cidade"
            value={valores.cidade}
            onChange={(e) => definir("cidade", e.target.value)}
            placeholder="São Paulo"
          />
        </GrupoCampo>

        <GrupoCampo rotulo="Instagram" htmlFor="perfil-instagram">
          <Campo
            id="perfil-instagram"
            value={valores.instagram}
            onChange={(e) => definir("instagram", e.target.value)}
            placeholder="@seu.perfil"
          />
        </GrupoCampo>

        <GrupoCampo
          rotulo="Foto (URL)"
          htmlFor="perfil-foto"
          auxilio="Link de uma imagem quadrada."
        >
          <Campo
            id="perfil-foto"
            value={valores.fotoUrl}
            onChange={(e) => definir("fotoUrl", e.target.value)}
            placeholder="https://..."
            inputMode="url"
          />
        </GrupoCampo>

        <GrupoCampo
          rotulo="Capa (URL)"
          htmlFor="perfil-capa"
          className="sm:col-span-2"
          auxilio="Banner do topo do perfil (opcional)."
        >
          <Campo
            id="perfil-capa"
            value={valores.capaUrl}
            onChange={(e) => definir("capaUrl", e.target.value)}
            placeholder="https://..."
            inputMode="url"
          />
        </GrupoCampo>
      </div>

      {erro && <p className="mt-4 text-sm text-brand-strong">{erro}</p>}

      <div className="mt-5 flex items-center gap-3">
        <Botao onClick={salvar} disabled={pendente} className="gap-1.5">
          <Check className="h-4 w-4" aria-hidden />
          {pendente ? "Salvando..." : "Salvar alterações"}
        </Botao>
        <Botao
          variante="fantasma"
          onClick={() => setAberto(false)}
          disabled={pendente}
        >
          Cancelar
        </Botao>
      </div>
    </div>
  );
}
