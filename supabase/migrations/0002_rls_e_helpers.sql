-- ============================================================================
-- 0002_rls_e_helpers.sql — RLS, funções auxiliares e triggers de segurança
--
-- Modelo (H-03/H-04): negar por padrão — RLS habilitada em TODAS as tabelas;
-- sem policy para um comando = comando negado. Uma policy por comando, com
-- TO explícito e USING/WITH CHECK sempre que couber.
--
-- Papéis de aplicação (perfis.papel): cliente | corretor | gestor | admin.
-- Isolamento multi-tenant: corretor/gestor só enxergam dados da própria org.
-- Dados financeiros do cliente (cliente_profiles) são PRIVADOS do cliente.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Schema privado — funções auxiliares fora do schema public (não expostas
-- pela API do PostgREST).
-- ----------------------------------------------------------------------------
create schema privado;

revoke all on schema privado from public;
grant usage on schema privado to authenticated;

-- privado.papel_atual() — papel do usuário autenticado.
-- SECURITY DEFINER: lê public.perfis SEM passar pela RLS de perfis, evitando
-- recursão de policy (policy de perfis usa esta função). STABLE: cacheável
-- dentro do statement. search_path vazio: só referências qualificadas.
create function privado.papel_atual()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select papel from public.perfis where id = (select auth.uid());
$$;

-- privado.org_atual() — organização do usuário autenticado (null p/ cliente).
create function privado.org_atual()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select org_id from public.perfis where id = (select auth.uid());
$$;

-- Execução restrita: apenas usuários autenticados (as policies rodam com o
-- papel do chamador; anon não usa essas funções em nenhuma policy).
revoke execute on function privado.papel_atual() from public, anon;
revoke execute on function privado.org_atual()   from public, anon;
grant execute on function privado.papel_atual() to authenticated;
grant execute on function privado.org_atual()   to authenticated;

-- ----------------------------------------------------------------------------
-- Habilitar RLS em TODAS as tabelas do 0001 (sem exceção).
-- Sem FORCE: o owner (postgres/service_role em migrações e jobs server-side,
-- ex.: criação automática de leads) precisa passar por cima da RLS.
-- ----------------------------------------------------------------------------
alter table public.organizacoes           enable row level security;
alter table public.perfis                 enable row level security;
alter table public.cliente_profiles       enable row level security;
alter table public.corretor_profiles      enable row level security;
alter table public.imoveis                enable row level security;
alter table public.unidades               enable row level security;
alter table public.simulacoes             enable row level security;
alter table public.eventos                enable row level security;
alter table public.leads                  enable row level security;
alter table public.favoritos              enable row level security;
alter table public.parametros_financeiros enable row level security;

-- ----------------------------------------------------------------------------
-- organizacoes — membro vê a própria org; admin vê todas. Sem escrita via API
-- (criação/gestão de orgs é operação administrativa server-side).
-- ----------------------------------------------------------------------------
create policy organizacoes_select on public.organizacoes
  for select to authenticated
  using (id = privado.org_atual() or privado.papel_atual() = 'admin');

-- ----------------------------------------------------------------------------
-- perfis — o usuário vê o próprio perfil; gestor/admin veem os perfis da
-- própria org. UPDATE apenas no próprio perfil; a proteção contra escalada de
-- papel/org NÃO fica na policy (auto-referência a perfis sob RLS é frágil) e
-- sim no trigger BEFORE UPDATE privado.bloquear_escalada_perfis (abaixo).
-- Sem INSERT/DELETE: criação via trigger handle_new_user; remoção via cascade
-- de auth.users.
-- ----------------------------------------------------------------------------
create policy perfis_select on public.perfis
  for select to authenticated
  using (
    id = (select auth.uid())
    or (privado.papel_atual() in ('gestor', 'admin') and org_id = privado.org_atual())
  );

