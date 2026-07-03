// Template de E-MAIL da newsletter (ESCOPO §V2, item 16) — função PURA.
// Gera HTML e-mail-safe: layout em <table>, largura 600px, estilos inline,
// paleta quente da marca (#DB6414 laranja / #F2A93B âmbar). Sem dependência de
// Next/Supabase — testável isoladamente. Todo texto vindo do usuário passa por
// escape de HTML (título/assunto/introdução/cidade são entrada livre).

import { formatarReais } from "@imobia/core";

/** Base pública do site — links dos cards apontam para a ficha do imóvel. */
export const BASE_URL_SITE = "https://mob-ia.vercel.app";

export type EdicaoParaEmail = {
  titulo: string;
  introducao?: string | null;
};

export type ImovelParaEmail = {
  id: string;
  titulo: string;
  cidade: string;
  uf: string;
  /** Valor em CENTAVOS (convenção do produto). */
  valor: number;
  /** URL pública da foto de capa — null quando não há foto. */
  fotoCapa: string | null;
};

/** Escapa entidades HTML — obrigatório para qualquer texto do usuário. */
export function escaparHtml(texto: string): string {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const COR_MARCA = "#DB6414";
const COR_AMBAR = "#F2A93B";
const COR_TINTA = "#2B2118";
const COR_TEXTO = "#6B6257";
const COR_SUAVE = "#8A857C";
const COR_FUNDO = "#FAF6F0";

function cardImovelHtml(imovel: ImovelParaEmail): string {
  const url = `${BASE_URL_SITE}/imoveis/${imovel.id}`;
  const foto = imovel.fotoCapa
    ? `<a href="${url}" style="text-decoration:none;"><img src="${imovel.fotoCapa}" alt="${escaparHtml(imovel.titulo)}" width="552" style="display:block;width:100%;max-width:552px;height:auto;border-radius:12px 12px 0 0;" /></a>`
    : "";
  return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;border:1px solid #EBE3D7;border-radius:12px;background-color:#FFFFFF;">
          <tr><td>${foto}</td></tr>
          <tr>
            <td style="padding:16px 20px 18px 20px;">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:${COR_TINTA};">${escaparHtml(imovel.titulo)}</p>
              <p style="margin:4px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${COR_SUAVE};">${escaparHtml(imovel.cidade)}/${escaparHtml(imovel.uf)}</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:bold;color:${COR_MARCA};">${formatarReais(imovel.valor)}</td>
                  <td align="right">
                    <a href="${url}" style="display:inline-block;padding:8px 18px;border-radius:999px;background-color:${COR_MARCA};font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#FFFFFF;text-decoration:none;">Ver imóvel</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>`;
}

/**
 * HTML completo da edição (e-mail-safe). Até 6 cards de imóvel; rodapé com o
 * aviso LGPD ("você recebe porque se inscreveu") e mailto de cancelamento.
 */
export function gerarHtmlEdicao(
  edicao: EdicaoParaEmail,
  imoveis: ImovelParaEmail[],
): string {
  const titulo = escaparHtml(edicao.titulo);
  const introducao = edicao.introducao?.trim()
    ? `<p style="margin:12px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:${COR_TEXTO};">${escaparHtml(edicao.introducao.trim())}</p>`
    : "";
  const cards = imoveis.slice(0, 6).map(cardImovelHtml).join("\n");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${titulo}</title>
</head>
<body style="margin:0;padding:0;background-color:${COR_FUNDO};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COR_FUNDO};">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;">
          <!-- Filete da marca -->
          <tr><td style="height:5px;background-color:${COR_MARCA};border-radius:16px 16px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>
          <!-- Cabeçalho: wordmark ImobIA em texto -->
          <tr>
            <td style="background-color:#FFFFFF;padding:28px 32px 8px 32px;">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:bold;letter-spacing:-0.5px;"><span style="color:${COR_TINTA};">Imob</span><span style="color:${COR_MARCA};">IA</span></p>
            </td>
          </tr>
          <!-- Título + introdução -->
          <tr>
            <td style="background-color:#FFFFFF;padding:12px 32px 20px 32px;">
              <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:34px;color:${COR_TINTA};">${titulo}</h1>
              ${introducao}
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
                <tr><td style="height:2px;background-color:${COR_AMBAR};font-size:0;line-height:0;">&nbsp;</td></tr>
              </table>
            </td>
          </tr>
          <!-- Cards de imóveis -->
          <tr>
            <td style="background-color:#FFFFFF;padding:4px 24px 8px 24px;">
${cards}
            </td>
          </tr>
          <!-- Rodapé LGPD -->
          <tr>
            <td style="background-color:#FFFFFF;padding:20px 32px 28px 32px;border-radius:0 0 16px 16px;border-top:1px solid #EBE3D7;">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:${COR_SUAVE};">
                Você recebe este e-mail porque se inscreveu na newsletter da ImobIA
                e consentiu em receber novidades e oportunidades.
              </p>
              <p style="margin:8px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${COR_SUAVE};">
                Não quer mais receber?
                <a href="mailto:contato@imobia.com.br?subject=Cancelar%20inscri%C3%A7%C3%A3o%20na%20newsletter" style="color:${COR_MARCA};text-decoration:underline;">Cancelar inscrição</a>
              </p>
              <p style="margin:12px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${COR_SUAVE};">© ImobIA — <a href="${BASE_URL_SITE}" style="color:${COR_SUAVE};text-decoration:underline;">mob-ia.vercel.app</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
