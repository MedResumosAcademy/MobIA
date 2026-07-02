-- Corrige a demo: o mês corrente acabou de começar (dia 02), então "-3 dias"
-- caía no mês anterior. Fecha o negócio ganho de maior valor da org A HOJE,
-- garantindo que o KPI "Ganhos no mês" do dashboard tenha valor na demonstração.

update public.negocios
set fechado_em = now(),
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
