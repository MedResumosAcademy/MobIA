-- ============================================================================
-- 0011_crm_negocios.sql — CRM: pipeline de negócios (deals) e atividades.
--
-- Objetivo: dar ao corretor/gestor um funil de vendas ("negócios") com etapas
-- (novo → contato → visita → proposta → fechamento) e um histórico de
-- atividades por negócio (timeline). Multi-tenant por org_id, com RLS que
-- reaproveita os helpers privado.papel_atual()/privado.org_atual().
--
-- Regras de visibilidade:
--   - corretor: vê/edita/apaga apenas os SEUS negócios (corretor_id = auth.uid()).
--   - gestor/admin: veem/editam/apagam qualquer negócio da própria org.
--
-- Integridade de dados:
--   - resultado (ganho|perdido) só pode existir na etapa 'fechamento'.
--   - trigger BEFORE UPDATE em negocios: gerencia fechado_em/atualizado_em.
--   - trigger BEFORE INSERT em negocio_atividades: força org_id = org do
--     negócio (anti-forja — o cliente não escolhe a org da atividade).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- public.negocios — cada linha é um negócio/deal no funil.
-- ----------------------------------------------------------------------------
create table public.negocios (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizacoes(id),
  corretor_id   uuid not null references public.perfis(id),
  cliente_id    uuid references public.perfis(id),
  lead_id       uuid references public.leads(id),
  imovel_id     uuid references public.imoveis(id),
  unidade_id    uuid references public.unidades(id),
  nome_contato  text not null,
  telefone_contato text,
  email_contato text,
  etapa         text not null default 'novo'
                  check (etapa in ('novo', 'contato', 'visita', 'proposta', 'fechamento')),
  resultado     text
                  check (resultado is null or resultado in ('ganho', 'perdido')),
  motivo_perda  text,
  valor         bigint check (valor is null or valor >= 0),
  origem        text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz,
  fechado_em    timestamptz,
  -- resultado só faz sentido quando o negócio chegou ao fechamento.
  constraint negocios_resultado_exige_fechamento
    check (resultado is null or etapa = 'fechamento')
);

create index negocios_org_id_idx      on public.negocios (org_id);
create index negocios_corretor_id_idx on public.negocios (corretor_id);
create index negocios_etapa_idx       on public.negocios (etapa);
create index negocios_cliente_id_idx  on public.negocios (cliente_id);

-- ----------------------------------------------------------------------------
-- public.negocio_atividades — timeline de eventos de cada negócio.
-- org_id é preenchido por trigger (anti-forja); nunca confiar no cliente.
-- ----------------------------------------------------------------------------
create table public.negocio_atividades (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizacoes(id),
  negocio_id  uuid not null references public.negocios(id) on delete cascade,
  autor_id    uuid references public.perfis(id),
  tipo        text not null
                check (tipo in ('criacao', 'nota', 'ligacao', 'email', 'whatsapp',
                                'visita', 'mudanca_etapa', 'ganho', 'perdido')),
  descricao   text not null,
  criado_em   timestamptz not null default now()
);

create index negocio_atividades_negocio_id_criado_em_idx
  on public.negocio_atividades (negocio_id, criado_em);

-- ----------------------------------------------------------------------------
-- privado.negocios_gerenciar_fechamento — BEFORE UPDATE em public.negocios.
-- Mantém fechado_em/atualizado_em coerentes com a transição de resultado.
-- SECURITY DEFINER, search_path vazio (só referências qualificadas / now()).
-- ----------------------------------------------------------------------------
create function privado.negocios_gerenciar_fechamento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.atualizado_em := now();

  -- resultado passou a não-null → carimba o fechamento.
  if new.resultado is not null and old.resultado is null then
    new.fechado_em := now();
  -- resultado voltou a null → reabre o negócio.
  elsif new.resultado is null and old.resultado is not null then
    new.fechado_em := null;
  end if;

  return new;
end;
$$;

revoke execute on function privado.negocios_gerenciar_fechamento()
  from public, anon, authenticated;

create trigger negocios_gerenciar_fechamento
  before update on public.negocios
  for each row execute function privado.negocios_gerenciar_fechamento();

-- ----------------------------------------------------------------------------
-- privado.negocio_atividades_preencher_org — BEFORE INSERT em atividades.
-- Força org_id = org_id do negócio referenciado (anti-forja). Se o negócio
-- não existir, a própria FK derruba o INSERT depois; aqui só derivamos a org.
-- ----------------------------------------------------------------------------
create function privado.negocio_atividades_preencher_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select n.org_id into new.org_id
    from public.negocios n
   where n.id = new.negocio_id;

  return new;
end;
$$;

revoke execute on function privado.negocio_atividades_preencher_org()
  from public, anon, authenticated;

