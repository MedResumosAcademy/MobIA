import { describe, expect, it } from "vitest";
import {
  descreverComando,
  extrairDataHora,
  extrairValorMonetario,
  interpretarComando,
} from "./assistente";

// Âncoras fixas (calendário REAL, verificado com Date.UTC):
//   2026-07-02 = quinta-feira; 2026-07-03 = sexta-feira; 2026-07-04 = sábado.
const AGORA = "2026-07-03T10:00:00-03:00"; // sexta-feira
const QUINTA = "2026-07-02T10:00:00-03:00"; // quinta-feira

describe("extrairDataHora", () => {
  it("hoje ⇒ data de hoje (hora default 9h no inicioISO)", () => {
    const r = extrairDataHora("agenda de hoje", AGORA);
    expect(r.dataISO).toBe("2026-07-03");
    expect(r.inicioISO).toBe("2026-07-03T09:00:00-03:00");
  });

  it("amanha as 15h ⇒ data + hora + inicioISO com o offset do agora", () => {
    const r = extrairDataHora("amanha as 15h", AGORA);
    expect(r.dataISO).toBe("2026-07-04");
    expect(r.horaMin).toEqual({ h: 15, m: 0 });
    expect(r.inicioISO).toBe("2026-07-04T15:00:00-03:00");
  });

  it("normaliza maiúsculas e acentos (AMANHÃ ÀS 15H)", () => {
    const r = extrairDataHora("AMANHÃ ÀS 15H", AGORA);
    expect(r.inicioISO).toBe("2026-07-04T15:00:00-03:00");
  });

  it("depois de amanhã ⇒ +2 dias", () => {
    expect(extrairDataHora("depois de amanhã", AGORA).dataISO).toBe("2026-07-05");
  });

  it("dia da semana: 'sexta' com hoje=quinta ⇒ amanhã", () => {
    expect(extrairDataHora("sexta", QUINTA).dataISO).toBe("2026-07-03");
  });

  it("dia da semana é SEMPRE a próxima ocorrência futura ('sexta' numa sexta ⇒ +7)", () => {
    expect(extrairDataHora("sexta", AGORA).dataISO).toBe("2026-07-10");
  });

  it("'sábado' com hoje=sexta ⇒ amanhã", () => {
    expect(extrairDataHora("sábado", AGORA).dataISO).toBe("2026-07-04");
  });

  it("'segunda-feira' ⇒ próxima segunda", () => {
    expect(extrairDataHora("segunda-feira", AGORA).dataISO).toBe("2026-07-06");
  });

  it("'dia 10' (ainda não passou) ⇒ mês corrente", () => {
    expect(extrairDataHora("dia 10", AGORA).dataISO).toBe("2026-07-10");
  });

  it("'dia 2' (já passou no mês) ⇒ vira o mês", () => {
    expect(extrairDataHora("dia 2", AGORA).dataISO).toBe("2026-08-02");
  });

  it("'dia 3' (o próprio dia) ⇒ hoje", () => {
    expect(extrairDataHora("dia 3", AGORA).dataISO).toBe("2026-07-03");
  });

  it("'15h30' ⇒ hora e minuto; data default hoje no inicioISO", () => {
    const r = extrairDataHora("15h30", AGORA);
    expect(r.dataISO).toBeUndefined();
    expect(r.horaMin).toEqual({ h: 15, m: 30 });
    expect(r.inicioISO).toBe("2026-07-03T15:30:00-03:00");
  });

  it("'às 9' ⇒ 9h em ponto", () => {
    expect(extrairDataHora("às 9", AGORA).horaMin).toEqual({ h: 9, m: 0 });
  });

  it("'meio-dia' ⇒ 12h", () => {
    expect(extrairDataHora("meio-dia", AGORA).horaMin).toEqual({ h: 12, m: 0 });
  });

  it("texto sem referência temporal ⇒ tudo undefined", () => {
    const r = extrairDataHora("qualquer coisa sem tempo", AGORA);
    expect(r.dataISO).toBeUndefined();
    expect(r.horaMin).toBeUndefined();
    expect(r.inicioISO).toBeUndefined();
  });
});

