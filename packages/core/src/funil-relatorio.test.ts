import { describe, expect, it } from "vitest";
import {
  contatoEstaAContatar,
  relatorioDeFunil,
  type ContatoRelatorio,
  type EtapaFunil,
} from "./funil-relatorio";

// Funil de exemplo (espelha o seed "Relacionamento" da migração 0027).
const ETAPAS: EtapaFunil[] = [
  { chave: "novo_contato", nome: "Novo contato", cor: "#3b82f6" },
  { chave: "em_conversa", nome: "Em conversa" },
  { chave: "aguardando_retorno", nome: "Aguardando retorno" },
  { chave: "cliente_ativo", nome: "Cliente ativo" },
  { chave: "encerrado", nome: "Encerrado" },
];

const AGORA = "2026-07-11T15:00:00-03:00";

function contato(parcial: Partial<ContatoRelatorio>): ContatoRelatorio {
  return {
    etapaChave: "novo_contato",
    criadoEm: "2026-07-11T09:00:00-03:00",
    ultimaInteracaoEm: "2026-07-11T09:00:00-03:00",
    ...parcial,
  };
}

describe("relatorioDeFunil", () => {
  it("funil sem contatos: tudo zerado, conversão 0 (sem divisão por zero)", () => {
    const r = relatorioDeFunil([], ETAPAS, 7, AGORA);
    expect(r.porEtapa).toHaveLength(5);
    expect(r.porEtapa.every((e) => e.total === 0 && e.aContatar === 0)).toBe(true);
    expect(r.kpis).toEqual({
      hoje: 0,
      ultimos7: 0,
      ultimos30: 0,
      total: 0,
      ganhos: 0,
      conversao: 0,
      receitaFunilCentavos: 0,
      receitaGanhaCentavos: 0,
    });
    expect(r.aContatarTotal).toBe(0);
  });

  it("porEtapa preserva a ORDEM e os nomes das etapas dadas", () => {
    const r = relatorioDeFunil([], ETAPAS, 7, AGORA);
    expect(r.porEtapa.map((e) => e.chave)).toEqual([
      "novo_contato",
      "em_conversa",
      "aguardando_retorno",
      "cliente_ativo",
      "encerrado",
    ]);
    expect(r.porEtapa[0].nome).toBe("Novo contato");
  });

  it("conta os contatos na etapa certa", () => {
    const r = relatorioDeFunil(
      [
        contato({ etapaChave: "novo_contato" }),
        contato({ etapaChave: "novo_contato" }),
        contato({ etapaChave: "em_conversa" }),
      ],
      ETAPAS,
      7,
      AGORA,
    );
    expect(r.porEtapa[0].total).toBe(2);
    expect(r.porEtapa[1].total).toBe(1);
    expect(r.kpis.total).toBe(3);
  });

  it("etapa null ou desconhecida fica fora do porEtapa mas conta no total", () => {
    const r = relatorioDeFunil(
      [
        contato({ etapaChave: null }),
        contato({ etapaChave: "etapa_apagada" }),
      ],
      ETAPAS,
      7,
      AGORA,
    );
    expect(r.porEtapa.reduce((s, e) => s + e.total, 0)).toBe(0);
    expect(r.kpis.total).toBe(2);
  });

  it("'hoje' compara pelo slice da data (mesmo dia em horas diferentes conta)", () => {
    const r = relatorioDeFunil(
      [
        contato({ criadoEm: "2026-07-11T00:00:01-03:00" }),
        contato({ criadoEm: "2026-07-11T23:59:59-03:00" }),
        contato({ criadoEm: "2026-07-10T23:59:59-03:00" }),
      ],
      ETAPAS,
      7,
      AGORA,
    );
    expect(r.kpis.hoje).toBe(2);
  });

  it("'últimos 7' inclui 6 dias atrás e EXCLUI 7 dias atrás (hoje incluso)", () => {
    const r = relatorioDeFunil(
      [
        contato({ criadoEm: "2026-07-05T10:00:00-03:00" }), // 6 dias atrás
        contato({ criadoEm: "2026-07-04T10:00:00-03:00" }), // 7 dias atrás
      ],
      ETAPAS,
      7,
      AGORA,
    );
    expect(r.kpis.ultimos7).toBe(1);
    expect(r.kpis.ultimos30).toBe(2);
  });

  it("'últimos 30' inclui 29 dias atrás e EXCLUI 30 dias atrás", () => {
    const r = relatorioDeFunil(
      [
        contato({ criadoEm: "2026-06-12T10:00:00-03:00" }), // 29 dias atrás
        contato({ criadoEm: "2026-06-11T10:00:00-03:00" }), // 30 dias atrás
      ],
      ETAPAS,
      7,
      AGORA,
    );
    expect(r.kpis.ultimos30).toBe(1);
    expect(r.kpis.total).toBe(2);
  });

  it("criadoEm no FUTURO não conta em hoje/7/30, mas conta no total", () => {
    const r = relatorioDeFunil(
      [contato({ criadoEm: "2026-07-12T10:00:00-03:00" })],
      ETAPAS,
      7,
      AGORA,
    );
    expect(r.kpis.hoje).toBe(0);
    expect(r.kpis.ultimos7).toBe(0);
    expect(r.kpis.ultimos30).toBe(0);
    expect(r.kpis.total).toBe(1);
  });

  it("🔥 sem NENHUMA interação está a contatar", () => {
    const r = relatorioDeFunil(
      [contato({ ultimaInteracaoEm: null })],
      ETAPAS,
      7,
      AGORA,
    );
    expect(r.aContatarTotal).toBe(1);
    expect(r.porEtapa[0].aContatar).toBe(1);
  });

  it("🔥 interação há exatamente diasParaEsfriar dias JÁ esfria (>= N)", () => {
    const r = relatorioDeFunil(
      [
        contato({ ultimaInteracaoEm: "2026-07-04T15:00:00-03:00" }), // 7 dias
        contato({ ultimaInteracaoEm: "2026-07-04T15:00:01-03:00" }), // < 7 dias
      ],
      ETAPAS,
      7,
      AGORA,
    );
    expect(r.aContatarTotal).toBe(1);
  });

  it("🔥 interação recente NÃO está a contatar", () => {
    const r = relatorioDeFunil(
      [contato({ ultimaInteracaoEm: "2026-07-10T15:00:00-03:00" })],
      ETAPAS,
      7,
      AGORA,
    );
    expect(r.aContatarTotal).toBe(0);
  });

  it("🔥 contato GANHO nunca está a contatar, mesmo frio", () => {
    const r = relatorioDeFunil(
      [contato({ ultimaInteracaoEm: null, ganho: true })],
      ETAPAS,
      7,
      AGORA,
    );
    expect(r.aContatarTotal).toBe(0);
    expect(r.kpis.ganhos).toBe(1);
  });

  it("🔥 ETAPA FINAL (encerrado) nunca está a contatar, mesmo fria", () => {
    const r = relatorioDeFunil(
      [contato({ etapaChave: "encerrado", ultimaInteracaoEm: null })],
      ETAPAS,
      7,
      AGORA,
    );
    expect(r.aContatarTotal).toBe(0);
    expect(r.porEtapa[4].total).toBe(1);
    expect(r.porEtapa[4].aContatar).toBe(0);
  });

  it("🔥 contato sem etapa/etapa desconhecida conta no aContatarTotal", () => {
    const r = relatorioDeFunil(
      [
        contato({ etapaChave: null, ultimaInteracaoEm: null }),
        contato({ etapaChave: "etapa_apagada", ultimaInteracaoEm: null }),
      ],
      ETAPAS,
      7,
      AGORA,
    );
    expect(r.aContatarTotal).toBe(2);
    expect(r.porEtapa.reduce((s, e) => s + e.aContatar, 0)).toBe(0);
  });

  it("conversão = ganhos/total em 0..1", () => {
    const r = relatorioDeFunil(
      [
        contato({ ganho: true }),
        contato({}),
        contato({}),
        contato({}),
      ],
      ETAPAS,
      7,
      AGORA,
    );
    expect(r.kpis.ganhos).toBe(1);
    expect(r.kpis.conversao).toBeCloseTo(0.25, 10);
  });

  it("receitas somam CENTAVOS de abertos e ganhos separadamente", () => {
    const r = relatorioDeFunil(
      [
        contato({ valorAbertoCentavos: 50_000_00 }),
        contato({ valorAbertoCentavos: 30_000_00, valorGanhoCentavos: 100_000_00, ganho: true }),
        contato({}), // sem valores: soma 0
      ],
      ETAPAS,
      7,
      AGORA,
    );
    expect(r.kpis.receitaFunilCentavos).toBe(80_000_00);
    expect(r.kpis.receitaGanhaCentavos).toBe(100_000_00);
  });

  it("funil com outra etapa final respeita a ÚLTIMA do array como final", () => {
    const captacao: EtapaFunil[] = [
      { chave: "comentou", nome: "Comentou/DM" },
      { chave: "virou_negocio", nome: "Virou negócio" },
    ];
    const r = relatorioDeFunil(
      [
        contato({ etapaChave: "virou_negocio", ultimaInteracaoEm: null }),
        contato({ etapaChave: "comentou", ultimaInteracaoEm: null }),
      ],
      captacao,
      7,
      AGORA,
    );
    expect(r.aContatarTotal).toBe(1);
    expect(r.porEtapa[0].aContatar).toBe(1);
    expect(r.porEtapa[1].aContatar).toBe(0);
  });
});

