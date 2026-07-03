-- ============================================================================
-- 0018_comunidade.sql — COMUNIDADE (feed nacional cross-org de profissionais)
--
-- A comunidade é NACIONAL e CROSS-ORG: corretor/gestor/admin de QUALQUER org
-- publicam e enxergam o feed inteiro. Clientes NÃO participam.
--
-- A RLS de perfis/corretor_profiles é ISOLADA POR ORG (não pode ser afrouxada),
-- então a identidade do autor (nome/org/foto) é DENORMALIZADA na própria linha
-- da publicação por um trigger BEFORE INSERT (privado.publicacoes_preencher_autor).
-- O ranking nacional sai de uma VIEW owner-postgres (public.ranking_comunidade)
-- que bypassa a RLS por NÃO usar security_invoker. Nunca joine perfis cross-org
-- em runtime.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tabelas (schema public, todas cross-org)
-- ----------------------------------------------------------------------------

create table public.publicacoes (
  id             uuid primary key default gen_random_uuid(),
  autor_id       uuid not null references public.perfis(id) on delete cascade,
  autor_nome     text not null,
  autor_org      text,
  autor_foto_url text,
  conteudo       text not null check (char_length(conteudo) between 1 and 2000),
  tipo           text not null default 'geral'
                   check (tipo in ('geral', 'conquista', 'dica', 'imovel')),
  imovel_id      uuid references public.imoveis(id) on delete set null,
  curtidas_count int not null default 0,
  criado_em      timestamptz not null default now()
);

create index publicacoes_criado_em_idx on public.publicacoes (criado_em desc);
create index publicacoes_autor_id_idx   on public.publicacoes (autor_id);

create table public.publicacao_curtidas (
  publicacao_id uuid not null references public.publicacoes(id) on delete cascade,
  perfil_id     uuid not null references public.perfis(id) on delete cascade,
  criado_em     timestamptz not null default now(),
  primary key (publicacao_id, perfil_id)
);

create table public.seguidores (
  seguidor_id uuid not null references public.perfis(id) on delete cascade,
  seguido_id  uuid not null references public.perfis(id) on delete cascade,
  criado_em   timestamptz not null default now(),
  primary key (seguidor_id, seguido_id),
  check (seguidor_id <> seguido_id)
);

-- ----------------------------------------------------------------------------
-- Triggers (schema privado, SECURITY DEFINER)
-- ----------------------------------------------------------------------------

-- publicacoes_preencher_autor — BEFORE INSERT em publicacoes: denormaliza a
-- identidade do autor na própria linha. Usa coalesce(auth.uid(), new.autor_id)
-- para funcionar tanto no runtime (auth.uid() preenchido) quanto no seed/jobs
-- server-side (autor_id explícito, auth.uid() null). Lê perfis/organizacoes/
-- corretor_profiles com SECURITY DEFINER, contornando a RLS por-org (a
-- denormalização é o mecanismo que permite o feed cross-org sem joins de perfis
-- em runtime).
create function privado.publicacoes_preencher_autor()
returns trigger
language plpgsql
security definer
set search_path = public, privado
as $$
begin
  new.autor_id := coalesce(auth.uid(), new.autor_id);

  new.autor_nome := (select nome from perfis where id = new.autor_id);

  new.autor_org := (
    select o.nome
    from organizacoes o
    join perfis p on p.org_id = o.id
    where p.id = new.autor_id
  );

  new.autor_foto_url := (
    select foto_url from corretor_profiles where usuario_id = new.autor_id
  );

  return new;
end;
$$;

revoke execute on function privado.publicacoes_preencher_autor() from public, anon, authenticated;

create trigger publicacoes_preencher_autor
  before insert on public.publicacoes
  for each row execute function privado.publicacoes_preencher_autor();

-- curtidas_manter_contador — AFTER INSERT OR DELETE em publicacao_curtidas:
-- mantém publicacoes.curtidas_count coerente (+1 no INSERT, -1 no DELETE, nunca
-- negativo). SECURITY DEFINER para escrever o contador sem depender da policy
-- de UPDATE do chamador (não há UPDATE em publicacoes exposto).
create function privado.curtidas_manter_contador()
returns trigger
language plpgsql
security definer
set search_path = public, privado
as $$
begin
  if tg_op = 'INSERT' then
    update publicacoes
      set curtidas_count = curtidas_count + 1
      where id = new.publicacao_id;
  elsif tg_op = 'DELETE' then
    update publicacoes
      set curtidas_count = greatest(curtidas_count - 1, 0)
      where id = old.publicacao_id;
  end if;
  return null;
end;
$$;

revoke execute on function privado.curtidas_manter_contador() from public, anon, authenticated;

create trigger curtidas_manter_contador
  after insert or delete on public.publicacao_curtidas
  for each row execute function privado.curtidas_manter_contador();

-- ----------------------------------------------------------------------------
-- RLS — comunidade é de PROFISSIONAIS (corretor/gestor/admin). Cross-org: sem
-- filtro de org_id. Negar por padrão; uma policy por comando.
-- ----------------------------------------------------------------------------

alter table public.publicacoes         enable row level security;
alter table public.publicacao_curtidas enable row level security;
alter table public.seguidores          enable row level security;

-- publicacoes
create policy publicacoes_select on public.publicacoes
  for select to authenticated
  using (privado.papel_atual() in ('corretor', 'gestor', 'admin'));

create policy publicacoes_insert on public.publicacoes
  for insert to authenticated
  with check (
    autor_id = (select auth.uid())
    and privado.papel_atual() in ('corretor', 'gestor', 'admin')
  );

