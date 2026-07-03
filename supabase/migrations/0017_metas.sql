-- ============================================================================
-- 0017_metas.sql — Metas gerenciais por organização.
--
-- Objetivo: permitir que gestor/admin definam metas mensais/gerais da org
-- (negócios ganhos no mês, valor vendido no mês, novos negócios no mês, leads
-- consentidos). O corretor apenas LÊ as metas da própria org; só gestor/admin
-- podem criar/editar/apagar. Multi-tenant por org_id, reaproveitando os
-- helpers privado.papel_atual()/privado.org_atual().
--
-- Integridade:
--   - UNIQUE(org_id, tipo): no máximo uma meta por tipo em cada org.
--   - alvo >= 0.
--   - trigger BEFORE UPDATE carimba atualizado_em = now().
--   - trigger BEFORE INSERT/UPDATE preenche definido_por = auth.uid() se nulo.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- public.metas — cada linha é uma meta de um tipo específico para uma org.
-- ----------------------------------------------------------------------------
create table public.metas (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizacoes(id),
  tipo          text not null
                  check (tipo in ('negocios_ganhos_mes', 'valor_vendido_mes',
                                  'novos_negocios_mes', 'leads_consentidos')),
  alvo          bigint not null check (alvo >= 0),
  definido_por  uuid references public.perfis(id),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz,
  constraint metas_org_tipo_unico unique (org_id, tipo)
);

create index metas_org_id_idx on public.metas (org_id);

-- ----------------------------------------------------------------------------
-- privado.metas_carimbar — BEFORE INSERT OR UPDATE em public.metas.
-- Mantém atualizado_em coerente e preenche definido_por com o usuário atual
-- quando não informado. SECURITY DEFINER, search_path vazio.
-- ----------------------------------------------------------------------------
create function privado.metas_carimbar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.atualizado_em := now();
  end if;

  if new.definido_por is null then
    new.definido_por := (select auth.uid());
  end if;

  return new;
end;
$$;

revoke execute on function privado.metas_carimbar()
  from public, anon, authenticated;

create trigger metas_carimbar
  before insert or update on public.metas
  for each row execute function privado.metas_carimbar();

-- ----------------------------------------------------------------------------
-- RLS — corretor lê as metas da org; só gestor/admin define.
-- ----------------------------------------------------------------------------
alter table public.metas enable row level security;

create policy metas_select on public.metas
  for select to authenticated
  using (org_id = privado.org_atual());

create policy metas_insert on public.metas
  for insert to authenticated
  with check (
    org_id = privado.org_atual()
    and privado.papel_atual() in ('gestor', 'admin')
  );

create policy metas_update on public.metas
  for update to authenticated
  using (
    org_id = privado.org_atual()
    and privado.papel_atual() in ('gestor', 'admin')
  )
  with check (
    org_id = privado.org_atual()
    and privado.papel_atual() in ('gestor', 'admin')
  );

create policy metas_delete on public.metas
  for delete to authenticated
  using (
    org_id = privado.org_atual()
    and privado.papel_atual() in ('gestor', 'admin')
  );

-- ============================================================================
-- SEED (org A) — metas iniciais definidas por gestor.alfa.
-- valor_vendido_mes em CENTAVOS: 500000000 = R$ 5.000.000,00.
-- ============================================================================
insert into public.metas (org_id, tipo, alvo, definido_por)
values
  ('11111111-1111-4111-8111-111111111111', 'negocios_ganhos_mes', 10,
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'),
  ('11111111-1111-4111-8111-111111111111', 'valor_vendido_mes', 500000000,
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'),
  ('11111111-1111-4111-8111-111111111111', 'novos_negocios_mes', 15,
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'),
  ('11111111-1111-4111-8111-111111111111', 'leads_consentidos', 20,
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2');