describe("extrairValorMonetario (CENTAVOS)", () => {
  it("'450 mil' ⇒ 45.000.000", () => {
    expect(extrairValorMonetario("450 mil")).toBe(45_000_000);
  });

  it("'1,2 milhao' ⇒ 120.000.000", () => {
    expect(extrairValorMonetario("1,2 milhao")).toBe(120_000_000);
  });

  it("'1,2 MILHÃO' (caixa/acento) ⇒ 120.000.000", () => {
    expect(extrairValorMonetario("1,2 MILHÃO")).toBe(120_000_000);
  });

  it("'R$ 380.000' ⇒ 38.000.000", () => {
    expect(extrairValorMonetario("R$ 380.000")).toBe(38_000_000);
  });

  it("'380.000,00' ⇒ 38.000.000", () => {
    expect(extrairValorMonetario("380.000,00")).toBe(38_000_000);
  });

  it("'380000' cru ⇒ reais ⇒ 38.000.000", () => {
    expect(extrairValorMonetario("380000")).toBe(38_000_000);
  });

  it("'2 milhoes e meio' ⇒ 250.000.000", () => {
    expect(extrairValorMonetario("2 milhoes e meio")).toBe(250_000_000);
  });

  it("'meio milhão' ⇒ 50.000.000", () => {
    expect(extrairValorMonetario("meio milhão")).toBe(50_000_000);
  });

  it("texto sem valor ⇒ null", () => {
    expect(extrairValorMonetario("apartamento no Itaim")).toBeNull();
  });
});

describe("interpretarComando — consultar_agenda", () => {
  it("'agenda de hoje'", () => {
    expect(interpretarComando("agenda de hoje", AGORA)).toEqual({
      intencao: "consultar_agenda",
      dia: "2026-07-03",
    });
  });

  it("'Minha agenda' (sem data) ⇒ hoje", () => {
    expect(interpretarComando("Minha agenda", AGORA)).toEqual({
      intencao: "consultar_agenda",
      dia: "2026-07-03",
    });
  });

  it("'O que tenho amanhã?'", () => {
    expect(interpretarComando("O que tenho amanhã?", AGORA)).toEqual({
      intencao: "consultar_agenda",
      dia: "2026-07-04",
    });
  });

  it("'compromissos de sexta' (hoje=quinta)", () => {
    expect(interpretarComando("compromissos de sexta", QUINTA)).toEqual({
      intencao: "consultar_agenda",
      dia: "2026-07-03",
    });
  });

  it("'agenda do dia 10'", () => {
    expect(interpretarComando("agenda do dia 10", AGORA)).toEqual({
      intencao: "consultar_agenda",
      dia: "2026-07-10",
    });
  });
});

describe("interpretarComando — criar_evento", () => {
  it("visita completa: contato, local, data e hora", () => {
    expect(
      interpretarComando("agendar visita com Sofia amanhã às 15h no Térreo", AGORA),
    ).toEqual({
      intencao: "criar_evento",
      titulo: "Visita com Sofia",
      tipo: "visita",
      inicioISO: "2026-07-04T15:00:00-03:00",
      local: "Térreo",
      contato: "Sofia",
    });
  });

  it("reunião com dia da semana e hora com minutos (hoje=quinta)", () => {
    expect(interpretarComando("Marcar reunião com Carlos sexta às 10h30", QUINTA)).toEqual({
      intencao: "criar_evento",
      titulo: "Reunião com Carlos",
      tipo: "reuniao",
      inicioISO: "2026-07-03T10:30:00-03:00",
      contato: "Carlos",
    });
  });

  it("visita sem verbo nem contato: 'visita ao apartamento do Itaim sábado 9h'", () => {
    expect(interpretarComando("visita ao apartamento do Itaim sábado 9h", AGORA)).toEqual({
      intencao: "criar_evento",
      titulo: "Visita — apartamento do Itaim",
      tipo: "visita",
      inicioISO: "2026-07-04T09:00:00-03:00",
      local: "apartamento do Itaim",
    });
  });

  it("compromisso sem hora ⇒ default 9h; artigo antes do nome é removido", () => {
    expect(interpretarComando("marca um compromisso com a Patricia segunda", AGORA)).toEqual({
      intencao: "criar_evento",
      titulo: "Compromisso com Patricia",
      tipo: "compromisso",
      inicioISO: "2026-07-06T09:00:00-03:00",
      contato: "Patricia",
    });
  });

  it("verbo de agendar sem tipo ⇒ compromisso", () => {
    expect(interpretarComando("agendar com a Sofia amanhã", AGORA)).toEqual({
      intencao: "criar_evento",
      titulo: "Compromisso com Sofia",
      tipo: "compromisso",
      inicioISO: "2026-07-04T09:00:00-03:00",
      contato: "Sofia",
    });
  });

  it("tudo em maiúsculas e com acentos", () => {
    const cmd = interpretarComando("AGENDAR VISITA COM SOFIA AMANHÃ ÀS 15H", AGORA);
    expect(cmd).toMatchObject({
      intencao: "criar_evento",
      tipo: "visita",
      inicioISO: "2026-07-04T15:00:00-03:00",
      contato: "SOFIA",
    });
  });
});