create policy publicacoes_delete on public.publicacoes
  for delete to authenticated
  using (autor_id = (select auth.uid()));

-- publicacao_curtidas
create policy publicacao_curtidas_select on public.publicacao_curtidas
  for select to authenticated
  using (privado.papel_atual() in ('corretor', 'gestor', 'admin'));

create policy publicacao_curtidas_insert on public.publicacao_curtidas
  for insert to authenticated
  with check (
    perfil_id = (select auth.uid())
    and privado.papel_atual() in ('corretor', 'gestor', 'admin')
  );

create policy publicacao_curtidas_delete on public.publicacao_curtidas
  for delete to authenticated
  using (perfil_id = (select auth.uid()));

-- seguidores
create policy seguidores_select on public.seguidores
  for select to authenticated
  using (privado.papel_atual() in ('corretor', 'gestor', 'admin'));

create policy seguidores_insert on public.seguidores
  for insert to authenticated
  with check (
    seguidor_id = (select auth.uid())
    and seguidor_id <> seguido_id
    and privado.papel_atual() in ('corretor', 'gestor', 'admin')
  );

create policy seguidores_delete on public.seguidores
  for delete to authenticated
  using (seguidor_id = (select auth.uid()));

-- ----------------------------------------------------------------------------
-- View do ranking nacional — owner-postgres, SEM security_invoker: bypassa a
-- RLS de publicacoes/seguidores de propósito, para agregar o ranking NACIONAL
-- cross-org. A identidade já vem denormalizada nas linhas de publicacoes.
-- ----------------------------------------------------------------------------
create view public.ranking_comunidade as
select
  p.autor_id,
  max(p.autor_nome)     as autor_nome,
  max(p.autor_org)      as autor_org,
  max(p.autor_foto_url) as autor_foto_url,
  count(*)::int         as publicacoes,
  coalesce(sum(p.curtidas_count), 0)::int as curtidas_recebidas,
  (select count(*) from public.seguidores s where s.seguido_id = p.autor_id)::int
                        as seguidores
from public.publicacoes p
group by p.autor_id;

grant select on public.ranking_comunidade to authenticated;

-- ============================================================================
-- SEED — para feed/ranking/streak não nascerem vazios. Autores REAIS e
-- CROSS-ORG (Alfa + Beta). autor_id é passado explícito; o trigger denormaliza
-- nome/org/foto. Datas espalhadas nos últimos ~10 dias, com dias consecutivos
-- para o mesmo corretor (streak).
-- ============================================================================

insert into public.publicacoes (autor_id, conteudo, tipo, criado_em) values
  -- Corretor Alfa (Imobiliária Alfa) — 4 dias consecutivos (streak)
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
   'Fechei minha primeira venda do mês! Apartamento de 2 quartos no centro. Persistência compensa.',
   'conquista', now() - interval '9 days'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
   'Dica: sempre confirme a documentação do imóvel ANTES de agendar a visita. Economiza tempo de todo mundo.',
   'dica', now() - interval '8 days'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
   'Dia produtivo: 3 visitas agendadas e um lead quente que veio pelo Instagram.',
   'geral', now() - interval '7 days'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
   'Mais uma proposta enviada. Vamos que vamos, a meta do mês está logo ali!',
   'geral', now() - interval '6 days'),

  -- Bruno Gama (Imobiliária Alfa)
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
   'Bati minha meta de captações da semana. Bairro novo, oportunidades novas.',
   'conquista', now() - interval '5 days'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
   'Dica rápida: fotos com luz natural aumentam MUITO o interesse. Marque as visitas para a manhã.',
   'dica', now() - interval '2 days'),

  -- Gestor Alfa (Imobiliária Alfa)
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
   'Orgulhoso do time este mês. Todos os corretores acima de 80% da meta. Bora fechar forte!',
   'conquista', now() - interval '3 days'),

  -- Corretor Beta (Corretor Beta) — outra ORG, prova cross-org
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
   'Primeiro post por aqui! Corretor autônomo, foco em imóveis de alto padrão. Vamos trocar experiências.',
   'geral', now() - interval '4 days'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
   'Dica de quem é autônomo: CRM organizado é o que separa o amador do profissional. Não negligenciem.',
   'dica', now() - interval '1 days');

-- Curtidas cruzando orgs (Beta curte Alfa, Alfa curte Beta, etc.)
insert into public.publicacao_curtidas (publicacao_id, perfil_id)
select p.id, c.perfil_id
from public.publicacoes p
join (values
  -- Corretor Beta curte conquistas de Alfa (cross-org)
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid, 'conquista', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'::uuid),
  -- Gestor Alfa curte o post do Corretor Beta (cross-org)
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'::uuid, 'geral', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'::uuid),
  -- Bruno Gama curte a conquista do Corretor Alfa (mesma org)
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid, 'conquista', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'::uuid),
  -- Corretor Alfa curte a dica do Corretor Beta (cross-org)
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'::uuid, 'dica', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid),
  -- Corretor Beta curte a dica do Bruno Gama (cross-org)
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'::uuid, 'dica', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'::uuid)
) as c(autor_id, tipo, perfil_id)
  on p.autor_id = c.autor_id and p.tipo = c.tipo;

-- Seguidores cruzando orgs
insert into public.seguidores (seguidor_id, seguido_id) values
  -- Corretor Beta segue Corretor Alfa (cross-org)
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'),
  -- Corretor Alfa segue Corretor Beta (cross-org)
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'),
  -- Bruno Gama segue Corretor Alfa (mesma org)
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'),
  -- Corretor Beta segue Gestor Alfa (cross-org)
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'),
  -- Gestor Alfa segue Bruno Gama (mesma org)
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3');
