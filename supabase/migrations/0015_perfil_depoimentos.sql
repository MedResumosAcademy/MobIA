-- ============================================================================
-- 0015_perfil_depoimentos.sql — Perfil público do corretor + depoimentos.
--
-- Objetivo: dar ao corretor um "perfil público" (bio, contato, fotos, cidade,
-- redes) e uma coleção de depoimentos/reviews de clientes, para futura página
-- vitrine. Multi-tenant por org_id, reaproveitando os helpers
-- privado.papel_atual()/privado.org_atual().
--
-- 1) public.corretor_profiles ganha campos de perfil público (todos nullable)
--    e uma policy de UPDATE para o corretor editar o PRÓPRIO perfil.
--    NOTA: a policy de UPDATE usa using/with check = (usuario_id = auth.uid()).
--    O Postgres não permite restringir colunas específicas dentro de uma
--    policy RLS; portanto creci/org_id ficam tecnicamente atualizáveis via
--    esta policy. Mitigação recomendada na camada de dados (server): expor
--    apenas os campos de perfil público no UPDATE. (Documentado aqui.)
--
-- 2) public.depoimentos — reviews de clientes por corretor.
--    - SELECT: dono (corretor_id=auth.uid()) OU mesma org com papel autorizado.
--    - INSERT: mesma org + papel autorizado; org_id é forjado no trigger.
--    - DELETE: dono OU gestor/admin da org.
--    - Trigger BEFORE INSERT: força org_id = org do corretor (anti-forja).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Perfil público em corretor_profiles.
-- ----------------------------------------------------------------------------
alter table public.corretor_profiles
  add column bio       text,
  add column telefone  text,
  add column foto_url  text,
  add column capa_url  text,
  add column cidade    text,
  add column instagram text;

-- Policy de UPDATE: corretor edita o próprio perfil. (Até agora só havia
-- SELECT.) Ver NOTA no cabeçalho quanto a creci/org_id.
create policy corretor_profiles_update on public.corretor_profiles
  for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

-- ----------------------------------------------------------------------------
-- 2) public.depoimentos — cada linha é um depoimento de cliente sobre um corretor.
-- org_id é preenchido por trigger (anti-forja); nunca confiar no cliente.
-- ----------------------------------------------------------------------------
create table public.depoimentos (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizacoes(id),
  corretor_id    uuid not null references public.perfis(id),
  autor_nome     text not null,
  autor_relacao  text,
  nota           smallint check (nota is null or (nota between 1 and 5)),
  texto          text not null,
  criado_em      timestamptz not null default now()
);

create index depoimentos_corretor_id_criado_em_idx
  on public.depoimentos (corretor_id, criado_em desc);

-- ----------------------------------------------------------------------------
-- privado.depoimentos_preencher_org — BEFORE INSERT em depoimentos.
-- Força org_id = org_id do corretor referenciado (anti-forja). Se o corretor
-- não existir, a própria FK derruba o INSERT depois; aqui só derivamos a org.
-- SECURITY DEFINER, search_path vazio (só referências qualificadas).
-- ----------------------------------------------------------------------------
create function privado.depoimentos_preencher_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select p.org_id into new.org_id
    from public.perfis p
   where p.id = new.corretor_id;

  return new;
end;
$$;

revoke execute on function privado.depoimentos_preencher_org()
  from public, anon, authenticated;

create trigger depoimentos_preencher_org
  before insert on public.depoimentos
  for each row execute function privado.depoimentos_preencher_org();

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.depoimentos enable row level security;

-- SELECT: o próprio corretor vê os seus; e qualquer membro autorizado da org
-- vê os depoimentos da org (para exibir na vitrine da equipe).
create policy depoimentos_select on public.depoimentos
  for select to authenticated
  using (
    corretor_id = (select auth.uid())
    or (
      org_id = privado.org_atual()
      and privado.papel_atual() in ('corretor', 'gestor', 'admin')
    )
  );

-- INSERT: org derivada pelo trigger; exige org atual + papel autorizado.
create policy depoimentos_insert on public.depoimentos
  for insert to authenticated
  with check (
    org_id = privado.org_atual()
    and privado.papel_atual() in ('corretor', 'gestor', 'admin')
  );

-- DELETE: o dono do perfil, ou gestor/admin da org.
create policy depoimentos_delete on public.depoimentos
  for delete to authenticated
  using (
    corretor_id = (select auth.uid())
    or (
      privado.papel_atual() in ('gestor', 'admin')
      and org_id = privado.org_atual()
    )
  );

-- (Sem policy de UPDATE: depoimento é imutável após criado.)

-- ============================================================================
-- SEED de demonstração — perfil público de alfa/gama + depoimentos.
-- ============================================================================

-- Perfil público de corretor.alfa (aaa1) e corretor.gama (aaa3).
update public.corretor_profiles
   set bio       = 'Especialista em imóveis residenciais e MCMV. Ajudo você a montar a compra do seu jeito.',
       telefone  = '5511999990001',
       cidade    = 'São Paulo',
       instagram = '@corretor.alfa'
 where usuario_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';

update public.corretor_profiles
   set bio       = 'Foco em apartamentos de alto padrão e primeira compra. Atendimento próximo do início ao pós-venda.',
       telefone  = '5511999990003',
       cidade    = 'Campinas',
       instagram = '@bruno.gama'
 where usuario_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';

-- Depoimentos de alfa (~4). org_id é preenchido pelo trigger.
insert into public.depoimentos
  (id, corretor_id, autor_nome, autor_relacao, nota, texto)
values
  ('b0000001-0000-4000-8000-000000000001',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
   'Fernanda Ribeiro', 'Cliente', 5,
   'Atendimento impecável do começo ao fim. O Alfa entendeu exatamente o que eu precisava e achou o apartamento perfeito.'),
  ('b0000001-0000-4000-8000-000000000002',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
   'Ricardo Mendes', 'Cliente', 5,
   'Profissional atencioso e transparente. Explicou cada etapa do financiamento com paciência. Recomendo demais.'),
  ('b0000001-0000-4000-8000-000000000003',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
   'Juliana Alves', 'Cliente', 4,
   'Muito prestativo e sempre disponível no WhatsApp. Conseguiu uma condição ótima na minha primeira compra.'),
  ('b0000001-0000-4000-8000-000000000004',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
   'Marcos Tavares', 'Cliente', 5,
   'Fechei meu imóvel pelo MCMV com total tranquilidade. O Alfa cuidou da papelada e me deixou seguro em cada passo.');

-- Depoimentos de gama (~2). org_id preenchido pelo trigger.
insert into public.depoimentos
  (id, corretor_id, autor_nome, autor_relacao, nota, texto)
values
  ('b0000001-0000-4000-8000-000000000011',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
   'Patrícia Gomes', 'Cliente', 5,
   'O Bruno foi excelente. Achou um apartamento de alto padrão dentro do meu orçamento e negociou muito bem.'),
  ('b0000001-0000-4000-8000-000000000012',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
   'André Nogueira', 'Cliente', 4,
   'Ótimo acompanhamento na minha primeira compra. Sempre disponível e muito claro nas explicações.');
