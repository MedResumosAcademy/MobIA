-- ============================================================================
-- 0004_fix_signup_e_org_do_imovel.sql — Correções de segurança
--
-- Corrige dois achados:
--   1. (ALTA) Escalada por signup: privado.handle_new_user confiava em
--      papel/org_id do raw_user_meta_data (controlado pelo cliente) para
--      promover a corretor/gestor, validando APENAS a existência da org.
--      Como org_id é público (catálogo), qualquer um fazia signup self-service
--      como gestor/corretor de org alheia e lia todo o tenant. CORREÇÃO: o
--      metadata NUNCA promove; o usuário nasce sempre 'cliente' (org null).
--      Promoção só via CONVITE assinado (privado.convites) emitido
--      server-side (service_role/gestor), consumido por token no signup.
--   2. (MÉDIA) Injeção/enumeração cross-tenant: definir_org_do_imovel
--      carimbava org_id de QUALQUER imóvel referenciado (SECURITY DEFINER,
--      ignora RLS), permitindo a um cliente externo apontar
--      eventos/favoritos/simulacoes para imóvel não visível e (a) descobrir o
--      dono e (b) poluir o pipeline da org vítima. CORREÇÃO: só carimba se o
--      imóvel for do catálogo público (status 'disponivel' ou com unidade
--      'disponivel') OU se o insertor for membro da própria org; senão rejeita.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- privado.convites — convites assinados para promover a corretor/gestor.
-- Fora do schema public → NÃO exposto pelo PostgREST. Sem grants a
-- authenticated/anon: só service_role/postgres e funções SECURITY DEFINER
-- (handle_new_user) acessam. Emissão de convites é operação server-side.
-- ----------------------------------------------------------------------------
create table privado.convites (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizacoes (id),
  papel         text not null check (papel in ('corretor', 'gestor')),
  -- Token opaco entregue ao convidado; usado no signup (metadata.convite_token).
  token         text not null unique,
  -- Se preenchido, o convite só vale para este e-mail (defesa extra).
  email         text,
  expira_em     timestamptz not null default (now() + interval '7 days'),
  consumido_em  timestamptz,
  consumido_por uuid references auth.users (id),
  criado_em     timestamptz not null default now()
);

-- RLS habilitada e SEM policy → nega todo acesso via API (deny-by-default);
-- apenas service_role/postgres (bypass) e definer functions leem/escrevem.
alter table privado.convites enable row level security;

-- ----------------------------------------------------------------------------
-- handle_new_user (substitui a versão do 0002).
-- Regra dura: papel/org_id do metadata são IGNORADOS. Todo signup nasce
-- 'cliente' (org null). Só um CONVITE válido (token não consumido, não
-- expirado, papel corretor/gestor e, se o convite fixa e-mail, batendo com o
-- do signup) promove — consumindo o convite atomicamente.
-- ----------------------------------------------------------------------------
create or replace function privado.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token   text;
  v_convite privado.convites%rowtype;
  v_papel   text := 'cliente';
  v_org     uuid := null;
begin
  v_token := nullif(new.raw_user_meta_data ->> 'convite_token', '');

  if v_token is not null then
    select * into v_convite
    from privado.convites c
    where c.token = v_token
      and c.consumido_em is null
      and c.expira_em > now()
      and c.papel in ('corretor', 'gestor')
    for update;

    if found
       and (v_convite.email is null
            or lower(v_convite.email) = lower(new.email)) then
      v_papel := v_convite.papel;
      v_org   := v_convite.org_id;
      update privado.convites
        set consumido_em = now(), consumido_por = new.id
        where id = v_convite.id;
    end if;
  end if;

  insert into public.perfis (id, papel, org_id, nome)
  values (new.id, v_papel, v_org, nullif(new.raw_user_meta_data ->> 'nome', ''));

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- definir_org_do_imovel (substitui a versão do 0002).
-- Só carimba org_id se o imóvel for do catálogo público (status 'disponivel'
-- ou com alguma unidade 'disponivel') OU se o insertor for membro da própria
-- org do imóvel (uso interno legítimo). Caso contrário, REJEITA o INSERT —
-- impede que um cliente externo aponte registros para imóvel invisível
-- (enumeração do dono + poluição do pipeline da org vítima).
-- ----------------------------------------------------------------------------
create or replace function privado.definir_org_do_imovel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org     uuid;
  v_visivel boolean;
begin
  if new.imovel_id is null then
    new.org_id := null;
    return new;
  end if;

  select i.org_id,
         (i.status = 'disponivel'
          or exists (select 1 from public.unidades u
                     where u.imovel_id = i.id and u.status = 'disponivel'))
    into v_org, v_visivel
  from public.imoveis i
  where i.id = new.imovel_id;

  if v_org is null then
    raise exception 'imóvel inexistente' using errcode = '23503';
  end if;

  -- Fora do catálogo público e não é da própria org do insertor → bloqueia.
  if not v_visivel and v_org is distinct from privado.org_atual() then
    raise exception 'imóvel não disponível para esta ação'
      using errcode = '42501'; -- insufficient_privilege
  end if;

  new.org_id := v_org;
  return new;
end;
$$;
