-- ============================================================================
-- 0021_newsletter.sql — Newsletter (ESCOPO.md §V2, item 16: newsletter /
-- automações de relacionamento por e-mail).
--
-- Duas tabelas:
--   - newsletter_inscricoes: captura ABERTA de e-mails no site (anon pode
--     inserir; consentimento LGPD registrado em consentiu_em). Leitura e
--     cancelamento (update) só por gestor/admin. Sem DELETE exposto.
--   - newsletter_edicoes: edição composta por uma imobiliária (org). org_id/
--     autor_id são forjados no trigger BEFORE INSERT (anti-forja), mesmo
--     padrão de privado.agenda_preencher_org. Escopo por org via
--     privado.org_atual(); futuro multi-remetente já suportado pelo org_id.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tabelas
-- ----------------------------------------------------------------------------

create table public.newsletter_inscricoes (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique
                check (email = lower(trim(email)) and email like '%@%'),
  nome          text,
  consentiu_em  timestamptz not null default now(),
  origem        text not null default 'site',
  cancelado_em  timestamptz,
  criado_em     timestamptz not null default now()
);

-- Índice parcial: a lista "ativa" (cancelado_em is null) é a consulta quente.
create index newsletter_inscricoes_ativas_idx
  on public.newsletter_inscricoes (cancelado_em)
  where cancelado_em is null;

create table public.newsletter_edicoes (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid references public.organizacoes(id),
  autor_id      uuid references public.perfis(id),
  titulo        text not null check (char_length(titulo) between 1 and 160),
  assunto       text not null check (char_length(assunto) between 1 and 160),
  introducao    text,
  imovel_ids    uuid[] not null default '{}',
  status        text not null default 'rascunho'
                check (status in ('rascunho', 'pronta', 'enviada')),
  enviada_em    timestamptz,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index newsletter_edicoes_org_id_idx
  on public.newsletter_edicoes (org_id);

-- ----------------------------------------------------------------------------
-- privado.newsletter_edicoes_preencher_org — BEFORE INSERT em newsletter_edicoes.
-- Deriva autor_id (default: usuário autenticado) e força org_id = org do autor
-- (anti-forja). SECURITY DEFINER, search_path vazio.
-- ----------------------------------------------------------------------------
create function privado.newsletter_edicoes_preencher_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.autor_id := coalesce(new.autor_id, auth.uid());
  new.org_id := coalesce(
    new.org_id,
    (select p.org_id from public.perfis p where p.id = new.autor_id)
  );
  return new;
end;
$$;

revoke execute on function privado.newsletter_edicoes_preencher_org()
  from public, anon, authenticated;

create trigger newsletter_edicoes_preencher_org
  before insert on public.newsletter_edicoes
  for each row execute function privado.newsletter_edicoes_preencher_org();

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------

alter table public.newsletter_inscricoes enable row level security;
alter table public.newsletter_edicoes    enable row level security;

-- INSERT público (captura aberta no site). O UNIQUE(email) segura duplicata.
create policy newsletter_inscricoes_insert on public.newsletter_inscricoes
  for insert to anon, authenticated
  with check (true);

-- SELECT/UPDATE: gestor/admin de qualquer org (demo: lista compartilhada).
create policy newsletter_inscricoes_select on public.newsletter_inscricoes
  for select to authenticated
  using (privado.papel_atual() in ('gestor', 'admin'));

create policy newsletter_inscricoes_update on public.newsletter_inscricoes
  for update to authenticated
  using (privado.papel_atual() in ('gestor', 'admin'))
  with check (privado.papel_atual() in ('gestor', 'admin'));

-- Sem policy de DELETE: ninguém apaga inscrição via API (auditoria LGPD).

-- Edições: gestor/admin da PRÓPRIA org.
create policy newsletter_edicoes_select on public.newsletter_edicoes
  for select to authenticated
  using (
    privado.papel_atual() in ('gestor', 'admin')
    and org_id = privado.org_atual()
  );

create policy newsletter_edicoes_insert on public.newsletter_edicoes
  for insert to authenticated
  with check (
    privado.papel_atual() in ('gestor', 'admin')
    and org_id = privado.org_atual()
  );

create policy newsletter_edicoes_update on public.newsletter_edicoes
  for update to authenticated
  using (
    privado.papel_atual() in ('gestor', 'admin')
    and org_id = privado.org_atual()
  )
  with check (org_id = privado.org_atual());
