import { describe, expect, it } from "vitest";
import {
  centavosSchema,
  configModalidadeSchema,
  favoritoSchema,
  isoDateSchema,
  organizacaoSchema,
} from "./index";

const UUID = "1c9a7e6a-6c2e-4b6f-9b1a-2f3d4e5f6a7b";

describe("organizacaoSchema (multi-tenant, H-03)", () => {
  const valida = {
    id: UUID,
    nome: "Imobiliária Horizonte",
    assentos: 5,
    criadoEm: "2026-07-02T09:00:00Z",
  };

  it("aceita organização válida", () => {
    expect(organizacaoSchema.parse(valida)).toEqual(valida);
  });

  it("é strict: rejeita chave desconhecida", () => {
    expect(organizacaoSchema.safeParse({ ...valida, extra: 1 }).success).toBe(false);
  });

  it("rejeita assentos não positivos", () => {
    expect(organizacaoSchema.safeParse({ ...valida, assentos: 0 }).success).toBe(false);
  });
});

describe("favoritoSchema (orgId denormalizado obrigatório)", () => {
  const valido = {
    id: UUID,
    orgId: UUID,
    clienteId: UUID,
    imovelId: UUID,
    criadoEm: "2026-07-02T09:00:00Z",
  };

  it("aceita favorito válido sem unidade", () => {
    expect(favoritoSchema.parse(valido)).toEqual(valido);
  });

  it("rejeita favorito sem orgId (isolamento por tenant)", () => {
    const { orgId: _orgId, ...semOrg } = valido;
    expect(favoritoSchema.safeParse(semOrg).success).toBe(false);
  });
});

describe("configModalidadeSchema — invariante de ordenação das faixas", () => {
  const base = {
    taxaAnualEfetiva: 0.1,
    prazoMaxMeses: 420,
    ltvMax: 0.8,
    permiteFgts: true,
    sistemaAmortizacaoPadrao: "sac" as const,
  };
  const faixa = (rendaMensalAte: number) => ({
    rendaMensalAte,
    taxaAnualEfetiva: 0.0433,
    subsidioMax: 5_500_000,
  });

  it("aceita faixas com rendaMensalAte estritamente crescente", () => {
    const config = { ...base, faixas: [faixa(320_000), faixa(500_000), faixa(960_000)] };
    expect(configModalidadeSchema.safeParse(config).success).toBe(true);
  });

  it("rejeita faixas fora de ordem", () => {
    const config = { ...base, faixas: [faixa(500_000), faixa(320_000)] };
    expect(configModalidadeSchema.safeParse(config).success).toBe(false);
  });

  it("rejeita faixas com renda duplicada", () => {
    const config = { ...base, faixas: [faixa(320_000), faixa(320_000)] };
    expect(configModalidadeSchema.safeParse(config).success).toBe(false);
  });
});

describe("primitivas", () => {
  it("centavos são inteiros não negativos", () => {
    expect(centavosSchema.safeParse(32_000_000).success).toBe(true);
    expect(centavosSchema.safeParse(10.5).success).toBe(false);
    expect(centavosSchema.safeParse(-1).success).toBe(false);
  });

  it("isoDate exige YYYY-MM-DD", () => {
    expect(isoDateSchema.safeParse("2026-07-01").success).toBe(true);
    expect(isoDateSchema.safeParse("01/07/2026").success).toBe(false);
  });
});
