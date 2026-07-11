// Testes do template de e-mail da newsletter — a ÚNICA barreira contra XSS
// no HTML que vai para o e-mail do inscrito e para o preview do gestor.
// Função pura: sem mock de banco.
import { describe, expect, it } from "vitest";
import {
  BASE_URL_SITE,
  escaparHtml,
  gerarHtmlEdicao,
  type ImovelParaEmail,
} from "@/lib/email/newsletter-html";

function imovel(sobrescreve: Partial<ImovelParaEmail> = {}): ImovelParaEmail {
  return {
    id: "imv-1",
    titulo: "Apartamento no Centro",
    cidade: "Curitiba",
    uf: "PR",
    valor: 85_000_000,
    fotoCapa: "https://cdn.exemplo.com/capa.jpg",
    ...sobrescreve,
  };
}

describe("escaparHtml", () => {
  it("escapa as 5 entidades HTML", () => {
    expect(escaparHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });

  it("não altera texto comum (acentos incluídos)", () => {
    expect(escaparHtml("Edição de julho — imóveis")).toBe("Edição de julho — imóveis");
  });
});

describe("gerarHtmlEdicao", () => {
  it("nunca deixa <script> do título do gestor cru no HTML", () => {
    const html = gerarHtmlEdicao(
      { titulo: "<script>alert(1)</script>" },
      [imovel({ titulo: "<b>negrito</b>" })],
    );
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<b>negrito</b>");
  });

  it("omite o parágrafo de introdução quando null, vazia ou só espaços", () => {
    for (const introducao of [null, "", "   "]) {
      const html = gerarHtmlEdicao({ titulo: "Edição", introducao }, []);
      expect(html).not.toContain("line-height:24px");
    }
    const comIntro = gerarHtmlEdicao({ titulo: "Edição", introducao: "Olá!" }, []);
    expect(comIntro).toContain("Olá!");
  });

  it("corta em 6 cards de imóvel", () => {
    const oito = Array.from({ length: 8 }, (_, i) =>
      imovel({ id: `imv-${i}`, titulo: `Imóvel ${i}` }),
    );
    const html = gerarHtmlEdicao({ titulo: "Edição" }, oito);
    const cards = html.match(/Ver imóvel/g) ?? [];
    expect(cards).toHaveLength(6);
    expect(html).not.toContain("Imóvel 6");
    expect(html).not.toContain("Imóvel 7");
  });

  it("fotoCapa null omite a <img> do card", () => {
    const html = gerarHtmlEdicao({ titulo: "Edição" }, [imovel({ fotoCapa: null })]);
    expect(html).not.toContain("<img");
  });

  it("renderiza o valor em CENTAVOS como reais formatados", () => {
    const html = gerarHtmlEdicao({ titulo: "Edição" }, [imovel({ valor: 85_000_000 })]);
    // Espaço do Intl entre "R$" e o número pode ser não separável (NBSP).
    expect(html).toMatch(/R\$\s*850\.000,00/);
  });

  it("REGRESSÃO: fotoCapa com aspas não escapa do atributo src", () => {
    const html = gerarHtmlEdicao({ titulo: "Edição" }, [
      imovel({ fotoCapa: 'https://x.com/a.jpg?" onload="x' }),
    ]);
    expect(html).not.toContain('" onload=');
    expect(html).toContain("&quot; onload=&quot;x");
  });

  it("links dos cards apontam para a ficha pública do imóvel", () => {
    const html = gerarHtmlEdicao({ titulo: "Edição" }, [imovel({ id: "abc-123" })]);
    expect(html).toContain(`${BASE_URL_SITE}/imoveis/abc-123`);
  });
});
