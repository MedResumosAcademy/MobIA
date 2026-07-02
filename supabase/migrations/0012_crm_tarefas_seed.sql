-- ============================================================================
-- 0012_crm_tarefas_seed.sql — CRM: tarefas por negócio + seed rico do funil.
--
-- Objetivo:
--   1) public.negocio_tarefas: to-dos vinculados a um negócio, com responsável
--      (corretor), prazo (vence_em) e estado de conclusão. Multi-tenant por
--      org_id, RLS reaproveitando privado.papel_atual()/privado.org_atual().
--   2) 2º corretor na org A (Bruno Gama) para o ranking do gestor ter mais de
--      uma linha (mesmo padrão de auth.users do seed-dev — tokens '' NUNCA null).
--   3) Seed rico de negócios (org A) distribuído entre alfa/gama, com etapas
--      variadas e vários fechados (ganho/perdido) datados nos últimos ~5 meses
--      para o dashboard ter conversão < 100%, ticket médio, ciclo e tendência.
--   4) ~5 tarefas demo (pendentes, atrasadas, 1 concluída).
--
-- Visibilidade de negocio_tarefas:
--   - corretor: vê/edita/apaga apenas as SUAS (corretor_id = auth.uid()).
--   - gestor/admin: qualquer tarefa da própria org.
--
-- Integridade:
--   - trigger BEFORE INSERT: org_id derivado do negócio (anti-forja); se
--     corretor_id nulo, usa auth.uid().
--   - trigger BEFORE UPDATE: seta/limpa concluida_em conforme concluida.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- public.negocio_tarefas
-- ----------------------------------------------------------------------------
create table public.negocio_tarefas (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizacoes(id),
  negocio_id   uuid not null references public.negocios(id) on delete cascade,
  corretor_id  uuid not null references public.perfis(id),
  titulo       text not null,
  descricao    text,
  vence_em     date,
  concluida    boolean not null default false,
  concluida_em timestamptz,
  criado_em    timestamptz not null default now()
);

create index negocio_tarefas_org_id_idx              on public.negocio_tarefas (org_id);
create index negocio_tarefas_corretor_concluida_idx  on public.negocio_tarefas (corretor_id, concluida);
create index negocio_tarefas_negocio_id_idx          on public.negocio_tarefas (negocio_id);
create index negocio_tarefas_vence_em_idx            on public.negocio_tarefas (vence_em);

-- ----------------------------------------------------------------------------
-- privado.negocio_tarefas_preencher — BEFORE INSERT.
-- org_id = org do negócio referenciado (anti-forja); corretor_id = auth.uid()
-- se não informado. SECURITY DEFINER, search_path vazio.
-- ----------------------------------------------------------------------------
create function privado.negocio_tarefas_preencher()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select n.org_id into new.org_id
    from public.negocios n
   where n.id = new.negocio_id;

  if new.corretor_id is null then
    new.corretor_id := (select auth.uid());
  end if;

  return new;
end;
$$;

revoke execute on function privado.negocio_tarefas_preencher()
  from public, anon, authenticated;

create trigger negocio_tarefas_preencher
  before insert on public.negocio_tarefas
  for each row execute function privado.negocio_tarefas_preencher();

-- ----------------------------------------------------------------------------
-- privado.negocio_tarefas_concluir — BEFORE UPDATE.
-- Carimba concluida_em quando concluida vira true; limpa quando volta a false.
-- ----------------------------------------------------------------------------
create function privado.negocio_tarefas_concluir()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.concluida and not old.concluida then
    new.concluida_em := now();
  elsif not new.concluida and old.concluida then
    new.concluida_em := null;
  end if;

  return new;
end;
$$;

revoke execute on function privado.negocio_tarefas_concluir()
  from public, anon, authenticated;

create trigger negocio_tarefas_concluir
  before update on public.negocio_tarefas
  for each row execute function privado.negocio_tarefas_concluir();

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.negocio_tarefas enable row level security;

