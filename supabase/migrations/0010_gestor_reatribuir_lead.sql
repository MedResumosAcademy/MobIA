-- ============================================================================
-- 0010_gestor_reatribuir_lead.sql — Reatribuição de leads pelo gestor.
--
-- Objetivo: o GESTOR (e admin) pode transferir um lead para outro corretor da
-- própria org — SOMENTE mudando corretor_id. Nada mais da linha do lead pode
-- ser alterado por usuário final (cliente_id/imovel_id/org_id são estruturais:
-- mudá-los "sequestraria" o lead para outro cliente/imóvel/org).
--
-- Não há INSERT/DELETE de leads por usuário: leads nascem/enriquecem via o
-- trigger de materialização (0006), que roda como serviço (auth.uid() null).
--
-- Camadas de defesa:
--   1) Policy leads_update — TO authenticated: só gestor/admin, só na própria
--      org, só leads de clientes consentidos (portão LGPD), e o NOVO corretor_id
--      tem de ser corretor/gestor da MESMA org (privado.eh_corretor_da_org).
--   2) Trigger bloquear_alteracao_estrutural_lead — BEFORE UPDATE: barra
--      qualquer mudança em cliente_id/imovel_id/org_id vinda de usuário final.
--      Bypass para conexões de serviço (auth.uid() null) — assim o trigger de
--      materialização (UPSERT que altera contadores, não estruturais) segue OK.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- privado.eh_corretor_da_org(p_usuario) — true sse p_usuario é um perfil
-- corretor/gestor da org do chamador. Usado no WITH CHECK da policy de UPDATE
-- para garantir que o lead só seja reatribuído a um corretor válido da org.
-- SECURITY DEFINER: lê public.perfis sem depender da RLS de perfis. STABLE,
-- search_path vazio (só referências qualificadas).
-- ----------------------------------------------------------------------------
create function privado.eh_corretor_da_org(p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.perfis p
     where p.id = p_usuario
       and p.papel in ('corretor', 'gestor')
       and p.org_id = privado.org_atual()
  );
$$;

revoke execute on function privado.eh_corretor_da_org(uuid) from public, anon;
grant execute on function privado.eh_corretor_da_org(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Policy de UPDATE em public.leads — reatribuição pelo gestor/admin.
-- USING (linha visível para reatribuir): gestor/admin, própria org, cliente
-- consentido (mesmo portão LGPD das SELECTs). WITH CHECK (linha resultante):
-- permanece na própria org e o corretor_id destino é corretor/gestor da org.
-- Não checamos consentimento no WITH CHECK: cliente_id é imutável (trigger),
-- logo o consentimento avaliado no USING continua valendo para a linha nova.
-- ----------------------------------------------------------------------------
create policy leads_update on public.leads
  for update to authenticated
  using (
    privado.papel_atual() in ('gestor', 'admin')
    and org_id = privado.org_atual()
    and privado.cliente_consentiu(cliente_id)
  )
  with check (
    org_id = privado.org_atual()
    and privado.eh_corretor_da_org(corretor_id)
  );

-- ----------------------------------------------------------------------------
-- privado.bloquear_alteracao_estrutural_lead — BEFORE UPDATE em public.leads.
-- Impede que um usuário final altere os campos ESTRUTURAIS do lead
-- (cliente_id, imovel_id, org_id); só corretor_id (reatribuição) pode mudar.
--
-- Bypass para conexões de serviço: quando auth.uid() é null (service_role,
-- postgres, migrações, e o trigger de materialização SECURITY DEFINER — que
-- roda no contexto do INSERT de evento do cliente, mas cujo UPSERT em leads
-- NÃO altera estruturais na linha existente). A materialização faz on conflict
-- do update apenas de contadores/timestamps, então não é barrada aqui de todo
-- modo; o bypass garante robustez caso a origem seja uma conexão de serviço.
-- ----------------------------------------------------------------------------
create function privado.bloquear_alteracao_estrutural_lead()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Conexão de serviço (sem usuário final): sem restrição.
  if (select auth.uid()) is null then
    return new;
  end if;

  if new.cliente_id is distinct from old.cliente_id then
    raise exception 'não é permitido alterar o cliente do lead'
      using errcode = '42501'; -- insufficient_privilege
  end if;

  if new.imovel_id is distinct from old.imovel_id then
    raise exception 'não é permitido alterar o imóvel do lead'
      using errcode = '42501';
  end if;

  if new.org_id is distinct from old.org_id then
    raise exception 'não é permitido alterar a organização do lead'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function privado.bloquear_alteracao_estrutural_lead()
  from public, anon, authenticated;

create trigger bloquear_alteracao_estrutural_lead
  before update on public.leads
  for each row execute function privado.bloquear_alteracao_estrutural_lead();