create trigger negocio_atividades_preencher_org
  before insert on public.negocio_atividades
  for each row execute function privado.negocio_atividades_preencher_org();

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.negocios enable row level security;
alter table public.negocio_atividades enable row level security;

-- negocios: corretor vê os seus; gestor/admin veem os da org.
create policy negocios_select on public.negocios
  for select to authenticated
  using (
    (corretor_id = (select auth.uid()) and privado.papel_atual() = 'corretor')
    or (privado.papel_atual() in ('gestor', 'admin') and org_id = privado.org_atual())
  );

create policy negocios_insert on public.negocios
  for insert to authenticated
  with check (
    privado.papel_atual() in ('corretor', 'gestor', 'admin')
    and org_id = privado.org_atual()
  );

create policy negocios_update on public.negocios
  for update to authenticated
  using (
    (corretor_id = (select auth.uid()) and privado.papel_atual() = 'corretor')
    or (privado.papel_atual() in ('gestor', 'admin') and org_id = privado.org_atual())
  )
  with check (org_id = privado.org_atual());

create policy negocios_delete on public.negocios
  for delete to authenticated
  using (
    (corretor_id = (select auth.uid()) and privado.papel_atual() = 'corretor')
    or (privado.papel_atual() in ('gestor', 'admin') and org_id = privado.org_atual())
  );

-- negocio_atividades: visível se a atividade é da org do usuário e o negócio-pai
-- é visível a ele (corretor: só os seus; gestor/admin: qualquer da org).
create policy negocio_atividades_select on public.negocio_atividades
  for select to authenticated
  using (
    org_id = privado.org_atual()
    and privado.papel_atual() in ('corretor', 'gestor', 'admin')
    and exists (
      select 1
        from public.negocios n
       where n.id = negocio_id
         and (
           (n.corretor_id = (select auth.uid()) and privado.papel_atual() = 'corretor')
           or privado.papel_atual() in ('gestor', 'admin')
         )
    )
  );

-- INSERT: org derivada pelo trigger; autor deve ser o próprio usuário.
create policy negocio_atividades_insert on public.negocio_atividades
  for insert to authenticated
  with check (
    org_id = privado.org_atual()
    and autor_id = (select auth.uid())
  );

-- (Sem policies de UPDATE/DELETE em atividades: histórico é imutável.)

-- ============================================================================
-- SEED de demonstração (org A / corretor.alfa) — popula o pipeline.
-- ids fixos reconhecíveis (prefixo a0000001-...).
-- ============================================================================
insert into public.negocios
  (id, org_id, corretor_id, cliente_id, imovel_id, nome_contato, etapa, resultado, valor, fechado_em)
values
  ('a0000001-0000-4000-8000-000000000001',
   '11111111-1111-4111-8111-111111111111',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
   null,
   'd1000001-0000-4000-8000-000000000001',
   'João Lima', 'novo', null, 128000000, null),
  ('a0000001-0000-4000-8000-000000000002',
   '11111111-1111-4111-8111-111111111111',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
   'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
   'd1000002-0000-4000-8000-000000000002',
   'Cliente Um', 'visita', null, 24500000, null),
  ('a0000001-0000-4000-8000-000000000003',
   '11111111-1111-4111-8111-111111111111',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
   null,
   'd1000005-0000-4000-8000-000000000005',
   'Maria Souza', 'proposta', null, 96000000, null),
  ('a0000001-0000-4000-8000-000000000004',
   '11111111-1111-4111-8111-111111111111',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
   null,
   'd1000004-0000-4000-8000-000000000004',
   'Ana Costa', 'fechamento', 'ganho', 18900000, now());

-- 1 atividade 'criacao' por negócio (autor corretor.alfa).
insert into public.negocio_atividades
  (id, org_id, negocio_id, autor_id, tipo, descricao)
values
  ('a0000001-0000-4000-8000-0000000000a1',
   '11111111-1111-4111-8111-111111111111',
   'a0000001-0000-4000-8000-000000000001',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
   'criacao', 'Negócio criado a partir do imóvel.'),
  ('a0000001-0000-4000-8000-0000000000a2',
   '11111111-1111-4111-8111-111111111111',
   'a0000001-0000-4000-8000-000000000002',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
   'criacao', 'Negócio criado a partir do imóvel.'),
  ('a0000001-0000-4000-8000-0000000000a3',
   '11111111-1111-4111-8111-111111111111',
   'a0000001-0000-4000-8000-000000000003',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
   'criacao', 'Negócio criado a partir do imóvel.'),
  ('a0000001-0000-4000-8000-0000000000a4',
   '11111111-1111-4111-8111-111111111111',
   'a0000001-0000-4000-8000-000000000004',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
   'criacao', 'Negócio criado a partir do imóvel.');
