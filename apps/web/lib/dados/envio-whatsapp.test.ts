import { describe, expect, it } from "vitest";
import { avaliarGateEnvio } from "./envio-whatsapp";

const TESTE_COM_LISTA = {
  whatsappModo: "teste",
  whatsappNumerosTeste: ["5511999998888", "5521988887777"],
};

describe("avaliarGateEnvio", () => {
  it("modo produção envia para qualquer número", () => {
    const config = { whatsappModo: "producao", whatsappNumerosTeste: [] };
    expect(avaliarGateEnvio(config, "5511911112222")).toEqual({ pode: true });
    expect(avaliarGateEnvio(config, null)).toEqual({ pode: true });
  });

  it("modo teste só envia para número da lista", () => {
    expect(avaliarGateEnvio(TESTE_COM_LISTA, "5511999998888")).toEqual({ pode: true });
    expect(avaliarGateEnvio(TESTE_COM_LISTA, "5511911112222")).toEqual({
      pode: false,
      motivo: "modo_teste",
    });
  });

  it("modo teste compara após normalizar máscara e DDI", () => {
    // Máscara completa e número nacional sem 55 casam com a lista.
    expect(avaliarGateEnvio(TESTE_COM_LISTA, "+55 (11) 99999-8888")).toEqual({
      pode: true,
    });
    expect(avaliarGateEnvio(TESTE_COM_LISTA, "11 99999-8888")).toEqual({ pode: true });
    // Lista com máscara também normaliza.
    const config = { whatsappModo: "teste", whatsappNumerosTeste: ["(21) 98888-7777"] };
    expect(avaliarGateEnvio(config, "5521988887777")).toEqual({ pode: true });
  });

  it("modo teste sem telefone bloqueia", () => {
    expect(avaliarGateEnvio(TESTE_COM_LISTA, null)).toEqual({
      pode: false,
      motivo: "modo_teste",
    });
  });

  it("sem config (null) bloqueia — default seguro, nunca 'envia tudo'", () => {
    expect(avaliarGateEnvio(null, "5511999998888")).toEqual({
      pode: false,
      motivo: "modo_teste",
    });
  });

  it("modo desconhecido (lixo no banco) se comporta como teste", () => {
    const config = { whatsappModo: "tudo_liberado", whatsappNumerosTeste: [] };
    expect(avaliarGateEnvio(config, "5511999998888")).toEqual({
      pode: false,
      motivo: "modo_teste",
    });
  });
});
