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

describe("interpretarComando — mudar_etapa", () => {
  it("'move o negócio da Sofia para visita'", () => {
    expect(interpretarComando("move o negócio da Sofia para visita", AGORA)).toEqual({
      intencao: "mudar_etapa",
      contato: "Sofia",
      etapa: "visita",
    });
  });

  it("'passa a Larissa pra proposta'", () => {
    expect(interpretarComando("passa a Larissa pra proposta", AGORA)).toEqual({
      intencao: "mudar_etapa",
      contato: "Larissa",
      etapa: "proposta",
    });
  });

  it("'coloca o Carlos em fechamento'", () => {
    expect(interpretarComando("coloca o Carlos em fechamento", AGORA)).toEqual({
      intencao: "mudar_etapa",
      contato: "Carlos",
      etapa: "fechamento",
    });
  });

  it("sujeito: 'a Larissa foi para proposta'", () => {
    expect(interpretarComando("a Larissa foi para proposta", AGORA)).toEqual({
      intencao: "mudar_etapa",
      contato: "Larissa",
      etapa: "proposta",
    });
  });

  it("sujeito com negócio: 'o negócio da Camila passou pra fechamento'", () => {
    expect(interpretarComando("o negócio da Camila passou pra fechamento", AGORA)).toEqual({
      intencao: "mudar_etapa",
      contato: "Camila",
      etapa: "fechamento",
    });
  });

  it("'avança o negócio da Patricia' ⇒ próxima etapa", () => {
    expect(interpretarComando("avança o negócio da Patricia", AGORA)).toEqual({
      intencao: "mudar_etapa",
      contato: "Patricia",
      etapa: "proxima",
    });
  });

  it("'passa a Sofia para a próxima etapa' ⇒ proxima", () => {
    expect(interpretarComando("passa a Sofia para a próxima etapa", AGORA)).toEqual({
      intencao: "mudar_etapa",
      contato: "Sofia",
      etapa: "proxima",
    });
  });

  it("sinônimos: 'início' ⇒ novo; 'fechar' ⇒ fechamento (caixa/acento)", () => {
    expect(interpretarComando("muda a Camila para o início", AGORA)).toEqual({
      intencao: "mudar_etapa",
      contato: "Camila",
      etapa: "novo",
    });
    expect(interpretarComando("MOVE A SOFIA PARA FECHAR", AGORA)).toEqual({
      intencao: "mudar_etapa",
      contato: "SOFIA",
      etapa: "fechamento",
    });
  });

  it("fronteira: 'cria uma tarefa: mover a Sofia para proposta' continua criar_tarefa", () => {
    expect(interpretarComando("cria uma tarefa: mover a Sofia para proposta", AGORA)).toEqual({
      intencao: "criar_tarefa",
      titulo: "mover a Sofia para proposta",
    });
  });

  it("fronteira: 'me lembra de passar a Sofia para proposta amanhã' continua lembrete", () => {
    expect(
      interpretarComando("me lembra de passar a Sofia para proposta amanhã", AGORA),
    ).toEqual({
      intencao: "criar_lembrete",
      titulo: "passar a Sofia para proposta",
      inicioISO: "2026-07-04T09:00:00-03:00",
    });
  });
});

describe("interpretarComando — marcar_resultado", () => {
  it("'fechei com a Sofia' ⇒ ganho sem valor", () => {
    expect(interpretarComando("fechei com a Sofia", AGORA)).toEqual({
      intencao: "marcar_resultado",
      contato: "Sofia",
      resultado: "ganho",
    });
  });

  it("'Fechei com a Sofia por 480 mil' ⇒ ganho com valor em centavos", () => {
    expect(interpretarComando("Fechei com a Sofia por 480 mil", AGORA)).toEqual({
      intencao: "marcar_resultado",
      contato: "Sofia",
      resultado: "ganho",
      valor: 48_000_000,
    });
  });

  it("'ganhei o negócio do Carlos'", () => {
    expect(interpretarComando("ganhei o negócio do Carlos", AGORA)).toEqual({
      intencao: "marcar_resultado",
      contato: "Carlos",
      resultado: "ganho",
    });
  });

  it("'vendi o Carlos'", () => {
    expect(interpretarComando("vendi o Carlos", AGORA)).toEqual({
      intencao: "marcar_resultado",
      contato: "Carlos",
      resultado: "ganho",
    });
  });

  it("'venda concluída com a Maria por 1,2 milhão'", () => {
    expect(interpretarComando("venda concluída com a Maria por 1,2 milhão", AGORA)).toEqual({
      intencao: "marcar_resultado",
      contato: "Maria",
      resultado: "ganho",
      valor: 120_000_000,
    });
  });

  it("'Vendemos pra Maria Souza por 1,2 milhão' (plural + nome composto)", () => {
    expect(interpretarComando("Vendemos pra Maria Souza por 1,2 milhão", AGORA)).toEqual({
      intencao: "marcar_resultado",
      contato: "Maria Souza",
      resultado: "ganho",
      valor: 120_000_000,
    });
  });

  it("'perdemos a Larissa' ⇒ perdido", () => {
    expect(interpretarComando("perdemos a Larissa", AGORA)).toEqual({
      intencao: "marcar_resultado",
      contato: "Larissa",
      resultado: "perdido",
    });
  });

  it("'o João desistiu' ⇒ perdido", () => {
    expect(interpretarComando("o João desistiu", AGORA)).toEqual({
      intencao: "marcar_resultado",
      contato: "João",
      resultado: "perdido",
    });
  });

  it("'a Camila cancelou' ⇒ perdido", () => {
    expect(interpretarComando("a Camila cancelou", AGORA)).toEqual({
      intencao: "marcar_resultado",
      contato: "Camila",
      resultado: "perdido",
    });
  });

  it("fronteira: 'registra que a Camila cancelou' continua registrar_nota", () => {
    expect(interpretarComando("registra que a Camila cancelou", AGORA)).toEqual({
      intencao: "registrar_nota",
      contato: "Camila",
      nota: "cancelou",
    });
  });

  it("fronteira: 'me lembra que fechei com a Sofia' continua lembrete", () => {
    expect(interpretarComando("me lembra que fechei com a Sofia", AGORA).intencao).toBe(
      "criar_lembrete",
    );
  });
});

