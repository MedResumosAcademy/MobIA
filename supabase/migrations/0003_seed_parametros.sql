-- ============================================================================
-- 0003_seed_parametros.sql — Seed da tabela parametros_financeiros (H-05)
--
-- Snapshot PARAMETROS_2026_07 (versão 1, vigência 2026-07-01), gerado a partir
-- de packages/core/src/parametros.ts via JSON.stringify (node
-- --experimental-strip-types) — NÃO editar os números à mão sem conferir
-- contra o TS; o TS é a fonte deste seed até a persistência assumir.
--
-- Semântica dos dados (ver comentários do TS):
--   - Dinheiro em CENTAVOS (ex.: teto MCMV R$ 600.000,00 = 60000000).
--   - Taxas em fração decimal EFETIVA anual (as fontes publicam taxa NOMINAL
--     a.a.; a conversão nominal→efetiva já foi feita ao gravar o snapshot,
--     por isso os valores "quebrados": 0.1178... = nominal 11,19% a.a.).
--   - Modalidades com condicoesAValidar = true têm condições SEM fonte
--     própria confirmada — a UI deve exibir aviso reforçado.
--   - O jsonb `dados` é o objeto ParametrosFinanceiros COMPLETO (inclui
--     versao/vigenciaInicio/fonte também dentro do JSON) — as colunas
--     versao/vigencia_inicio/fonte são espelhos para PK/consulta e DEVEM
--     permanecer consistentes com o conteúdo de `dados`.
-- ============================================================================

insert into public.parametros_financeiros (versao, vigencia_inicio, fonte, dados)
values (
  1,
  date '2026-07-01',
  'Ministério das Cidades (MCMV abr/2026), Caixa/imprensa especializada (SBPE 2026), CMN out/2025 + Conselho Curador FGTS nov/2025 (teto SFH/FGTS)',
  $dados$
{
  "versao": 1,
  "vigenciaInicio": "2026-07-01",
  "fonte": "Ministério das Cidades (MCMV abr/2026), Caixa/imprensa especializada (SBPE 2026), CMN out/2025 + Conselho Curador FGTS nov/2025 (teto SFH/FGTS)",
  "parametrosGerais": {
    "comprometimentoRendaMax": 0.3,
    "idadeMaxMeses": 966,
    "ltvMax": {
      "price": 0.7,
      "sac": 0.8
    },
    "tetoValorImovelParaFgts": 225000000
  },
  "modalidades": {
    "mcmv": {
      "taxaAnualEfetiva": 0.10471306744129683,
      "indexador": "nenhum",
      "prazoMaxMeses": 420,
      "ltvMax": 0.8,
      "tetoValorImovel": {
        "padrao": 60000000
      },
      "faixas": [
        {
          "rendaMensalAte": 320000,
          "taxaAnualEfetiva": 0.043337716309616914,
          "subsidioMax": 5500000,
          "tetoValorImovel": {
            "padrao": 27500000
          }
        },
        {
          "rendaMensalAte": 500000,
          "taxaAnualEfetiva": 0.0722900808562359,
          "subsidioMax": 5500000,
          "tetoValorImovel": {
            "padrao": 27500000
          }
        },
        {
          "rendaMensalAte": 960000,
          "taxaAnualEfetiva": 0.0847220850251531,
          "subsidioMax": 0,
          "tetoValorImovel": {
            "padrao": 40000000
          }
        },
        {
          "rendaMensalAte": 1300000,
          "taxaAnualEfetiva": 0.10471306744129683,
          "subsidioMax": 0
        }
      ],
      "permiteFgts": true,
      "sistemaAmortizacaoPadrao": "sac"
    },
    "sbpe": {
      "taxaAnualEfetiva": 0.11782126000413706,
      "indexador": "tr",
      "prazoMaxMeses": 420,
      "ltvMax": 0.8,
      "permiteFgts": true,
      "sistemaAmortizacaoPadrao": "sac"
    },
    "credito_associativo": {
      "taxaAnualEfetiva": 0.0847220850251531,
      "indexador": "nenhum",
      "prazoMaxMeses": 420,
      "ltvMax": 0.8,
      "tetoValorImovel": {
        "padrao": 60000000
      },
      "faixas": [
        {
          "rendaMensalAte": 320000,
          "taxaAnualEfetiva": 0.043337716309616914,
          "subsidioMax": 5500000,
          "tetoValorImovel": {
            "padrao": 27500000
          }
        },
        {
          "rendaMensalAte": 500000,
          "taxaAnualEfetiva": 0.0722900808562359,
          "subsidioMax": 5500000,
          "tetoValorImovel": {
            "padrao": 27500000
          }
        },
        {
          "rendaMensalAte": 960000,
          "taxaAnualEfetiva": 0.0847220850251531,
          "subsidioMax": 0,
          "tetoValorImovel": {
            "padrao": 40000000
          }
        },
        {
          "rendaMensalAte": 1300000,
          "taxaAnualEfetiva": 0.10471306744129683,
          "subsidioMax": 0
        }
      ],
      "permiteFgts": true,
      "sistemaAmortizacaoPadrao": "sac",
      "condicoesAValidar": true
    },
    "imovel_novo": {
      "taxaAnualEfetiva": 0.11782126000413706,
      "indexador": "tr",
      "prazoMaxMeses": 420,
      "ltvMax": 0.8,
      "permiteFgts": true,
      "sistemaAmortizacaoPadrao": "sac"
    },
    "imovel_usado": {
      "taxaAnualEfetiva": 0.11782126000413706,
      "indexador": "tr",
      "prazoMaxMeses": 420,
      "ltvMax": 0.8,
      "permiteFgts": true,
      "sistemaAmortizacaoPadrao": "sac"
    },
    "terreno_e_construcao": {
      "taxaAnualEfetiva": 0.12671346836001485,
      "indexador": "tr",
      "prazoMaxMeses": 420,
      "ltvMax": 0.8,
      "permiteFgts": true,
      "sistemaAmortizacaoPadrao": "sac",
      "condicoesAValidar": true
    }
  }
}
$dados$::jsonb
);

