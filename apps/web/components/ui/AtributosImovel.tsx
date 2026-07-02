// Linha de atributos do imóvel (padrão portal): ícones lucide + valores.
// Componente PURO: recebe números nuláveis e OCULTA os nulos/ausentes.
//   area (m²) · quartos (cama) · banheiros (banheira) · vagas (carro).
// Terreno naturalmente mostra só a área (os demais campos vêm nulos).
// Se nada houver para exibir, não renderiza nada.

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
      className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 ${
        naFicha ? "text-sm" : "text-xs"
      } text-muted ${className}`}
    >
      {itens.map(({ chave, icone: Icone, rotulo }) => (
        <li key={chave} className="inline-flex items-center gap-1.5" title={rotulo}>
          <Icone
            size={tamIcone}
            className="shrink-0 text-subtle"
            aria-hidden="true"
            strokeWidth={1.8}
          />
          <span>{rotulo}</span>
        </li>
      ))}
    </ul>
  );
}
