// Testes da máquina de memoização de lib/parametros.ts — sucesso 60s (H-05:
// edição do gestor vale em ≤1min), falha 10s (não repagar o timeout com o
// backend fora) e QUALQUER falha caindo no seed do core. Só o cliente Supabase
// é mockado (não há banco aqui); o estado módulo-level é isolado reimportando
// o módulo a cada teste (vi.resetModules).
import { obterParametrosAtuais } from "@imobia/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { maybeSingleMock } = vi.hoisted(() => ({ maybeSingleMock: vi.fn() }));

// cache() do React memoiza por request RSC — identidade basta no teste.
vi.mock("react", () => ({ cache: <T,>(fn: T): T => fn }));

vi.mock("@/lib/supabase/server", () => {
  const builder = {
    from: () => builder,
    select: () => builder,
    lte: () => builder,
    order: () => builder,
    limit: () => builder,
    abortSignal: () => builder,
    maybeSingle: maybeSingleMock,
  };
  return { criarClienteServidor: async () => builder };
});

async function importarModulo() {
  vi.resetModules();
  return import("@/lib/parametros");
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-11T12:00:00Z"));
  maybeSingleMock.mockReset();
  // Silencia o console.warn esperado dos caminhos de falha.
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("obterParametrosVigentesDoBanco", () => {
  it("erro do banco ⇒ seed do core, e a falha fica memoizada por 10s", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    const { obterParametrosVigentesDoBanco } = await importarModulo();

    expect(await obterParametrosVigentesDoBanco()).toEqual(obterParametrosAtuais());
    expect(maybeSingleMock).toHaveBeenCalledTimes(1);

    // Dentro da janela de 10s NÃO reconsulta (nem repaga o timeout).
    vi.advanceTimersByTime(9_000);
    expect(await obterParametrosVigentesDoBanco()).toEqual(obterParametrosAtuais());
    expect(maybeSingleMock).toHaveBeenCalledTimes(1);

    // Passada a janela, volta a tentar o banco.
    vi.advanceTimersByTime(2_000);
    await obterParametrosVigentesDoBanco();
    expect(maybeSingleMock).toHaveBeenCalledTimes(2);
  });

  it("sucesso ⇒ snapshot servido por 60s sem novo hit, reconsultado depois (H-05)", async () => {
    const dados = obterParametrosAtuais();
    maybeSingleMock.mockResolvedValue({ data: { dados }, error: null });
    const { obterParametrosVigentesDoBanco } = await importarModulo();

    expect(await obterParametrosVigentesDoBanco()).toEqual(dados);
    expect(maybeSingleMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(59_000);
    expect(await obterParametrosVigentesDoBanco()).toEqual(dados);
    expect(maybeSingleMock).toHaveBeenCalledTimes(1);

    // TTL vencido: a edição do gestor precisa valer em até 1 minuto.
    vi.advanceTimersByTime(2_000);
    expect(await obterParametrosVigentesDoBanco()).toEqual(dados);
    expect(maybeSingleMock).toHaveBeenCalledTimes(2);
  });

  it("jsonb inválido (zod falha) ⇒ seed do core", async () => {
    maybeSingleMock.mockResolvedValue({ data: { dados: { lixo: true } }, error: null });
    const { obterParametrosVigentesDoBanco } = await importarModulo();
    expect(await obterParametrosVigentesDoBanco()).toEqual(obterParametrosAtuais());
  });

  it("nenhum snapshot vigente (data null) ⇒ seed do core", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    const { obterParametrosVigentesDoBanco } = await importarModulo();
    expect(await obterParametrosVigentesDoBanco()).toEqual(obterParametrosAtuais());
  });

  it("dados válidos ⇒ parseados e retornados", async () => {
    const dados = obterParametrosAtuais();
    maybeSingleMock.mockResolvedValue({ data: { dados }, error: null });
    const { obterParametrosVigentesDoBanco } = await importarModulo();
    const resultado = await obterParametrosVigentesDoBanco();
    expect(resultado).toEqual(dados);
  });
});