-- ============================================================================
-- GUIA DO OPERADOR — como atualizar parâmetros SEM deploy (H-05)
--
-- Regra de ouro: mudança de mercado (taxa/teto/faixa nova) = NOVA VERSÃO
-- (INSERT), nunca UPDATE da vigente. Simulações gravam parametros_versao para
-- auditoria — reescrever uma versão já usada quebra a rastreabilidade.
-- UPDATE só para corrigir ERRO DE DIGITAÇÃO em versão recém-publicada.
--
-- As taxas são EFETIVAS anuais. Fonte nominal (Caixa/portarias)? Converta
-- antes: efetiva = (1 + nominal/12)^12 - 1. Ex.: nominal 11,49% a.a.:
--   select power(1 + 0.1149 / 12, 12) - 1;  -- => 0.1211...
--
-- Exemplo 1 (RECOMENDADO) — publicar a versão 2 com a nova taxa balcão SBPE,
-- partindo da versão 1 e mantendo colunas-espelho e JSON consistentes:
--
--   insert into public.parametros_financeiros (versao, vigencia_inicio, fonte, dados)
--   select
--     2,
--     date '2026-10-01',
--     'Caixa — taxa balcão out/2026',
--     jsonb_set(
--       jsonb_set(
--         jsonb_set(
--           jsonb_set(dados, '{versao}', to_jsonb(2)),
--           '{vigenciaInicio}', to_jsonb(text '2026-10-01')),
--         '{fonte}', to_jsonb(text 'Caixa — taxa balcão out/2026')),
--       '{modalidades,sbpe,taxaAnualEfetiva}', to_jsonb(power(1 + 0.1149 / 12, 12) - 1))
--   from public.parametros_financeiros
--   where versao = 1;
--
--   A partir da vigência, o motor passa a usar a versão 2 nas novas simulações
--   (obterParametrosVigentes seleciona a maior vigencia_inicio <= hoje) — sem
--   build, sem deploy.
--
-- Exemplo 2 — corrigir um teto digitado errado na versão vigente (APENAS erro
-- de digitação; lembre: valores em CENTAVOS — R$ 620.000 = 62000000):
--
--   update public.parametros_financeiros
--   set dados = jsonb_set(dados, '{modalidades,mcmv,tetoValorImovel,padrao}',
--                         to_jsonb(62000000))
--   where versao = 1;
--
-- Exemplo 3 — alterar o subsídio máximo da Faixa 1 do MCMV (arrays são
-- indexados a partir de 0; Faixa 1 = índice 0):
--
--   update public.parametros_financeiros
--   set dados = jsonb_set(dados, '{modalidades,mcmv,faixas,0,subsidioMax}',
--                         to_jsonb(6000000))  -- R$ 60.000,00
--   where versao = 1;
--
-- Conferência rápida após qualquer mudança:
--
--   select versao, vigencia_inicio,
--          dados -> 'modalidades' -> 'sbpe' ->> 'taxaAnualEfetiva' as sbpe,
--          dados -> 'modalidades' -> 'mcmv' -> 'tetoValorImovel' ->> 'padrao' as teto_mcmv
--   from public.parametros_financeiros
--   order by vigencia_inicio desc;
-- ============================================================================