describe("interpretarComando — atualizar_valor", () => {
  it("'muda o valor do negócio da Sofia para 500 mil'", () => {
    expect(interpretarComando("muda o valor do negócio da Sofia para 500 mil", AGORA)).toEqual({
      intencao: "atualizar_valor",
      contato: "Sofia",
      valor: 50_000_000,
    });
  });

  it("'atualiza o valor da proposta do Henrique para 950 mil'", () => {
    expect(
      interpretarComando("atualiza o valor da proposta do Henrique para 950 mil", AGORA),
    ).toEqual({
      intencao: "atualizar_valor",
      contato: "Henrique",
      valor: 95_000_000,
    });
  });

  it("'o negócio do Carlos agora é 1,2 milhão'", () => {
    expect(interpretarComando("o negócio do Carlos agora é 1,2 milhão", AGORA)).toEqual({
      intencao: "atualizar_valor",
      contato: "Carlos",
      valor: 120_000_000,
    });
  });

  it("fronteira: 'muda a Sofia para contato' é mudar_etapa, não atualizar_valor", () => {
    expect(interpretarComando("muda a Sofia para contato", AGORA)).toEqual({
      intencao: "mudar_etapa",
      contato: "Sofia",
      etapa: "contato",
    });
  });

  it("fronteira: 'novo negocio com Ana Paula de 450 mil' continua criar_negocio", () => {
    expect(interpretarComando("novo negocio com Ana Paula de 450 mil", AGORA).intencao).toBe(
      "criar_negocio",
    );
  });
});

describe("interpretarComando — atualizar_contato_info", () => {
  it("'o telefone da Sofia é (11) 98888-7777' ⇒ telefone só com dígitos", () => {
    expect(interpretarComando("o telefone da Sofia é (11) 98888-7777", AGORA)).toEqual({
      intencao: "atualizar_contato_info",
      contato: "Sofia",
      telefone: "11988887777",
    });
  });

  it("'anota o telefone da Patricia: 11 97777-1234'", () => {
    expect(interpretarComando("anota o telefone da Patricia: 11 97777-1234", AGORA)).toEqual({
      intencao: "atualizar_contato_info",
      contato: "Patricia",
      telefone: "11977771234",
    });
  });

  it("'O WhatsApp da Camila mudou para 21 99999-0000'", () => {
    expect(interpretarComando("O WhatsApp da Camila mudou para 21 99999-0000", AGORA)).toEqual({
      intencao: "atualizar_contato_info",
      contato: "Camila",
      telefone: "21999990000",
    });
  });

  it("'anota o email do Carlos: carlos@exemplo.com'", () => {
    expect(interpretarComando("anota o email do Carlos: carlos@exemplo.com", AGORA)).toEqual({
      intencao: "atualizar_contato_info",
      contato: "Carlos",
      email: "carlos@exemplo.com",
    });
  });

  it("'o e-mail da Sofia é sofia.almeida@exemplo.com.br' (domínio composto)", () => {
    expect(
      interpretarComando("o e-mail da Sofia é sofia.almeida@exemplo.com.br", AGORA),
    ).toEqual({
      intencao: "atualizar_contato_info",
      contato: "Sofia",
      email: "sofia.almeida@exemplo.com.br",
    });
  });

  it("fronteira: 'anota no negócio da Sofia: email novo do porteiro' continua nota", () => {
    expect(
      interpretarComando("anota no negócio da Sofia: email novo do porteiro", AGORA),
    ).toEqual({
      intencao: "registrar_nota",
      contato: "Sofia",
      nota: "email novo do porteiro",
    });
  });

  it("sem telefone nem email reconhecíveis ⇒ ajuda", () => {
    expect(interpretarComando("o telefone da Sofia é antigo", AGORA).intencao).toBe("ajuda");
  });
});