// A regra exportada por contato (lista/kanban marcam cada card com ela) —
// precisa bater EXATAMENTE com o que o relatório agrega.
describe("contatoEstaAContatar", () => {
  const FINAL = "encerrado";

  it("sem interação alguma ⇒ 🔥", () => {
    expect(
      contatoEstaAContatar({ etapaChave: "novo_contato", ultimaInteracaoEm: null }, FINAL, 7, AGORA),
    ).toBe(true);
  });

  it("interação há exatamente diasParaEsfriar dias ⇒ 🔥 (borda inclusiva)", () => {
    expect(
      contatoEstaAContatar(
        { etapaChave: "novo_contato", ultimaInteracaoEm: "2026-07-04T15:00:00-03:00" },
        FINAL,
        7,
        AGORA,
      ),
    ).toBe(true);
    expect(
      contatoEstaAContatar(
        { etapaChave: "novo_contato", ultimaInteracaoEm: "2026-07-04T15:00:01-03:00" },
        FINAL,
        7,
        AGORA,
      ),
    ).toBe(false);
  });

  it("ganho ou etapa final nunca são 🔥; etapa null (fora do funil) pode ser", () => {
    expect(
      contatoEstaAContatar(
        { etapaChave: "novo_contato", ultimaInteracaoEm: null, ganho: true },
        FINAL,
        7,
        AGORA,
      ),
    ).toBe(false);
    expect(
      contatoEstaAContatar({ etapaChave: FINAL, ultimaInteracaoEm: null }, FINAL, 7, AGORA),
    ).toBe(false);
    expect(
      contatoEstaAContatar({ etapaChave: null, ultimaInteracaoEm: null }, FINAL, 7, AGORA),
    ).toBe(true);
  });

  it("bate com o agregado do relatório para o mesmo conjunto", () => {
    const contatos: ContatoRelatorio[] = [
      contato({ ultimaInteracaoEm: null }),
      contato({}),
      contato({ etapaChave: "encerrado", ultimaInteracaoEm: null }),
    ];
    const r = relatorioDeFunil(contatos, ETAPAS, 7, AGORA);
    const porRegra = contatos.filter((c) =>
      contatoEstaAContatar(c, "encerrado", 7, AGORA),
    ).length;
    expect(r.aContatarTotal).toBe(porRegra);
  });
});