create policy negocio_tarefas_select on public.negocio_tarefas
  for select to authenticated
  using (
    (corretor_id = (select auth.uid()) and privado.papel_atual() = 'corretor')
    or (privado.papel_atual() in ('gestor', 'admin') and org_id = privado.org_atual())
  );

create policy negocio_tarefas_insert on public.negocio_tarefas
  for insert to authenticated
  with check (
    org_id = privado.org_atual()
    and privado.papel_atual() in ('corretor', 'gestor', 'admin')
  );

create policy negocio_tarefas_update on public.negocio_tarefas
  for update to authenticated
  using (
    (corretor_id = (select auth.uid()) and privado.papel_atual() = 'corretor')
    or (privado.papel_atual() in ('gestor', 'admin') and org_id = privado.org_atual())
  )
  with check (org_id = privado.org_atual());

create policy negocio_tarefas_delete on public.negocio_tarefas
  for delete to authenticated
  using (
    (corretor_id = (select auth.uid()) and privado.papel_atual() = 'corretor')
    or (privado.papel_atual() in ('gestor', 'admin') and org_id = privado.org_atual())
  );

-- ============================================================================
-- SEED — 2º corretor (Bruno Gama), org A.
-- Mesmo padrão do seed-dev: instance_id zeros, aud/role authenticated,
-- email_confirmed_at now(), senha via extensions.crypt, TODAS as colunas de
-- token = '' (NUNCA null — evita o 500 do GoTrue). Idempotente.
-- O trigger handle_new_user cria public.perfis a partir do metadata; como o
-- seed é idempotente e o papel corretor vem de convite, garantimos convite +
-- perfis + corretor_profiles explicitamente.
-- ============================================================================
insert into privado.convites (org_id, papel, token, email) values
  ('11111111-1111-4111-8111-111111111111', 'corretor', 'seed-corretor-gama', 'corretor.gama@teste.mobia')
on conflict (token) do nothing;

insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                        confirmation_token, recovery_token, email_change,
                        email_change_token_new, email_change_token_current,
                        phone_change, phone_change_token, reauthentication_token,
                        created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
   'authenticated', 'authenticated', 'corretor.gama@teste.mobia',
   extensions.crypt('MobIA!teste1', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"convite_token":"seed-corretor-gama","nome":"Bruno Gama","papel":"corretor","org_id":"11111111-1111-4111-8111-111111111111"}',
   '', '', '', '', '', '', '', '', now(), now())
on conflict (id) do nothing;

-- Garante perfil corretor na org A (caso o trigger não tenha promovido).
insert into public.perfis (id, papel, org_id, nome) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'corretor',
   '11111111-1111-4111-8111-111111111111', 'Bruno Gama')
on conflict (id) do update
  set papel = 'corretor',
      org_id = '11111111-1111-4111-8111-111111111111',
      nome = coalesce(public.perfis.nome, 'Bruno Gama');

insert into public.corretor_profiles (usuario_id, creci, org_id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'seed-gama',
   '11111111-1111-4111-8111-111111111111')
on conflict (usuario_id) do nothing;

-- ============================================================================
-- SEED rico de negócios (org A) — ~8 novos, distribuídos alfa/gama, etapas
-- variadas, vários fechados (ganho/perdido) datados nos últimos ~5 meses.
-- Valores em CENTAVOS. origem = 'seed'. ids b0000001-...
-- ============================================================================
-- Ajusta o ganho existente (Ana Costa) para fechar ~20 dias atrás (ciclo real).
update public.negocios
   set origem     = 'seed',
       criado_em  = now() - interval '38 days',
       fechado_em = now() - interval '20 days'
 where id = 'a0000001-0000-4000-8000-000000000004';

insert into public.negocios
  (id, org_id, corretor_id, imovel_id, nome_contato, etapa, resultado,
   motivo_perda, valor, origem, criado_em, fechado_em)