create policy perfis_update on public.perfis
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ----------------------------------------------------------------------------
-- cliente_profiles — PRIVACIDADE FINANCEIRA: somente o próprio cliente lê e
-- escreve; corretor/gestor NÃO veem renda/FGTS de ninguém. Sem DELETE (limpeza
-- via cascade de perfis).
-- ----------------------------------------------------------------------------
create policy cliente_profiles_select on public.cliente_profiles
  for select to authenticated
  using (usuario_id = (select auth.uid()));

create policy cliente_profiles_insert on public.cliente_profiles
  for insert to authenticated
  with check (usuario_id = (select auth.uid()));

create policy cliente_profiles_update on public.cliente_profiles
  for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

-- ----------------------------------------------------------------------------
-- corretor_profiles — o corretor vê o próprio; gestor/admin veem os da org.
-- Sem escrita via API (onboarding de corretor é server-side).
-- ----------------------------------------------------------------------------
create policy corretor_profiles_select on public.corretor_profiles
  for select to authenticated
  using (
    usuario_id = (select auth.uid())
    or (privado.papel_atual() in ('gestor', 'admin') and org_id = privado.org_atual())
  );

-- ----------------------------------------------------------------------------
-- imoveis — catálogo público: qualquer pessoa (anon incluso) vê imóveis
-- disponíveis; corretor/gestor veem TODOS os imóveis da própria org (inclusive
-- reservados/vendidos) e gerenciam o CRUD dentro da org (H-23).
-- Exceção deliberada ao "uma policy por comando": SELECT tem duas policies
-- permissivas (público + org), combinadas por OR pelo Postgres.
-- ----------------------------------------------------------------------------
create policy imoveis_select_publico on public.imoveis
  for select to anon, authenticated
  using (status = 'disponivel');

create policy imoveis_select_org on public.imoveis
  for select to authenticated
  using (
    org_id = privado.org_atual()
    and privado.papel_atual() in ('corretor', 'gestor')
  );

create policy imoveis_insert on public.imoveis
  for insert to authenticated
  with check (
    org_id = privado.org_atual()
    and privado.papel_atual() in ('corretor', 'gestor')
  );

create policy imoveis_update on public.imoveis
  for update to authenticated
  using (
    org_id = privado.org_atual()
    and privado.papel_atual() in ('corretor', 'gestor')
  )
  with check (
    org_id = privado.org_atual()
    and privado.papel_atual() in ('corretor', 'gestor')
  );

create policy imoveis_delete on public.imoveis
  for delete to authenticated
  using (
    org_id = privado.org_atual()
    and privado.papel_atual() in ('corretor', 'gestor')
  );

-- ----------------------------------------------------------------------------
-- unidades — mesmas regras de imoveis. Decisão (simplicidade): o SELECT
-- público olha o status da PRÓPRIA unidade, sem join no imóvel pai — uma
-- unidade 'disponivel' de imóvel não-disponível fica visível; o catálogo
-- chega pela ficha do imóvel, que já é filtrada.
-- ----------------------------------------------------------------------------
create policy unidades_select_publico on public.unidades
  for select to anon, authenticated
  using (status = 'disponivel');

create policy unidades_select_org on public.unidades
  for select to authenticated
  using (
    org_id = privado.org_atual()
    and privado.papel_atual() in ('corretor', 'gestor')
  );

create policy unidades_insert on public.unidades
  for insert to authenticated
  with check (
    org_id = privado.org_atual()
    and privado.papel_atual() in ('corretor', 'gestor')
  );

create policy unidades_update on public.unidades
  for update to authenticated
  using (
    org_id = privado.org_atual()
    and privado.papel_atual() in ('corretor', 'gestor')
  )
  with check (
    org_id = privado.org_atual()
    and privado.papel_atual() in ('corretor', 'gestor')
  );

create policy unidades_delete on public.unidades
  for delete to authenticated
  using (
    org_id = privado.org_atual()
    and privado.papel_atual() in ('corretor', 'gestor')
  );