describe("interpretarComando — criar_lembrete", () => {
  it("'me lembra de <ação> amanhã às 9h'", () => {
    expect(interpretarComando("me lembra de enviar o contrato amanhã às 9h", AGORA)).toEqual({
      intencao: "criar_lembrete",
      titulo: "enviar o contrato",
      inicioISO: "2026-07-04T09:00:00-03:00",
    });
  });

  it("'lembrete: <ação> sexta' (sem hora ⇒ 9h; hoje=quinta)", () => {
    expect(interpretarComando("Lembrete: ligar para a construtora sexta", QUINTA)).toEqual({
      intencao: "criar_lembrete",
      titulo: "ligar para a construtora",
      inicioISO: "2026-07-03T09:00:00-03:00",
    });
  });

  it("'não me deixa esquecer de <ação>' preserva caixa do título", () => {
    expect(
      interpretarComando("Não me deixa esquecer de pagar o IPTU hoje às 17h", AGORA),
    ).toEqual({
      intencao: "criar_lembrete",
      titulo: "pagar o IPTU",
      inicioISO: "2026-07-03T17:00:00-03:00",
    });
  });
});

describe("interpretarComando — criar_tarefa", () => {
  it("tarefa com negócio e vencimento", () => {
    expect(
      interpretarComando("criar tarefa enviar documentos no negócio da Sofia para amanhã", AGORA),
    ).toEqual({
      intencao: "criar_tarefa",
      titulo: "enviar documentos",
      contato: "Sofia",
      venceEm: "2026-07-04",
    });
  });

  it("'Tarefa: ligar para <contato> sexta' (hoje=quinta)", () => {
    expect(interpretarComando("Tarefa: ligar para Camila sexta", QUINTA)).toEqual({
      intencao: "criar_tarefa",
      titulo: "ligar para Camila",
      contato: "Camila",
      venceEm: "2026-07-03",
    });
  });

  it("tarefa mínima: só título", () => {
    expect(interpretarComando("criar tarefa revisar contrato", AGORA)).toEqual({
      intencao: "criar_tarefa",
      titulo: "revisar contrato",
    });
  });
});

describe("interpretarComando — criar_negocio", () => {
  it("'novo negocio com <nome> de 450 mil' ⇒ valor em centavos", () => {
    expect(interpretarComando("novo negocio com Ana Paula de 450 mil", AGORA)).toEqual({
      intencao: "criar_negocio",
      contato: "Ana Paula",
      valor: 45_000_000,
    });
  });

  it("negócio com valor em milhão e origem", () => {
    expect(
      interpretarComando(
        "criar negócio para João, apartamento, 1,2 milhão, origem instagram",
        AGORA,
      ),
    ).toEqual({
      intencao: "criar_negocio",
      contato: "João",
      valor: 120_000_000,
      origem: "instagram",
    });
  });

  it("'cadastra o cliente <nome> no crm' sem valor", () => {
    expect(interpretarComando("cadastra o cliente Rafael no crm", AGORA)).toEqual({
      intencao: "criar_negocio",
      contato: "Rafael",
    });
  });
});