values
  -- === corretor.alfa ===
  -- Ganhos (fechados) espalhados nos últimos meses.
  ('b0000001-0000-4000-8000-000000000001',
   '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
   'd1000003-0000-4000-8000-000000000003',
   'Carlos Mendes', 'fechamento', 'ganho', null, 310000000, 'seed',
   now() - interval '145 days', now() - interval '120 days'),
  ('b0000001-0000-4000-8000-000000000002',
   '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
   'd1000006-0000-4000-8000-000000000006',
   'Fernanda Rocha', 'fechamento', 'ganho', null, 21000000, 'seed',
   now() - interval '95 days', now() - interval '70 days'),
  -- Perdido.
  ('b0000001-0000-4000-8000-000000000003',
   '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
   null,
   'Ricardo Alves', 'fechamento', 'perdido', 'Cliente escolheu concorrente',
   87000000, 'seed', now() - interval '110 days', now() - interval '85 days'),
  -- Em andamento (abertos).
  ('b0000001-0000-4000-8000-000000000004',
   '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
   null,
   'Patrícia Nunes', 'contato', null, null, 45000000, 'seed',
   now() - interval '18 days', null),

  -- === corretor.gama ===
  -- Ganhos.
  ('b0000001-0000-4000-8000-000000000005',
   '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
   'd1000005-0000-4000-8000-000000000005',
   'Juliana Prado', 'fechamento', 'ganho', null, 92000000, 'seed',
   now() - interval '60 days', now() - interval '40 days'),
  ('b0000001-0000-4000-8000-000000000006',
   '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
   null,
   'Marcos Tavares', 'fechamento', 'ganho', null, 63000000, 'seed',
   now() - interval '30 days', now() - interval '12 days'),
  -- Perdido.
  ('b0000001-0000-4000-8000-000000000007',
   '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
   null,
   'Beatriz Lima', 'fechamento', 'perdido', 'Sem crédito aprovado',
   38000000, 'seed', now() - interval '75 days', now() - interval '55 days'),
  -- Em andamento.
  ('b0000001-0000-4000-8000-000000000008',
   '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
   'd1000002-0000-4000-8000-000000000002',
   'Gustavo Dias', 'proposta', null, null, 24500000, 'seed',
   now() - interval '9 days', null);

-- ============================================================================
-- SEED de tarefas demo (~5) — pendentes, atrasadas e 1 concluída.
-- Insere direto com org_id explícito (service_role bypassa RLS; o trigger de
-- INSERT reescreve org_id a partir do negócio de qualquer forma). ids c000...
-- ============================================================================
insert into public.negocio_tarefas
  (id, org_id, negocio_id, corretor_id, titulo, descricao, vence_em, concluida, concluida_em)
values
  -- alfa: pendente futura
  ('c0000001-0000-4000-8000-000000000001',
   '11111111-1111-4111-8111-111111111111',
   'a0000001-0000-4000-8000-000000000001',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
   'Ligar para João Lima', 'Confirmar interesse no apartamento.',
   (now() + interval '3 days')::date, false, null),
  -- alfa: ATRASADA
  ('c0000001-0000-4000-8000-000000000002',
   '11111111-1111-4111-8111-111111111111',
   'a0000001-0000-4000-8000-000000000003',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
   'Enviar proposta revisada', 'Cliente aguarda ajuste de valor.',
   (now() - interval '4 days')::date, false, null),
  -- alfa: concluída
  ('c0000001-0000-4000-8000-000000000003',
   '11111111-1111-4111-8111-111111111111',
   'a0000001-0000-4000-8000-000000000002',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
   'Agendar visita', 'Visita ao imóvel realizada.',
   (now() - interval '10 days')::date, true, now() - interval '9 days'),
  -- gama: pendente futura
  ('c0000001-0000-4000-8000-000000000004',
   '11111111-1111-4111-8111-111111111111',
   'b0000001-0000-4000-8000-000000000008',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
   'Preparar contrato', 'Proposta aceita — montar minuta.',
   (now() + interval '5 days')::date, false, null),
  -- gama: ATRASADA
  ('c0000001-0000-4000-8000-000000000005',
   '11111111-1111-4111-8111-111111111111',
   'b0000001-0000-4000-8000-000000000004',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
   'Retornar contato', 'Cliente pediu retorno na semana passada.',
   (now() - interval '2 days')::date, false, null)
on conflict (id) do nothing;
