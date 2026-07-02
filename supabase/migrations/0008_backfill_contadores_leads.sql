-- 0008_backfill_contadores_leads
-- Backfill/reconciliação dos contadores de sinais dos leads a partir de eventos.
--
-- Problema (achado QA): eventos semeados diretamente em public.eventos NÃO passam
-- pelo trigger privado.materializar_lead (que é AFTER INSERT). No seed-dev o lead
-- foi inserido explicitamente com eventos_count e os contadores por tipo (visitas,
-- simulacoes, favoritos, cliques_financiamento, retornos) no default 0. Resultado:
-- o único lead consentido (cliente.um no imóvel disponível) aparece no painel do
-- corretor.alfa como 'quente' com score 0, mesmo tendo 2 eventos reais (visita_ficha
-- + simulacao) — o que a timeline (que lê eventos direto) mostra corretamente.
--
-- O trigger em si está CORRETO (UPSERT idempotente na mesma linha). Isto é uma
-- inconsistência de DADOS. Esta migração reconcilia os contadores de TODO lead a
-- partir dos eventos existentes, usando EXATAMENTE o mesmo mapeamento do trigger:
--   visita_ficha, clique     -> visitas
--   simulacao                -> simulacoes
--   favorito                 -> favoritos
--   clique_financiamento     -> cliques_financiamento
--   retorno                  -> retornos
--   (sonhometro_completo etc. não incrementam nenhum contador)
-- e só considera eventos com imovel_id E org_id não nulos (idem trigger).
-- eventos_count = total desses eventos; ultimo_evento_em = max(criado_em).
--
-- Idempotente: recalcula por agregação, não soma incremental. Não cria leads novos
-- (só reconcilia os já materializados). Rodar de novo é seguro (no-op).

with agg as (
  select
    e.org_id,
    e.cliente_id,
    e.imovel_id,
    count(*)                                                              as eventos_count,
    count(*) filter (where e.tipo in ('visita_ficha', 'clique'))         as visitas,
    count(*) filter (where e.tipo = 'simulacao')                         as simulacoes,
    count(*) filter (where e.tipo = 'favorito')                          as favoritos,
    count(*) filter (where e.tipo = 'clique_financiamento')              as cliques_financiamento,
    count(*) filter (where e.tipo = 'retorno')                           as retornos,
    max(e.criado_em)                                                     as ultimo_evento_em
  from public.eventos e
  where e.imovel_id is not null
    and e.org_id is not null
  group by e.org_id, e.cliente_id, e.imovel_id
)
update public.leads l
   set eventos_count         = a.eventos_count,
       visitas               = a.visitas,
       simulacoes            = a.simulacoes,
       favoritos             = a.favoritos,
       cliques_financiamento = a.cliques_financiamento,
       retornos              = a.retornos,
       ultimo_evento_em      = greatest(l.ultimo_evento_em, a.ultimo_evento_em),
       atualizado_em         = now()
  from agg a
 where l.org_id     = a.org_id
   and l.cliente_id = a.cliente_id
   and l.imovel_id  = a.imovel_id
   and (
        l.eventos_count         is distinct from a.eventos_count
     or l.visitas               is distinct from a.visitas
     or l.simulacoes            is distinct from a.simulacoes
     or l.favoritos             is distinct from a.favoritos
     or l.cliques_financiamento is distinct from a.cliques_financiamento
     or l.retornos              is distinct from a.retornos
   );
