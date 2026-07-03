-- ============================================================================
-- 0020_agenda.sql — Agenda do corretor (eventos/compromissos).
--
-- Objetivo: dar ao corretor uma agenda própria (compromissos, visitas,
-- reuniões, lembretes), opcionalmente vinculada a um negócio do funil.
-- Multi-tenant por org_id, reaproveitando os helpers
-- privado.papel_atual()/privado.org_atual().
--
-- - org_id/corretor_id são forjados no trigger BEFORE INSERT (anti-forja),
--   mesmo padrão de privado.depoimentos_preencher_org.
-- - SELECT: dono OU gestor/admin da mesma org.
-- - INSERT: apenas o próprio corretor (corretor_id = auth.uid()) com papel
--   autorizado; UPDATE/DELETE: apenas o dono.
-- - criado_via distingue eventos criados manualmente dos criados pelo
--   assistente de voz.
-- ============================================================================

create table public.agenda_eventos (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizacoes(id),
  corretor_id uuid not null references public.perfis(id) on delete cascade,
  titulo      text not null check (char_length(titulo) between 1 and 200),
  tipo        text not null default 'compromisso'
              check (tipo in ('compromisso', 'visita', 'reuniao', 'lembrete')),
  inicio      timestamptz not null,
  fim         timestamptz check (fim is null or fim > inicio),
  local       text,
  negocio_id  uuid references public.negocios(id) on delete set null,
  observacao  text,
  criado_via  text not null default 'manual'
              check (criado_via in ('manual', 'assistente')),
  criado_em   timestamptz not null default now()
);

create index agenda_eventos_corretor_id_inicio_idx
  on public.agenda_eventos (corretor_id, inicio);

create index agenda_eventos_org_id_inicio_idx
  on public.agenda_eventos (org_id, inicio);

-- ----------------------------------------------------------------------------
-- privado.agenda_preencher_org — BEFORE INSERT em agenda_eventos.
-- Deriva corretor_id (default: usuário autenticado) e força org_id = org do
-- corretor (anti-forja). SECURITY DEFINER, search_path vazio.
-- ----------------------------------------------------------------------------
create function privado.agenda_preencher_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.corretor_id := coalesce(new.corretor_id, auth.uid());
  new.org_id := coalesce(
    new.org_id,
    (select p.org_id from public.perfis p where p.id = new.corretor_id)
  );
  return new;
end;
$$;

revoke execute on function privado.agenda_preencher_org()
  from public, anon, authenticated;

create trigger agenda_preencher_org
  before insert on public.agenda_eventos
  for each row execute function privado.agenda_preencher_org();

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.agenda_eventos enable row level security;

-- SELECT: o dono vê os seus; gestor/admin vê os eventos da org.
create policy agenda_select on public.agenda_eventos
  for select to authenticated
  using (
    corretor_id = (select auth.uid())
    or (
      privado.papel_atual() in ('gestor', 'admin')
      and org_id = privado.org_atual()
    )
  );

-- INSERT: apenas para si mesmo, com papel autorizado na org.
create policy agenda_insert on public.agenda_eventos
  for insert to authenticated
  with check (
    corretor_id = (select auth.uid())
    and privado.papel_atual() in ('corretor', 'gestor', 'admin')
  );

-- UPDATE/DELETE: apenas o dono.
create policy agenda_update on public.agenda_eventos
  for update to authenticated
  using (corretor_id = (select auth.uid()))
  with check (corretor_id = (select auth.uid()));

create policy agenda_delete on public.agenda_eventos
  for delete to authenticated
  using (corretor_id = (select auth.uid()));
