import { describe, expect, it } from "vitest";
import {
  contatoCasaSegmento,
  formatarTelefoneBR,
  janelaAtendimento,
  normalizarTelefoneE164BR,
  resumoCampanha,
  type ContatoSegmentavel,
  type Segmento,
} from "./crm";

// ---------------------------------------------------------------------------
// normalizarTelefoneE164BR
// ---------------------------------------------------------------------------

describe("normalizarTelefoneE164BR", () => {
  it("celular com máscara '(11) 98888-7777' ⇒ +5511988887777", () => {
    expect(normalizarTelefoneE164BR("(11) 98888-7777")).toBe("+5511988887777");
  });

  it("fixo com 10 dígitos '11 3333-4444' ⇒ +551133334444", () => {
    expect(normalizarTelefoneE164BR("11 3333-4444")).toBe("+551133334444");
  });

  it("13 dígitos já com DDI 55 (sem +) ⇒ mantém e ganha o +", () => {
    expect(normalizarTelefoneE164BR("5511988887777")).toBe("+5511988887777");
  });

  it("12 dígitos com DDI 55 e máscara internacional ⇒ +551188887777", () => {
    expect(normalizarTelefoneE164BR("+55 (11) 8888-7777")).toBe("+551188887777");
  });

  it("curto demais (9 dígitos, sem DDD) ⇒ null — nunca chuta", () => {
    expect(normalizarTelefoneE164BR("98888-7777")).toBeNull();
  });

  it("12 dígitos que NÃO começam com 55 ⇒ null", () => {
    expect(normalizarTelefoneE164BR("121198888777")).toBeNull();
  });

  it("longo demais (14+ dígitos) ⇒ null", () => {
    expect(normalizarTelefoneE164BR("55119888877771")).toBeNull();
  });

  it("vazio ou sem dígitos ⇒ null", () => {
    expect(normalizarTelefoneE164BR("")).toBeNull();
    expect(normalizarTelefoneE164BR("abc")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// formatarTelefoneBR
// ---------------------------------------------------------------------------

describe("formatarTelefoneBR", () => {
  it("E.164 de celular ⇒ '(11) 98888-7777'", () => {
    expect(formatarTelefoneBR("+5511988887777")).toBe("(11) 98888-7777");
  });

  it("E.164 de fixo ⇒ '(11) 8888-7777'", () => {
    expect(formatarTelefoneBR("+551188887777")).toBe("(11) 8888-7777");
  });

  it("aceita sem o '+' e até número local com máscara", () => {
    expect(formatarTelefoneBR("5521999998888")).toBe("(21) 99999-8888");
    expect(formatarTelefoneBR("21999998888")).toBe("(21) 99999-8888");
  });

  it("valor que não normaliza ⇒ devolve o original aparado", () => {
    expect(formatarTelefoneBR("  1234  ")).toBe("1234");
  });
});

// ---------------------------------------------------------------------------
// contatoCasaSegmento
// ---------------------------------------------------------------------------

const CONTATO_OK: ContatoSegmentavel = {
  tags: ["investidor"],
  consentimentoMarketingEm: "2026-06-01T12:00:00Z",
  telefone: "(11) 98888-7777",
};

describe("contatoCasaSegmento", () => {
  it("segmento vazio + contato consentido com telefone ⇒ casa", () => {
    expect(contatoCasaSegmento(CONTATO_OK, {}, {})).toEqual({ casa: true });
  });

  it("sem consentimento ⇒ exclui com 'sem_consentimento' (default do envio)", () => {
    const r = contatoCasaSegmento({ ...CONTATO_OK, consentimentoMarketingEm: null }, {}, {});
    expect(r).toEqual({ casa: false, motivoExclusao: "sem_consentimento" });
  });

  it("sem consentimento E fora do segmento ⇒ 'fora_do_segmento' (não infla a auditoria LGPD)", () => {
    const r = contatoCasaSegmento(
      { ...CONTATO_OK, consentimentoMarketingEm: null },
      { temperatura: "frio" },
      { temperaturas: ["quente"] },
    );
    expect(r).toEqual({ casa: false, motivoExclusao: "fora_do_segmento" });
  });

  it("sem consentimento mas DENTRO do segmento ⇒ 'sem_consentimento'", () => {
    const r = contatoCasaSegmento(
      { ...CONTATO_OK, consentimentoMarketingEm: null },
      { etapasAbertas: ["proposta"] },
      { etapas: ["proposta"] },
    );
    expect(r).toEqual({ casa: false, motivoExclusao: "sem_consentimento" });
  });

  it("sem telefone mas fora do segmento ⇒ 'fora_do_segmento' (não mascara como exclusão)", () => {
    const r = contatoCasaSegmento(
      { ...CONTATO_OK, telefone: null },
      {},
      { etapas: ["proposta"] },
    );
    expect(r).toEqual({ casa: false, motivoExclusao: "fora_do_segmento" });
  });

  it("sem telefone ⇒ 'sem_telefone'", () => {
    const r = contatoCasaSegmento({ ...CONTATO_OK, telefone: null }, {}, {});
    expect(r).toEqual({ casa: false, motivoExclusao: "sem_telefone" });
  });

  it("telefone inválido (não normaliza) ⇒ 'sem_telefone'", () => {
    const r = contatoCasaSegmento({ ...CONTATO_OK, telefone: "1234" }, {}, {});
    expect(r).toEqual({ casa: false, motivoExclusao: "sem_telefone" });
  });

  it("apenasComConsentimento: false (segmento analítico) dispensa consentimento e telefone", () => {
    const r = contatoCasaSegmento(
      { tags: [], consentimentoMarketingEm: null, telefone: null },
      {},
      { apenasComConsentimento: false },
    );
    expect(r).toEqual({ casa: true });
  });

  it("etapas: casa quando alguma etapa aberta está no segmento", () => {
    const seg: Segmento = { etapas: ["proposta", "fechamento"] };
    expect(contatoCasaSegmento(CONTATO_OK, { etapasAbertas: ["proposta"] }, seg).casa).toBe(true);
  });

  it("etapas: sem interseção (ou sem negócio aberto) ⇒ 'fora_do_segmento'", () => {
    const seg: Segmento = { etapas: ["proposta"] };
    expect(contatoCasaSegmento(CONTATO_OK, { etapasAbertas: ["novo"] }, seg)).toEqual({
      casa: false,
      motivoExclusao: "fora_do_segmento",
    });
    expect(contatoCasaSegmento(CONTATO_OK, {}, seg).motivoExclusao).toBe("fora_do_segmento");
  });

  it("temperaturas: casa com a temperatura certa, exclui sem temperatura ou com outra", () => {
    const seg: Segmento = { temperaturas: ["quente", "morno"] };
    expect(contatoCasaSegmento(CONTATO_OK, { temperatura: "quente" }, seg).casa).toBe(true);
    expect(contatoCasaSegmento(CONTATO_OK, { temperatura: "frio" }, seg).motivoExclusao).toBe(
      "fora_do_segmento",
    );
    expect(contatoCasaSegmento(CONTATO_OK, { temperatura: null }, seg).motivoExclusao).toBe(
      "fora_do_segmento",
    );
  });

  it("tags: basta UMA tag em comum; nenhuma ⇒ 'fora_do_segmento'", () => {
    const seg: Segmento = { tags: ["investidor", "primeiro_imovel"] };
    expect(contatoCasaSegmento(CONTATO_OK, {}, seg).casa).toBe(true);
    expect(
      contatoCasaSegmento({ ...CONTATO_OK, tags: ["aluguel"] }, {}, seg).motivoExclusao,
    ).toBe("fora_do_segmento");
  });

  it("diasSemMovimentoMin: casa no limite exato, exclui abaixo ou sem dado", () => {
    const seg: Segmento = { diasSemMovimentoMin: 30 };
    expect(contatoCasaSegmento(CONTATO_OK, { diasSemMovimento: 30 }, seg).casa).toBe(true);
    expect(contatoCasaSegmento(CONTATO_OK, { diasSemMovimento: 45 }, seg).casa).toBe(true);
    expect(
      contatoCasaSegmento(CONTATO_OK, { diasSemMovimento: 10 }, seg).motivoExclusao,
    ).toBe("fora_do_segmento");
    expect(
      contatoCasaSegmento(CONTATO_OK, { diasSemMovimento: null }, seg).motivoExclusao,
    ).toBe("fora_do_segmento");
  });

  it("todos os critérios juntos: precisa passar em todos", () => {
    const seg: Segmento = {
      etapas: ["contato"],
      temperaturas: ["quente"],
      tags: ["investidor"],
      diasSemMovimentoMin: 7,
    };
    const extras = { etapasAbertas: ["contato"], temperatura: "quente", diasSemMovimento: 8 };
    expect(contatoCasaSegmento(CONTATO_OK, extras, seg)).toEqual({ casa: true });
    expect(
      contatoCasaSegmento(CONTATO_OK, { ...extras, temperatura: "morno" }, seg).casa,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// janelaAtendimento
// ---------------------------------------------------------------------------

describe("janelaAtendimento", () => {
  const ENTRADA = "2026-07-10T12:00:00.000Z";

  it("sem mensagem recebida (null) ⇒ fechada, sem expiração", () => {
    expect(janelaAtendimento(null, "2026-07-10T12:00:00Z")).toEqual({
      aberta: false,
      expiraEmISO: null,
    });
  });

  it("23h59 depois ⇒ AINDA aberta", () => {
    const r = janelaAtendimento(ENTRADA, "2026-07-11T11:59:00Z");
    expect(r.aberta).toBe(true);
  });

  it("exatamente 24h depois ⇒ fechada (borda é exclusiva)", () => {
    expect(janelaAtendimento(ENTRADA, "2026-07-11T12:00:00Z").aberta).toBe(false);
  });

  it("24h01 depois ⇒ fechada, mas expiraEmISO continua informando quando fechou", () => {
    const r = janelaAtendimento(ENTRADA, "2026-07-11T12:01:00Z");
    expect(r.aberta).toBe(false);
    expect(r.expiraEmISO).toBe("2026-07-11T12:00:00.000Z");
  });

  it("expiraEmISO = última entrada + 24h", () => {
    const r = janelaAtendimento(ENTRADA, "2026-07-10T13:00:00Z");
    expect(r).toEqual({ aberta: true, expiraEmISO: "2026-07-11T12:00:00.000Z" });
  });

  it("respeita fuso: entrada em -03:00 é convertida para o instante certo", () => {
    const r = janelaAtendimento("2026-07-10T09:00:00-03:00", "2026-07-11T11:59:59Z");
    expect(r.aberta).toBe(true);
    expect(r.expiraEmISO).toBe("2026-07-11T12:00:00.000Z");
  });

  it("ISO inválido ⇒ fechada, sem expiração (nunca lança)", () => {
    expect(janelaAtendimento("nunca", "2026-07-10T12:00:00Z")).toEqual({
      aberta: false,
      expiraEmISO: null,
    });
    expect(janelaAtendimento(ENTRADA, "agora")).toEqual({ aberta: false, expiraEmISO: null });
  });
});

// ---------------------------------------------------------------------------
// resumoCampanha
// ---------------------------------------------------------------------------

describe("resumoCampanha", () => {
  it("lista vazia ⇒ tudo zero", () => {
    expect(resumoCampanha([])).toEqual({ alvo: 0, enviados: 0, falhas: 0, excluidos: 0 });
  });

  it("soma enviados, falhas e excluídos; alvo é o total", () => {
    const envios = [
      { status: "enviado" },
      { status: "entregue" },
      { status: "lido" },
      { status: "falha" },
      { status: "erro" },
      { status: "excluido" },
    ];
    expect(resumoCampanha(envios)).toEqual({ alvo: 6, enviados: 3, falhas: 2, excluidos: 1 });
  });

  it("status desconhecido (ex.: 'pendente') conta só no alvo", () => {
    const r = resumoCampanha([{ status: "pendente" }, { status: "enviado" }]);
    expect(r).toEqual({ alvo: 2, enviados: 1, falhas: 0, excluidos: 0 });
  });
});
