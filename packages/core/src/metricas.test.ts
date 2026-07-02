import { describe, expect, it } from "vitest";
import { ETAPAS_NEGOCIO } from "@imobia/domain";
import { metricasGerenciais, type NegocioMetricas } from "./metricas";

const HOJE = "2026-07-15";

// Dataset fixo:
// - 3 ganhos + 1 perdido ⇒ conversão global 0.75.
// - ganhos com valores conhecidos (ticket) e ciclos conhecidos.
// - g2 fechado em JUNHO (fora do mês corrente de HOJE).
// - 3 abertos em etapas distintas.
const DATASET: NegocioMetricas[] = [
  // Ganhos
  {
    etapa: "fechamento",
    resultado: "ganho",
    valor: 300_000,
    criadoEm: "2026-07-01T00:00:00Z",
    fechadoEm: "2026-07-11T00:00:00Z", // 10 dias, mês corrente
    corretorId: "A",
    corretorNome: "Alfa",
  },
  {
    etapa: "fechamento",
    resultado: "ganho",
    valor: 500_000,
    criadoEm: "2026-06-01T00:00:00Z",
    fechadoEm: "2026-06-21T00:00:00Z", // 20 dias, mês anterior
    corretorId: "A",
    corretorNome: "Alfa",
  },
  {
    etapa: "fechamento",
    resultado: "ganho",
    valor: 100_000,
    criadoEm: "2026-07-05T00:00:00Z",
    fechadoEm: "2026-07-11T00:00:00Z", // 6 dias, mês corrente
    corretorId: "B",
    corretorNome: "Beta",
  },
  // Perdido
  {
    etapa: "proposta",
    resultado: "perdido",
    valor: 999_999,
    criadoEm: "2026-07-02T00:00:00Z",
    fechadoEm: "2026-07-08T00:00:00Z",
    corretorId: "B",
    corretorNome: "Beta",
  },
  // Abertos
  {
    etapa: "novo",
    valor: 40_000,
    criadoEm: "2026-07-03T00:00:00Z",
    corretorId: "A",
    corretorNome: "Alfa",
  },
  {
    etapa: "contato",
    valor: 60_000,
    criadoEm: "2026-07-04T00:00:00Z",
    fechadoEm: null,
    corretorId: "A",
    corretorNome: "Alfa",
  },
  {
    etapa: "visita",
    valor: 70_000,
    criadoEm: "2026-07-06T00:00:00Z",
    corretorId: "B",
    corretorNome: "Beta",
  },
];

