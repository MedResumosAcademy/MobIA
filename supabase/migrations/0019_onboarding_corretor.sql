-- ============================================================================
-- 0019 — Onboarding do corretor
-- Novos campos em corretor_profiles para o wizard de onboarding:
--   cpf (sensível — nunca expor publicamente), vendas prévias (valor em
--   CENTAVOS + quantidade), consentimento de foto (permitir_foto) e o
--   timestamp de conclusão (onboarding_em).
-- Backfill: usuários existentes (seed/demo) são marcados como onboarded e com
-- foto permitida, para não caírem no wizard nem sumirem as fotos demo do feed.
-- Trigger privado.publicacoes_preencher_autor passa a respeitar permitir_foto.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Novas colunas
-- ----------------------------------------------------------------------------

alter table public.corretor_profiles
  add column cpf text
    constraint corretor_profiles_cpf_check
    check (cpf is null or cpf ~ '^[0-9]{11}$'),
  add column vendas_previas_valor bigint
    constraint corretor_profiles_vendas_previas_valor_check
    check (vendas_previas_valor is null or vendas_previas_valor >= 0),
  add column vendas_previas_qtd int
    constraint corretor_profiles_vendas_previas_qtd_check
    check (vendas_previas_qtd is null or vendas_previas_qtd >= 0),
  add column permitir_foto boolean not null default false,
  add column onboarding_em timestamptz;

comment on column public.corretor_profiles.cpf is
  'somente digitos; dado sensivel — nunca expor em paginas publicas';
comment on column public.corretor_profiles.vendas_previas_valor is
  'Valor total de vendas previas ao ImobIA, em CENTAVOS.';
comment on column public.corretor_profiles.vendas_previas_qtd is
  'Quantidade de vendas previas ao ImobIA.';
comment on column public.corretor_profiles.permitir_foto is
  'Consentimento do corretor para exibir sua foto na comunidade/feed (denormalizada em publicacoes.autor_foto_url).';
comment on column public.corretor_profiles.onboarding_em is
  'Quando o corretor concluiu o wizard de onboarding; null = ainda nao passou pelo wizard.';

-- ----------------------------------------------------------------------------
-- 2) Backfill — usuarios existentes (seed/demo) nao caem no wizard e as fotos
--    demo continuam aparecendo.
-- ----------------------------------------------------------------------------

update public.corretor_profiles
   set onboarding_em = now(),
       permitir_foto = true
 where onboarding_em is null;

-- ----------------------------------------------------------------------------
-- 3) Trigger publicacoes_preencher_autor — denormaliza autor_foto_url SOMENTE
--    se permitir_foto for true (senao null). Resto inalterado.
-- ----------------------------------------------------------------------------

create or replace function privado.publicacoes_preencher_autor()
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
    select case when permitir_foto then foto_url else null end
    from corretor_profiles
    where usuario_id = new.autor_id
  );

  return new;
end;
$$;

revoke execute on function privado.publicacoes_preencher_autor() from public, anon, authenticated;