-- ----------------------------------------------------------------------------
-- simulacoes — cliente autenticado insere a PRÓPRIA simulação (org_id é
-- sobrescrito por trigger anti-forja); lê as próprias; corretor/gestor leem
-- as da org (sinal de lead). Simulação de visitante anônimo (cliente_id null)
-- é persistida server-side (service_role), não via policy.
-- Sem UPDATE/DELETE: simulação é snapshot imutável.
-- ----------------------------------------------------------------------------
create policy simulacoes_insert on public.simulacoes
  for insert to authenticated
  with check (cliente_id = (select auth.uid()));

create policy simulacoes_select on public.simulacoes
  for select to authenticated
  using (
    cliente_id = (select auth.uid())
    or (privado.papel_atual() in ('corretor', 'gestor') and org_id = privado.org_atual())
  );

-- ----------------------------------------------------------------------------
-- eventos — mesmas regras de simulacoes: cliente registra o próprio evento
-- (org_id sobrescrito por trigger), lê os próprios; corretor/gestor leem os
-- da org (timeline/scoring). Sem UPDATE/DELETE: log imutável.
-- ----------------------------------------------------------------------------
create policy eventos_insert on public.eventos
  for insert to authenticated
  with check (cliente_id = (select auth.uid()));

create policy eventos_select on public.eventos
  for select to authenticated
  using (
    cliente_id = (select auth.uid())
    or (privado.papel_atual() in ('corretor', 'gestor') and org_id = privado.org_atual())
  );

-- ----------------------------------------------------------------------------
-- favoritos — o cliente cria, remove e lê os próprios favoritos (org_id
-- sobrescrito por trigger); corretor/gestor leem os da org (sinal de lead).
-- ----------------------------------------------------------------------------
create policy favoritos_insert on public.favoritos
  for insert to authenticated
  with check (cliente_id = (select auth.uid()));

create policy favoritos_delete on public.favoritos
  for delete to authenticated
  using (cliente_id = (select auth.uid()));

create policy favoritos_select on public.favoritos
  for select to authenticated
  using (
    cliente_id = (select auth.uid())
    or (privado.papel_atual() in ('corretor', 'gestor') and org_id = privado.org_atual())
  );

-- ----------------------------------------------------------------------------
-- leads — corretor vê os leads atribuídos a ele; gestor/admin veem os da org.
-- Sem INSERT/UPDATE/DELETE por usuários: leads são criados/enriquecidos
-- automaticamente server-side a partir dos eventos (H-22).
-- ----------------------------------------------------------------------------
create policy leads_select on public.leads
  for select to authenticated
  using (
    (corretor_id = (select auth.uid()) and privado.papel_atual() = 'corretor')
    or (privado.papel_atual() in ('gestor', 'admin') and org_id = privado.org_atual())
  );

-- ----------------------------------------------------------------------------
-- parametros_financeiros — leitura pública (o simulador roda para visitante
-- anônimo). Sem escrita via API: novas versões entram por migração/operador.
-- ----------------------------------------------------------------------------
create policy parametros_financeiros_select on public.parametros_financeiros
  for select to anon, authenticated
  using (true);

-- ============================================================================
-- Triggers de segurança
-- ============================================================================

-- ----------------------------------------------------------------------------
-- handle_new_user — cria public.perfis a cada signup (AFTER INSERT em
-- auth.users). Regras anti-abuso sobre o metadata (controlado pelo cliente):
--   - papel 'admin' NUNCA é aceito do metadata (rebaixa para 'cliente');
--   - papel desconhecido vira 'cliente';
--   - org_id só é aceito para corretor/gestor E se a organização existir;
--     sem org válida, corretor/gestor é rebaixado para 'cliente' (o check
--     perfis_corretor_gestor_exigem_org exige org para esses papéis).
-- ----------------------------------------------------------------------------
create function privado.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_papel text;
  v_org   uuid;
