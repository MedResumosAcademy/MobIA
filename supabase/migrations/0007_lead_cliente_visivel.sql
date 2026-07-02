-- 0007_lead_cliente_visivel
-- Portão de VISIBILIDADE do cliente para o corretor/gestor no painel de leads.
--
-- Problema: o corretor/gestor precisa exibir o NOME (perfis.nome) e a CAPACIDADE
-- (cliente_profiles.capacidade_calculada) do cliente ao abrir um lead. Mas:
--   - perfis_select só libera o próprio + (gestor/admin da mesma org); o cliente
--     tem perfis.org_id NULL, então nem o gestor o alcança por org.
--   - cliente_profiles_select é SÓ o próprio.
-- Sem furar a RLS, adicionamos policies de SELECT ADICIONAIS (permissivas)
-- restritas a: caller é corretor/gestor E existe um LEAD na org do caller para
-- aquele cliente E o cliente CONSENTIU (privado.cliente_consentiu). Assim a
-- visibilidade acompanha exatamente o portão de consentimento LGPD já vigente
-- em leads/eventos.

-- Helper SECURITY DEFINER: o cliente é visível ao caller (corretor/gestor) porque
-- há um lead consentido ligando-o à org do caller. Roda com search_path vazio.
create or replace function privado.cliente_lead_visivel(p_cliente uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select
    privado.papel_atual() = any (array['corretor','gestor','admin'])
    and privado.cliente_consentiu(p_cliente)
    and exists (
      select 1
        from public.leads l
       where l.cliente_id = p_cliente
         and l.org_id = privado.org_atual()
    );
$$;

revoke all on function privado.cliente_lead_visivel(uuid) from public;
revoke all on function privado.cliente_lead_visivel(uuid) from anon;
grant execute on function privado.cliente_lead_visivel(uuid) to authenticated;

-- perfis: corretor/gestor pode ler o perfil do cliente consentido com lead na sua org.
drop policy if exists perfis_select_lead on public.perfis;
create policy perfis_select_lead on public.perfis
  for select
  to authenticated
  using (privado.cliente_lead_visivel(id));

-- cliente_profiles: idem, para expor nome/capacidade_calculada ao corretor/gestor.
drop policy if exists cliente_profiles_select_lead on public.cliente_profiles;
create policy cliente_profiles_select_lead on public.cliente_profiles
  for select
  to authenticated
  using (privado.cliente_lead_visivel(usuario_id));
