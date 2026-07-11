-- 0025 — Performance (get_advisors, 2ª rodada): índices em FKs de caminhos
-- QUENTES reais. Puramente aditiva — zero mudança de semântica/RLS.
--
-- Nota: a consolidação de policies permissivas duplicadas (imoveis/perfis/
-- unidades/cliente_profiles) já foi feita na 0024 e continua válida (conferido
-- em pg_policies: uma policy permissiva por role+cmd em cada tabela).
--
-- Critério (queries reais de apps/web/lib/dados):
--   seguidores.seguido_id        → .eq("seguido_id") em comunidade.ts
--                                  (contagem de seguidores e checagem de follow)
--   depoimentos.org_id           → RLS org_id = privado.org_atual() avaliada em
--                                  toda leitura/escrita de depoimentos (perfil.ts)
--   negocio_atividades.org_id    → RLS org_id = privado.org_atual() em toda
--                                  leitura da timeline (negocios.ts)
--   favoritos.unidade_id,
--   negocios.unidade_id,
--   simulacoes.unidade_id        → checagem referencial ao deletar unidade
--                                  (removerUnidade em lib/dados/imoveis.ts):
--                                  sem índice, cada delete varre a tabela toda.
--
-- FKs flagados mas SEM caminho quente (deixados de fora de propósito):
--   metas.definido_por, newsletter_edicoes.autor_id, negocio_atividades.autor_id,
--   negocios.imovel_id, publicacoes.imovel_id, simulacoes.cliente_id,
--   privado.convites.* — nenhum filtro direto, nenhuma RLS por essas colunas e
--   as tabelas referenciadas (perfis/imoveis) não são deletadas pelo app.

create index if not exists seguidores_seguido_id_idx
  on public.seguidores (seguido_id);
create index if not exists depoimentos_org_id_idx
  on public.depoimentos (org_id);
create index if not exists negocio_atividades_org_id_idx
  on public.negocio_atividades (org_id);
create index if not exists favoritos_unidade_id_idx
  on public.favoritos (unidade_id);
create index if not exists negocios_unidade_id_idx
  on public.negocios (unidade_id);
create index if not exists simulacoes_unidade_id_idx
  on public.simulacoes (unidade_id);