describe("interpretarComando — registrar_nota", () => {
  it("'anota no negocio da <contato>: <nota>'", () => {
    expect(interpretarComando("Anota no negócio da Sofia: prefere andar alto", AGORA)).toEqual({
      intencao: "registrar_nota",
      contato: "Sofia",
      nota: "prefere andar alto",
    });
  });

  it("'registra que a <contato> <nota>'", () => {
    expect(interpretarComando("registra que a Camila pediu proposta revisada", AGORA)).toEqual({
      intencao: "registrar_nota",
      contato: "Camila",
      nota: "pediu proposta revisada",
    });
  });

  it("'anota no negocio da <contato> que <nota>'", () => {
    expect(
      interpretarComando("anota no negócio da Larissa que ela quer 3 quartos", AGORA),
    ).toEqual({
      intencao: "registrar_nota",
      contato: "Larissa",
      nota: "ela quer 3 quartos",
    });
  });
});

describe("interpretarComando — consultar_avisos", () => {
  it("'avisos importantes'", () => {
    expect(interpretarComando("avisos importantes", AGORA)).toEqual({
      intencao: "consultar_avisos",
    });
  });

  it("'o que preciso fazer agora?'", () => {
    expect(interpretarComando("o que preciso fazer agora?", AGORA)).toEqual({
      intencao: "consultar_avisos",
    });
  });

  it("'Prioridades'", () => {
    expect(interpretarComando("Prioridades", AGORA)).toEqual({ intencao: "consultar_avisos" });
  });

  it("'Onde devo agir?'", () => {
    expect(interpretarComando("Onde devo agir?", AGORA)).toEqual({
      intencao: "consultar_avisos",
    });
  });
});

describe("interpretarComando — ajuda (fallback)", () => {
  it("texto sem sentido cai em ajuda com motivo", () => {
    const cmd = interpretarComando("banana quântica dançante", AGORA);
    expect(cmd.intencao).toBe("ajuda");
    if (cmd.intencao === "ajuda") expect(cmd.motivo).toBeTruthy();
  });

  it("comando vazio cai em ajuda", () => {
    expect(interpretarComando("   ", AGORA).intencao).toBe("ajuda");
  });
});

describe("descreverComando", () => {
  it("evento: dia da semana, data curta, hora e local", () => {
    const cmd = interpretarComando("agendar visita com Sofia amanhã às 15h no Térreo", AGORA);
    const frase = descreverComando(cmd);
    expect(frase).toContain("visita com Sofia");
    expect(frase).toContain("sáb, 4 de jul");
    expect(frase).toContain("15h");
    expect(frase).toContain("Térreo");
  });

  it("negócio: formata o valor em reais", () => {
    const frase = descreverComando({
      intencao: "criar_negocio",
      contato: "Ana Paula",
      valor: 45_000_000,
    });
    expect(frase).toContain("Ana Paula");
    expect(frase).toContain("450.000,00");
  });

  it("agenda: data curta com dia da semana", () => {
    const frase = descreverComando({ intencao: "consultar_agenda", dia: "2026-07-03" });
    expect(frase).toContain("sex, 3 de jul");
  });

  it("tarefa: título, contato e vencimento", () => {
    const frase = descreverComando({
      intencao: "criar_tarefa",
      titulo: "ligar para Camila",
      contato: "Camila",
      venceEm: "2026-07-06",
    });
    expect(frase).toContain('"ligar para Camila"');
    expect(frase).toContain("Camila");
    expect(frase).toContain("seg, 6 de jul");
  });

  it("nota: contato e conteúdo", () => {
    const frase = descreverComando({
      intencao: "registrar_nota",
      contato: "Sofia",
      nota: "prefere andar alto",
    });
    expect(frase).toContain("Sofia");
    expect(frase).toContain("prefere andar alto");
  });

  it("avisos e ajuda", () => {
    expect(descreverComando({ intencao: "consultar_avisos" })).toBe(
      "Mostrar avisos e prioridades",
    );
    expect(descreverComando({ intencao: "ajuda" })).toContain("Não entendi");
  });
});