begin
  v_papel := coalesce(nullif(new.raw_user_meta_data ->> 'papel', ''), 'cliente');

  -- Segurança: admin jamais nasce de metadata de signup.
  if v_papel = 'admin' or v_papel not in ('cliente', 'corretor', 'gestor') then
    v_papel := 'cliente';
  end if;

  if v_papel in ('corretor', 'gestor') then
    -- org_id do metadata apenas se for uuid válido e a organização existir.
    begin
      v_org := nullif(new.raw_user_meta_data ->> 'org_id', '')::uuid;
    exception when invalid_text_representation then
      v_org := null;
    end;
    if v_org is not null
       and not exists (select 1 from public.organizacoes o where o.id = v_org) then
      v_org := null;
    end if;
    -- Corretor/gestor sem org válida é rebaixado para cliente.
    if v_org is null then
      v_papel := 'cliente';
    end if;
  else
    v_org := null;
  end if;

  insert into public.perfis (id, papel, org_id, nome)
  values (new.id, v_papel, v_org, nullif(new.raw_user_meta_data ->> 'nome', ''));

  return new;
end;
$$;

revoke execute on function privado.handle_new_user() from public, anon, authenticated;

create trigger handle_new_user
  after insert on auth.users
  for each row execute function privado.handle_new_user();

-- ----------------------------------------------------------------------------
-- definir_org_do_imovel — BEFORE INSERT em simulacoes/eventos/favoritos:
-- org_id é SEMPRE derivado do imóvel referenciado, sobrescrevendo qualquer
-- valor vindo do cliente (anti-forja: impede plantar dados na org alheia ou
-- esconder o sinal de lead da org dona do imóvel). Sem imovel_id (eventos
-- globais, ex.: sonhometro_completo), org_id é anulado pela mesma razão.
-- SECURITY DEFINER: lê public.imoveis sem depender da policy de SELECT do
-- chamador (o imóvel pode não estar 'disponivel').
-- ----------------------------------------------------------------------------
create function privado.definir_org_do_imovel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.imovel_id is not null then
    select i.org_id into new.org_id
    from public.imoveis i
    where i.id = new.imovel_id;
  else
    new.org_id := null;
  end if;
  return new;
end;
$$;

revoke execute on function privado.definir_org_do_imovel() from public, anon, authenticated;

create trigger definir_org_do_imovel
  before insert on public.simulacoes
  for each row execute function privado.definir_org_do_imovel();

create trigger definir_org_do_imovel
  before insert on public.eventos
  for each row execute function privado.definir_org_do_imovel();

create trigger definir_org_do_imovel
  before insert on public.favoritos
  for each row execute function privado.definir_org_do_imovel();

-- ----------------------------------------------------------------------------
-- bloquear_escalada_perfis — BEFORE UPDATE em perfis (anti-escalada):
-- impede que o usuário altere o próprio papel ou org_id via UPDATE (a policy
-- perfis_update só exige id = auth.uid(); a imutabilidade fica AQUI, porque
-- policy com subselect auto-referente em perfis sob RLS é frágil).
--
-- DECISÃO (bypass para conexões de serviço): a checagem é liberada quando
-- auth.uid() é null. auth.uid() lê o claim 'sub' de request.jwt.claims;
-- conexões service_role e postgres (migrações, jobs, painel admin server-side)
-- não carregam claim 'sub', então auth.uid() é null e o UPDATE passa. Um
-- usuário final via API (anon/authenticated) sempre tem 'sub' preenchido —
-- não há como um cliente chegar aqui com auth.uid() null. Preferimos
-- auth.uid() a current_setting('request.jwt.claims') cru porque o service_role
-- via PostgREST TEM claims (role), mas não tem 'sub'.
-- ----------------------------------------------------------------------------
create function privado.bloquear_escalada_perfis()
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

  if new.papel is distinct from old.papel then
    raise exception 'não é permitido alterar o próprio papel'
      using errcode = '42501'; -- insufficient_privilege
  end if;

  if new.org_id is distinct from old.org_id then
    raise exception 'não é permitido alterar a própria organização'
      using errcode = '42501'; -- insufficient_privilege
  end if;

  return new;
end;
$$;

revoke execute on function privado.bloquear_escalada_perfis() from public, anon, authenticated;

create trigger bloquear_escalada_perfis
  before update on public.perfis
  for each row execute function privado.bloquear_escalada_perfis();