describe("interpretarComando — concluir_tarefa", () => {
  it("'conclui a tarefa de ligar para a Sofia' ⇒ título + contato", () => {
    expect(interpretarComando("conclui a tarefa de ligar para a Sofia", AGORA)).toEqual({
      intencao: "concluir_tarefa",
      titulo: "ligar para a Sofia",
      contato: "Sofia",
    });
  });

  it("'Terminei a tarefa enviar proposta' ⇒ só título", () => {
    expect(interpretarComando("Terminei a tarefa enviar proposta", AGORA)).toEqual({
      intencao: "concluir_tarefa",
      titulo: "enviar proposta",
    });
  });

  it("'Já fiz a tarefa de ligar para a Patricia'", () => {
    expect(interpretarComando("Já fiz a tarefa de ligar para a Patricia", AGORA)).toEqual({
      intencao: "concluir_tarefa",
      titulo: "ligar para a Patricia",
      contato: "Patricia",
    });
  });

  it("'marca como feita a tarefa enviar proposta'", () => {
    expect(interpretarComando("marca como feita a tarefa enviar proposta", AGORA)).toEqual({
      intencao: "concluir_tarefa",
      titulo: "enviar proposta",
    });
  });

  it("'marca a tarefa ligar pra Camila como concluída'", () => {
    expect(interpretarComando("marca a tarefa ligar pra Camila como concluída", AGORA)).toEqual({
      intencao: "concluir_tarefa",
      titulo: "ligar pra Camila",
      contato: "Camila",
    });
  });

  it("'Tarefa da Patricia concluída' ⇒ só contato", () => {
    expect(interpretarComando("Tarefa da Patricia concluída", AGORA)).toEqual({
      intencao: "concluir_tarefa",
      contato: "Patricia",
    });
  });

  it("'conclui a tarefa da Camila' ⇒ só contato", () => {
    expect(interpretarComando("conclui a tarefa da Camila", AGORA)).toEqual({
      intencao: "concluir_tarefa",
      contato: "Camila",
    });
  });

  it("fronteira: 'criar tarefa revisar contrato' continua criar_tarefa", () => {
    expect(interpretarComando("criar tarefa revisar contrato", AGORA)).toEqual({
      intencao: "criar_tarefa",
      titulo: "revisar contrato",
    });
  });
});

describe("descreverComando — novas intenções", () => {
  it("mudar_etapa: contato e rótulo da etapa", () => {
    const frase = descreverComando({ intencao: "mudar_etapa", contato: "Sofia", etapa: "visita" });
    expect(frase).toContain("Sofia");
    expect(frase).toContain("Visita");
  });

  it("mudar_etapa proxima: fala em próxima etapa", () => {
    const frase = descreverComando({
      intencao: "mudar_etapa",
      contato: "Patricia",
      etapa: "proxima",
    });
    expect(frase).toContain("Patricia");
    expect(frase).toContain("próxima etapa");
  });

  it("marcar_resultado ganho com valor em reais", () => {
    const frase = descreverComando({
      intencao: "marcar_resultado",
      contato: "Sofia",
      resultado: "ganho",
      valor: 48_000_000,
    });
    expect(frase).toContain("Sofia");
    expect(frase).toContain("ganho");
    expect(frase).toContain("480.000,00");
  });

  it("marcar_resultado perdido", () => {
    const frase = descreverComando({
      intencao: "marcar_resultado",
      contato: "Larissa",
      resultado: "perdido",
    });
    expect(frase).toContain("Larissa");
    expect(frase).toContain("perdido");
  });

  it("atualizar_valor: valor formatado em reais", () => {
    const frase = descreverComando({
      intencao: "atualizar_valor",
      contato: "Sofia",
      valor: 50_000_000,
    });
    expect(frase).toContain("Sofia");
    expect(frase).toContain("500.000,00");
  });

  it("atualizar_contato_info: telefone formatado e email", () => {
    const frase = descreverComando({
      intencao: "atualizar_contato_info",
      contato: "Sofia",
      telefone: "11988887777",
      email: "sofia@exemplo.com",
    });
    expect(frase).toContain("Sofia");
    expect(frase).toContain("(11) 98888-7777");
    expect(frase).toContain("sofia@exemplo.com");
  });

  it("concluir_tarefa: título e contato", () => {
    const frase = descreverComando({
      intencao: "concluir_tarefa",
      titulo: "enviar proposta",
      contato: "Sofia",
    });
    expect(frase).toContain("Concluir tarefa");
    expect(frase).toContain('"enviar proposta"');
    expect(frase).toContain("Sofia");
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
