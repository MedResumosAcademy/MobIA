-- Ajuste de dado de DEMONSTRAÇÃO: re-data o negócio ganho de maior valor da org A
-- para o mês corrente, de modo que o KPI "Ganhos no mês" do dashboard gerencial
-- não nasça zerado numa demo. Mantém um ciclo de venda realista (~25 dias).

update public.negocios
set fechado_em = now() - interval '3 days',
    criado_em = least(criado_em, now() - interval '25 days'),
    atualizado_em = now()
where id = (
  select id
  from public.negocios
  where org_id = '11111111-1111-4111-8111-111111111111'
    and resultado = 'ganho'
  order by valor desc nulls last
  limit 1
);