describe("metricasGerenciais", () => {
  const m = metricasGerenciais(DATASET, HOJE);

  it("emAberto conta apenas não-fechados", () => {
    expect(m.emAberto).toEqual({ quantidade: 3, valor: 170_000 });
  });

  it("ganhos e perdidos", () => {
    expect(m.ganhos).toEqual({ quantidade: 3, valor: 900_000 });
    expect(m.perdidos).toEqual({ quantidade: 1, valor: 999_999 });
  });

  it("taxaConversao = 3/(3+1) = 0.75", () => {
    expect(m.taxaConversao).toBe(0.75);
  });

  it("ticketMedio = média dos ganhos = 300_000", () => {
    expect(m.ticketMedio).toBe(300_000);
  });

  it("cicloMedioDias = (10+20+6)/3 = 12", () => {
    expect(m.cicloMedioDias).toBe(12);
  });

  it("ganhosNoMes = só ganhos fechados em julho/2026", () => {
    expect(m.ganhosNoMes).toEqual({ quantidade: 2, valor: 400_000 });
  });

  it("porEtapa considera apenas abertos", () => {
    expect(m.porEtapa.novo).toEqual({ quantidade: 1, valor: 40_000 });
    expect(m.porEtapa.contato).toEqual({ quantidade: 1, valor: 60_000 });
    expect(m.porEtapa.visita).toEqual({ quantidade: 1, valor: 70_000 });
    // proposta (perdido) e fechamento (ganhos) não entram — só abertos.
    expect(m.porEtapa.proposta).toEqual({ quantidade: 0, valor: 0 });
    expect(m.porEtapa.fechamento).toEqual({ quantidade: 0, valor: 0 });
  });

  it("ranking: ordem desc por valorGanho e conversão por corretor", () => {
    expect(m.ranking).toHaveLength(2);
    const [primeiro, segundo] = m.ranking;
    // Alfa: 2 ganhos, 800_000, 2 abertos, 0 perdidos ⇒ conversão 1.
    expect(primeiro.corretorId).toBe("A");
    expect(primeiro.nome).toBe("Alfa");
    expect(primeiro.ganhos).toBe(2);
    expect(primeiro.valorGanho).toBe(800_000);
    expect(primeiro.emAberto).toBe(2);
    expect(primeiro.conversao).toBe(1);
    // Beta: 1 ganho + 1 perdido ⇒ conversão 0.5; 100_000 ganho; 1 aberto.
    expect(segundo.corretorId).toBe("B");
    expect(segundo.nome).toBe("Beta");
    expect(segundo.valorGanho).toBe(100_000);
    expect(segundo.emAberto).toBe(1);
    expect(segundo.conversao).toBe(0.5);
  });

  it("tendencia: 6 buckets cronológicos (fev..jul 2026)", () => {
    expect(m.tendencia.map((t) => t.mes)).toEqual([
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
    ]);
    const jun = m.tendencia.find((t) => t.mes === "2026-06")!;
    const jul = m.tendencia.find((t) => t.mes === "2026-07")!;
    // Junho: 1 criado (g2), 1 ganho (g2 fechado em junho).
    expect(jun).toEqual({ mes: "2026-06", criados: 1, ganhos: 1 });
    // Julho: 6 criados (todos exceto g2), 2 ganhos fechados em julho.
    expect(jul).toEqual({ mes: "2026-07", criados: 6, ganhos: 2 });
  });
});

describe("metricasGerenciais — bordas", () => {
  it("lista vazia ⇒ tudo zerado", () => {
    const m = metricasGerenciais([], HOJE);
    expect(m.emAberto).toEqual({ quantidade: 0, valor: 0 });
    expect(m.ganhos).toEqual({ quantidade: 0, valor: 0 });
    expect(m.perdidos).toEqual({ quantidade: 0, valor: 0 });
    expect(m.ganhosNoMes).toEqual({ quantidade: 0, valor: 0 });
    expect(m.taxaConversao).toBe(0);
    expect(m.ticketMedio).toBe(0);
    expect(m.cicloMedioDias).toBe(0);
    expect(m.ranking).toEqual([]);
    for (const etapa of ETAPAS_NEGOCIO) {
      expect(m.porEtapa[etapa]).toEqual({ quantidade: 0, valor: 0 });
    }
    expect(m.tendencia).toHaveLength(6);
    for (const t of m.tendencia) {
      expect(t.criados).toBe(0);
      expect(t.ganhos).toBe(0);
    }
  });

  it("sem fechados ⇒ conversão 0, ciclo 0, ticket 0", () => {
    const negocios: NegocioMetricas[] = [
      {
        etapa: "novo",
        valor: 10_000,
        criadoEm: "2026-07-01T00:00:00Z",
        corretorId: "A",
      },
      {
        etapa: "contato",
        resultado: null,
        valor: 20_000,
        criadoEm: "2026-07-02T00:00:00Z",
        fechadoEm: null,
        corretorId: "A",
      },
    ];
    const m = metricasGerenciais(negocios, HOJE);
    expect(m.emAberto).toEqual({ quantidade: 2, valor: 30_000 });
    expect(m.taxaConversao).toBe(0);
    expect(m.cicloMedioDias).toBe(0);
    expect(m.ticketMedio).toBe(0);
    expect(m.ganhos.quantidade).toBe(0);
    // Ranking do único corretor com conversão 0 e sem ganhos.
    expect(m.ranking).toEqual([
      {
        corretorId: "A",
        nome: "A",
        ganhos: 0,
        valorGanho: 0,
        emAberto: 2,
        conversao: 0,
      },
    ]);
  });
});
