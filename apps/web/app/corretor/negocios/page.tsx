// PIPELINE do funil de negócios (CRM) do corretor/gestor. Server Component que
// orquestra: parseia searchParams (vista + filtros + ordem), detecta papel
// (gestor/admin vê o filtro de responsável), busca os negócios já filtrados/
// escopados (listarNegocios — a RLS de 0011 impõe: corretor vê os seus,
// gestor/admin os da org) e delega a interatividade a componentes cliente:
//   - AlternarVista  (Kanban <-> Lista, ?vista=)
//   - FiltrosPipeline (etapa/origem/responsável/busca, URL-driven)
//   - KanbanNegocios  (board com arrastar-e-soltar + select acessível)
//   - ListaNegocios   (tabela ordenável por parado/valor)
// Os fechados (ganho/perdido) ficam numa seção à parte. PURA orquestração.

import type { Metadata } from "next";
import Link from "next/link";
import { Handshake, SearchX } from "lucide-react";
import { formatarReais } from "@imobia/core";
import { EstadoVazio } from "@/components/EstadoVazio";
import type { EtapaNegocio } from "@imobia/domain";
import {
  listarNegocios,
  listarOrigens,
  listarResponsaveisDaOrg,
  type NegocioResumo,
} from "@/lib/dados/negocios";
import type { CorretorOpcao } from "@/lib/dados/gestor";
import { obterPapelEOrg } from "@/lib/dados/gestor";
import { classesBotao } from "@/components/ui/Botao";
import { AlternarVista, type Vista } from "./AlternarVista";
import { FiltrosPipeline } from "./FiltrosPipeline";
import { KanbanNegocios } from "./KanbanNegocios";
import { ListaNegocios, type OrdemLista } from "./ListaNegocios";
import { ETAPAS_ORDEM, ROTULO_RESULTADO } from "./rotulos";

export const metadata: Metadata = { title: "Negócios" };
export const dynamic = "force-dynamic";

type Params = {
  vista?: string;
  etapa?: string;
  origem?: string;
  responsavel?: string;
  busca?: string;
  ordem?: string;
};

function normalizarVista(v: string | undefined): Vista {
  return v === "lista" ? "lista" : "kanban";
}

function normalizarOrdem(v: string | undefined): OrdemLista {
  return v === "valor" ? "valor" : "parado";
}

function normalizarEtapa(v: string | undefined): EtapaNegocio | undefined {
  return ETAPAS_ORDEM.includes(v as EtapaNegocio) ? (v as EtapaNegocio) : undefined;
}

