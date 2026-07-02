// Linha de atributos do imóvel (editorial): ícones lucide finos + valores discretos.
// Componente PURO: recebe números nuláveis e OCULTA os nulos/ausentes.
//   area (m²) · quartos (cama) · banheiros (banheira) · vagas (carro).
// Terreno naturalmente mostra só a área (os demais campos vêm nulos).
// Itens separados por hairlines finas; se nada houver para exibir, não renderiza nada.

import { Fragment } from "react";
import { BedDouble, Car, Bath, Maximize } from "lucide-react";

type Props = {
  areaUtil?: number | null;
  quartos?: number | null;
  banheiros?: number | null;
  vagas?: number | null;
  /** Tamanho visual: "card" (compacto) ou "ficha" (maior). */
  variante?: "card" | "ficha";
  className?: string;
};

type Item = { chave: string; icone: typeof BedDouble; valor: number; rotulo: string };

export function AtributosImovel({
  areaUtil,
  quartos,
  banheiros,
  vagas,
  variante = "card",
  className = "",
}: Props) {
  const itens: Item[] = [];
  if (areaUtil != null)
    itens.push({ chave: "area", icone: Maximize, valor: areaUtil, rotulo: `${areaUtil} m²` });
  if (quartos != null)
    itens.push({
      chave: "quartos",
      icone: BedDouble,
      valor: quartos,
      rotulo: `${quartos} ${quartos === 1 ? "quarto" : "quartos"}`,
    });
  if (banheiros != null)
    itens.push({
      chave: "banheiros",
      icone: Bath,
      valor: banheiros,
      rotulo: `${banheiros} ${banheiros === 1 ? "banheiro" : "banheiros"}`,
    });
  if (vagas != null)
    itens.push({
      chave: "vagas",
      icone: Car,
      valor: vagas,
      rotulo: `${vagas} ${vagas === 1 ? "vaga" : "vagas"}`,
    });

  if (itens.length === 0) return null;

  const naFicha = variante === "ficha";
  const tamIcone = naFicha ? 18 : 16;

  return (
    <ul
      className={`flex flex-wrap items-center gap-x-3.5 gap-y-1.5 ${
        naFicha ? "text-sm" : "text-xs"
      } text-muted ${className}`}
    >
      {itens.map(({ chave, icone: Icone, rotulo }, i) => (
        <Fragment key={chave}>
          {i > 0 && (
            <li
              aria-hidden="true"
              className="h-3.5 w-px bg-border-strong/70"
            />
          )}
          <li className="inline-flex items-center gap-1.5" title={rotulo}>
            <Icone
              size={tamIcone}
              className="shrink-0 text-gold"
              aria-hidden="true"
              strokeWidth={1.6}
            />
            <span>{rotulo}</span>
          </li>
        </Fragment>
      ))}
    </ul>
  );
}
