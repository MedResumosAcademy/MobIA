-- 0016_crm_contato_e_parado.sql
-- CRM: telefone de contato do cliente + suporte a "negocio parado".
-- 1) Coluna telefone em cliente_profiles (contato que o corretor pode ver via lead).
-- 2) Indice para ordenar negocios por "parado" (org_id, atualizado_em).
-- 3) Seed de demonstracao (telefone do cliente.um + negocios abertos parados).

-- 1) Contato do cliente ---------------------------------------------------
alter table public.cliente_profiles
  add column telefone text;

comment on column public.cliente_profiles.telefone is
  'Telefone de contato do cliente (visivel ao corretor via lead consentido).';

-- A policy cliente_profiles_update ja restringe a usuario_id = auth.uid(),
-- entao o cliente pode editar o proprio telefone sem alteracao de RLS.

-- 2) Indice para "parado" -------------------------------------------------
create index if not exists negocios_org_atualizado_idx
  on public.negocios (org_id, atualizado_em);

-- 3) Seed de demonstracao -------------------------------------------------
-- Telefone do cliente.um.
update public.cliente_profiles
  set telefone = '5511988887777'
  where usuario_id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';

-- Envelhecer negocios ABERTOS da org A para demonstrar "parado ha X dias".
-- O trigger negocios_gerenciar_fechamento sobrescreve atualizado_em := now()
-- em UPDATE, portanto desabilitamos temporariamente para gravar datas antigas.
alter table public.negocios disable trigger negocios_gerenciar_fechamento;

-- Parado (>= 15 dias): Patricia Nunes.
update public.negocios
  set atualizado_em = now() - interval '20 days'
  where id = 'b0000001-0000-4000-8000-000000000004';

-- Atencao (~9 dias): Gustavo Dias.
update public.negocios
  set atualizado_em = now() - interval '9 days'
  where id = 'b0000001-0000-4000-8000-000000000008';

-- Recente: Cliente Um (mantem pelo menos 1 negocio aberto recente).
update public.negocios
  set atualizado_em = now()
  where id = 'a0000001-0000-4000-8000-000000000002';

alter table public.negocios enable trigger negocios_gerenciar_fechamento;