export default async function PaginaNegocios({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const sp = await searchParams;
  const vista = normalizarVista(sp.vista);
  const ordem = normalizarOrdem(sp.ordem);

  const papelEOrg = await obterPapelEOrg();
  const ehGestor = papelEOrg?.papel === "gestor" || papelEOrg?.papel === "admin";

  // Filtros para a camada de dados (a RLS já escopou; estes só refinam).
  const filtros = {
    etapa: normalizarEtapa(sp.etapa),
    origem: sp.origem?.trim() || undefined,
    // Responsável só faz sentido para gestor (corretor já vê só os seus).
    responsavelId: ehGestor ? sp.responsavel?.trim() || undefined : undefined,
    busca: sp.busca?.trim() || undefined,
  };

  // Só o gestor precisa da lista de responsáveis (a função exige gestor/admin).
  const [negocios, origens, responsaveis] = await Promise.all([
    listarNegocios(filtros),
    listarOrigens(),
    ehGestor ? listarResponsaveisDaOrg() : Promise.resolve([] as CorretorOpcao[]),
  ]);

  // Abertos entram no board/lista; fechados (com resultado) vão à parte.
  const abertos = negocios.filter((n) => n.resultado === null);
  const fechados = negocios.filter((n) => n.resultado !== null);

  const nomePorResponsavel: Record<string, string | null> = {};
  for (const c of responsaveis) {
    nomePorResponsavel[c.id] = c.nome;
  }

  const temFiltro =
    Boolean(filtros.etapa) ||
    Boolean(filtros.origem) ||
    Boolean(filtros.responsavelId) ||
    Boolean(filtros.busca);

  return (
    <div className="flex flex-1 flex-col bg-background px-6 py-16 font-sans">
      <main className="mx-auto w-full max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <header>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-strong">
              Funil de vendas
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
              Negócios
            </h1>
            <p className="mt-1 text-muted">
              Seu funil de vendas — arraste seus negócios pelas etapas até o
              fechamento.
            </p>
          </header>
          <div className="flex items-center gap-3">
            <AlternarVista vista={vista} />
            <Link
              href="/corretor/negocios/novo"
              className={classesBotao("primario", "md")}
            >
              Novo negócio
            </Link>
          </div>
        </div>

        <FiltrosPipeline
          origens={origens}
          responsaveis={responsaveis}
          ehGestor={ehGestor}
        />

        {abertos.length === 0 && fechados.length === 0 ? (
          temFiltro ? (
            <EstadoVazio
              className="mt-8"
              icone={<SearchX className="h-6 w-6" aria-hidden />}
              titulo="Nenhum negócio corresponde aos filtros"
              descricao="Ajuste os filtros acima ou limpe tudo para voltar a ver o funil completo."
              cta={{ href: "/corretor/negocios", rotulo: "Limpar filtros" }}
            />
          ) : (
            <EstadoVazio
              className="mt-8"
              icone={<Handshake className="h-6 w-6" aria-hidden />}
              titulo="Nenhum negócio ainda"
              descricao="Crie o primeiro negócio ou converta um lead quente — o funil mostra cada etapa até o fechamento."
              cta={{ href: "/corretor/negocios/novo", rotulo: "Criar primeiro negócio" }}
            />
          )
        ) : (
          <>
            {abertos.length === 0 ? (
              <EstadoVazio
                className="mt-6"
                icone={<Handshake className="h-6 w-6" aria-hidden />}
                titulo="Nenhum negócio aberto no momento"
                descricao="Todos os seus negócios estão fechados. Que tal abrir o próximo?"
                cta={{ href: "/corretor/negocios/novo", rotulo: "Novo negócio" }}
              />
            ) : vista === "lista" ? (
              <ListaNegocios
                negocios={abertos}
                ordem={ordem}
                mostrarResponsavel={ehGestor}
                nomePorResponsavel={nomePorResponsavel}
              />
            ) : (
              <KanbanNegocios
                negocios={abertos}
                mostrarResponsavel={ehGestor}
                nomePorResponsavel={nomePorResponsavel}
              />
            )}

            {fechados.length > 0 && (
              <section className="mt-10">
                <h2 className="text-lg font-semibold text-foreground">Fechados</h2>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {fechados.map((n) => (
                    <li key={n.id}>
                      <Link
                        href={`/corretor/negocios/${n.id}`}
                        className="flex flex-col gap-2 rounded-2xl border border-border bg-surface-card p-4 shadow-[var(--shadow-soft)] transition-[border-color,box-shadow] hover:border-brand/30 hover:shadow-[var(--shadow-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate font-semibold text-foreground">
                              {n.nomeContato}
                            </p>
                            <ChipResultado resultado={n.resultado} />
                          </div>
                          {n.imovelTitulo && (
                            <p className="mt-0.5 truncate text-sm text-muted">
                              {n.imovelTitulo}
                            </p>
                          )}
                        </div>
                        {n.valor !== null && (
                          <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                            {formatarReais(n.valor)}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function ChipResultado({
  resultado,
}: {
  resultado: NegocioResumo["resultado"];
}) {
  if (!resultado) {
    return null;
  }
  const estilo =
    resultado === "ganho"
      ? "border-transparent bg-brand text-brand-contrast"
      : "border-border-strong bg-surface text-subtle";
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-medium ${estilo}`}
    >
      {ROTULO_RESULTADO[resultado]}
    </span>
  );
}
