-- ============================================================================
-- 0026_crm_contatos.sql — CRM 2.0: contatos, mensagens (WhatsApp/Instagram),
-- campanhas e envios de campanha. Fundação para a Meta WhatsApp Cloud API.
--
-- Entidades:
--   - public.contatos        — agenda de contatos da org (dono = responsavel_id).
--   - public.mensagens       — histórico de mensagens por contato (entrada/saída).
--   - public.campanhas       — disparos em massa segmentados (gestor/admin).
--   - public.campanha_envios — 1 linha por contato-alvo de cada campanha.
--
-- Visibilidade (RLS, multi-tenant por org via privado.org_atual()/papel_atual()):
--   - contatos: TODA a org (corretor/gestor/admin) vê — colaboração; UPDATE só
--     responsável OU gestor/admin.
--   - mensagens: org-scoped; o webhook da Meta insere via SERVICE ROLE (bypassa
--     RLS por design — o trigger anti-forja ainda deriva a org do contato).
--   - campanhas/envios: gestor/admin criam e gerenciam; corretor só lê.
--
-- BACKFILL (documentado na seção 7):
--   a) contatos a partir de negocios (origem 'funil'), telefone normalizado
--      para dígitos com DDI 55, dedup por (org, telefone) ficando o negócio
--      mais recente; sem telefone, dedup best-effort por (org, lower(nome)).
--   b) negocios.contato_id (coluna nova) ligado pelos mesmos critérios.
--   c) leads CONSENTIDOS de clientes com telefone → contato com cliente_id
--      (origem 'lead') e consentimento_marketing_em = NULL. LGPD: o
--      consentimento dado foi para COMPARTILHAR DADOS DE NAVEGAÇÃO com o
--      corretor (finalidade: atendimento), NÃO para receber MARKETING ativo.
--      Finalidades distintas exigem consentimentos distintos (LGPD art. 8º §4º)
--      — portanto marketing começa NULO e será coletado explicitamente.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) privado.normalizar_telefone(text) — só dígitos, com DDI 55.
--    '11 98888-7777' → '5511988887777'; '+55 (11) 98888-7777' → '5511988887777';
--    vazio/curto/irreconhecível → NULL (best-effort, nunca inventa número).
-- ----------------------------------------------------------------------------
create function privado.normalizar_telefone(t text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when s.d = '' then null
    when length(s.d) between 12 and 13 and s.d like '55%' then s.d
    when length(s.d) between 10 and 11 then '55' || s.d
    else null
  end
  from (select regexp_replace(coalesce(t, ''), '[^0-9]', '', 'g')) as s(d);
$$;

revoke execute on function privado.normalizar_telefone(text) from public, anon;
grant execute on function privado.normalizar_telefone(text) to authenticated;

-- ----------------------------------------------------------------------------
-- 1) public.contatos — agenda de contatos da org.
-- ----------------------------------------------------------------------------
create table public.contatos (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizacoes(id),
  -- corretor dono do contato (quem atende).
  responsavel_id  uuid not null references public.perfis(id),
  nome            text not null
                    check (char_length(btrim(nome)) between 1 and 160),
  -- só dígitos com DDI (ex.: 5511988887777) — normalizado na aplicação (zod)
  -- e no backfill via privado.normalizar_telefone().
  telefone        text
                    check (telefone is null or telefone ~ '^[0-9]{8,15}$'),
  email           text,
  -- vínculo quando o contato É um cliente da plataforma.
  cliente_id      uuid references public.perfis(id),
  origem          text not null default 'manual',
  tags            text[] not null default '{}',
  -- LGPD: carimbo do OPT-IN de marketing (NULL = sem consentimento de marketing).
  consentimento_marketing_em timestamptz,
  consentimento_fonte        text,
  observacao      text,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz
);

-- Dedup por org: um telefone só aparece 1x por org (parcial: NULL permitido).
-- Este índice também serve às consultas por (org_id, telefone).
create unique index contatos_org_telefone_unico
  on public.contatos (org_id, telefone)
  where telefone is not null;

create index contatos_org_responsavel_idx on public.contatos (org_id, responsavel_id);
create index contatos_cliente_id_idx      on public.contatos (cliente_id);

-- ----------------------------------------------------------------------------
-- 2) public.mensagens — histórico de mensagens por contato.
--    meta_message_id: id da Meta (wamid...) — UNIQUE parcial = dedup de webhook
--    (a Meta reentrega eventos; o INSERT duplicado falha/ignora com segurança).
-- ----------------------------------------------------------------------------
create table public.mensagens (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizacoes(id),
  contato_id      uuid not null references public.contatos(id) on delete cascade,
  negocio_id      uuid references public.negocios(id),
  canal           text not null default 'whatsapp'
                    check (canal in ('whatsapp', 'instagram')),
  direcao         text not null
                    check (direcao in ('entrada', 'saida')),
  corpo           text not null,
  template_nome   text,
  status          text not null default 'pendente'
                    check (status in ('pendente', 'enviada', 'entregue', 'lida',
                                      'falhou', 'recebida')),
  meta_message_id text,
  erro            text,
  criado_em       timestamptz not null default now()
);

create unique index mensagens_meta_message_id_unico
  on public.mensagens (meta_message_id)
  where meta_message_id is not null;

create index mensagens_contato_criado_idx on public.mensagens (contato_id, criado_em desc);
create index mensagens_org_criado_idx     on public.mensagens (org_id, criado_em desc);
create index mensagens_negocio_id_idx     on public.mensagens (negocio_id);

-- ----------------------------------------------------------------------------
-- 3) public.campanhas + public.campanha_envios — disparos segmentados.
--    segmento (jsonb): ex. {"etapas":["proposta"],
--                           "temperaturas":["pronto_para_compra"],
--                           "tags":["vip"]} — validado pelo zod (segmentoSchema).
-- ----------------------------------------------------------------------------
create table public.campanhas (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizacoes(id),
  autor_id       uuid not null references public.perfis(id),
  nome           text not null
                   check (char_length(btrim(nome)) between 1 and 120),
  -- corpo livre OU referência de template (quando template_nome preenchido).
  mensagem       text not null,
  template_nome  text,
  segmento       jsonb not null default '{}',
  status         text not null default 'rascunho'
                   check (status in ('rascunho', 'pronta', 'enviando',
                                     'concluida', 'falhou')),
  total_alvo     integer not null default 0,
  total_enviado  integer not null default 0,
  total_falha    integer not null default 0,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz
);

create index campanhas_org_id_idx  on public.campanhas (org_id);
create index campanhas_autor_id_idx on public.campanhas (autor_id);

create table public.campanha_envios (
  id          uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references public.campanhas(id) on delete cascade,
  contato_id  uuid not null references public.contatos(id) on delete cascade,
  org_id      uuid not null references public.organizacoes(id),
  status      text not null default 'pendente'
                check (status in ('pendente', 'enviado', 'falhou',
                                  'sem_consentimento', 'sem_telefone')),
  mensagem_id uuid references public.mensagens(id),
  erro        text,
  criado_em   timestamptz not null default now(),
  constraint campanha_envios_unico unique (campanha_id, contato_id)
);

create index campanha_envios_contato_id_idx  on public.campanha_envios (contato_id);
create index campanha_envios_org_id_idx      on public.campanha_envios (org_id);
create index campanha_envios_mensagem_id_idx on public.campanha_envios (mensagem_id);

-- ----------------------------------------------------------------------------
-- 4) Triggers anti-forja + atualizado_em (padrão privado.* SECURITY DEFINER).
-- ----------------------------------------------------------------------------

-- BEFORE INSERT contatos: responsável/org derivados da sessão quando omitidos.
create function privado.contatos_preencher_sessao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.responsavel_id := coalesce(new.responsavel_id, auth.uid());
  new.org_id := coalesce(
    new.org_id,
    (select p.org_id from public.perfis p where p.id = new.responsavel_id)
  );
  return new;
end;
$$;

revoke execute on function privado.contatos_preencher_sessao()
  from public, anon, authenticated;

create trigger contatos_preencher_sessao
  before insert on public.contatos
  for each row execute function privado.contatos_preencher_sessao();

-- BEFORE UPDATE (contatos e campanhas): carimba atualizado_em.
create function privado.crm_tocar_atualizado_em()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

revoke execute on function privado.crm_tocar_atualizado_em()
  from public, anon, authenticated;

create trigger contatos_tocar_atualizado_em
  before update on public.contatos
  for each row execute function privado.crm_tocar_atualizado_em();

create trigger campanhas_tocar_atualizado_em
  before update on public.campanhas
  for each row execute function privado.crm_tocar_atualizado_em();

-- BEFORE INSERT mensagens: org SEMPRE derivada do contato (anti-forja — vale
-- também para o service role do webhook); negócio, se houver, deve ser da
-- mesma org do contato.
create function privado.mensagens_preencher_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select c.org_id into new.org_id
    from public.contatos c
   where c.id = new.contato_id;

  if new.negocio_id is not null and not exists (
    select 1 from public.negocios n
     where n.id = new.negocio_id and n.org_id = new.org_id
  ) then
    raise exception 'negocio % nao pertence a org do contato', new.negocio_id;
  end if;

  return new;
end;
$$;

revoke execute on function privado.mensagens_preencher_org()
  from public, anon, authenticated;

create trigger mensagens_preencher_org
  before insert on public.mensagens
  for each row execute function privado.mensagens_preencher_org();

-- BEFORE INSERT campanhas: autor/org derivados da sessão quando omitidos.
create function privado.campanhas_preencher_sessao()
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

revoke execute on function privado.campanhas_preencher_sessao()
  from public, anon, authenticated;

create trigger campanhas_preencher_sessao
  before insert on public.campanhas
  for each row execute function privado.campanhas_preencher_sessao();

-- BEFORE INSERT campanha_envios: org derivada da campanha (anti-forja).
create function privado.campanha_envios_preencher_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select ca.org_id into new.org_id
    from public.campanhas ca
   where ca.id = new.campanha_id;

  return new;
end;
$$;

revoke execute on function privado.campanha_envios_preencher_org()
  from public, anon, authenticated;

create trigger campanha_envios_preencher_org
  before insert on public.campanha_envios
  for each row execute function privado.campanha_envios_preencher_org();

-- ----------------------------------------------------------------------------
-- 5) RLS
-- ----------------------------------------------------------------------------
alter table public.contatos        enable row level security;
alter table public.mensagens       enable row level security;
alter table public.campanhas       enable row level security;
alter table public.campanha_envios enable row level security;

-- contatos: toda a equipe da org VÊ (colaboração)...
create policy contatos_select on public.contatos
  for select to authenticated
  using (
    org_id = privado.org_atual()
    and privado.papel_atual() = any (array['corretor'::text, 'gestor'::text, 'admin'::text])
  );

create policy contatos_insert on public.contatos
  for insert to authenticated
  with check (
    org_id = privado.org_atual()
    and privado.papel_atual() = any (array['corretor'::text, 'gestor'::text, 'admin'::text])
  );

-- ...mas só o responsável OU gestor/admin EDITAM.
create policy contatos_update on public.contatos
  for update to authenticated
  using (
    org_id = privado.org_atual()
    and (
      (responsavel_id = (select auth.uid()) and privado.papel_atual() = 'corretor')
      or privado.papel_atual() = any (array['gestor'::text, 'admin'::text])
    )
  )
  with check (org_id = privado.org_atual());

-- mensagens: org-scoped para a equipe. O webhook insere/atualiza via SERVICE
-- ROLE (bypassa RLS — intencional); estas policies valem para o app.
create policy mensagens_select on public.mensagens
  for select to authenticated
  using (
    org_id = privado.org_atual()
    and privado.papel_atual() = any (array['corretor'::text, 'gestor'::text, 'admin'::text])
  );

create policy mensagens_insert on public.mensagens
  for insert to authenticated
  with check (
    org_id = privado.org_atual()
    and privado.papel_atual() = any (array['corretor'::text, 'gestor'::text, 'admin'::text])
  );

create policy mensagens_update on public.mensagens
  for update to authenticated
  using (
    org_id = privado.org_atual()
    and privado.papel_atual() = any (array['corretor'::text, 'gestor'::text, 'admin'::text])
  )
  with check (org_id = privado.org_atual());

-- campanhas: gestor/admin criam/gerenciam; corretor lê (transparência do time).
create policy campanhas_select on public.campanhas
  for select to authenticated
  using (
    org_id = privado.org_atual()
    and privado.papel_atual() = any (array['corretor'::text, 'gestor'::text, 'admin'::text])
  );

create policy campanhas_insert on public.campanhas
  for insert to authenticated
  with check (
    org_id = privado.org_atual()
    and privado.papel_atual() = any (array['gestor'::text, 'admin'::text])
  );

create policy campanhas_update on public.campanhas
  for update to authenticated
  using (
    org_id = privado.org_atual()
    and privado.papel_atual() = any (array['gestor'::text, 'admin'::text])
  )
  with check (org_id = privado.org_atual());

-- campanha_envios: mesmo desenho das campanhas.
create policy campanha_envios_select on public.campanha_envios
  for select to authenticated
  using (
    org_id = privado.org_atual()
    and privado.papel_atual() = any (array['corretor'::text, 'gestor'::text, 'admin'::text])
  );

create policy campanha_envios_insert on public.campanha_envios
  for insert to authenticated
  with check (
    org_id = privado.org_atual()
    and privado.papel_atual() = any (array['gestor'::text, 'admin'::text])
  );

create policy campanha_envios_update on public.campanha_envios
  for update to authenticated
  using (
    org_id = privado.org_atual()
    and privado.papel_atual() = any (array['gestor'::text, 'admin'::text])
  )
  with check (org_id = privado.org_atual());

-- ----------------------------------------------------------------------------
-- 6) negocios.contato_id — vínculo do funil com a agenda de contatos.
-- ----------------------------------------------------------------------------
alter table public.negocios
  add column contato_id uuid references public.contatos(id);

create index negocios_contato_id_idx on public.negocios (contato_id);

-- ----------------------------------------------------------------------------
-- 7) BACKFILL
-- ----------------------------------------------------------------------------

-- 7a) Contatos a partir dos negócios existentes (origem 'funil').
--     COM telefone: dedup por (org, telefone normalizado), fica o mais recente.
--     SEM telefone: dedup best-effort por (org, lower(nome)), fica o mais recente.
with base as (
  select n.org_id,
         n.corretor_id,
         left(btrim(n.nome_contato), 160) as nome,
         privado.normalizar_telefone(n.telefone_contato) as tel,
         nullif(btrim(coalesce(n.email_contato, '')), '') as email,
         n.criado_em
    from public.negocios n
   where n.nome_contato is not null
     and btrim(n.nome_contato) <> ''
),
com_tel as (
  select distinct on (org_id, tel)
         org_id, corretor_id, nome, tel, email
    from base
   where tel is not null
   order by org_id, tel, criado_em desc
),
sem_tel as (
  select distinct on (org_id, lower(nome))
         org_id, corretor_id, nome, tel, email
    from base
   where tel is null
   order by org_id, lower(nome), criado_em desc
)
insert into public.contatos (org_id, responsavel_id, nome, telefone, email, origem)
select org_id, corretor_id, nome, tel, email, 'funil' from com_tel
union all
select org_id, corretor_id, nome, tel, email, 'funil' from sem_tel;

-- 7b) Vincula negocios.contato_id: primeiro por telefone normalizado, depois
--     (para negócios sem telefone) por nome (best-effort, mesma org).
update public.negocios n
   set contato_id = c.id
  from public.contatos c
 where n.contato_id is null
   and c.org_id = n.org_id
   and c.origem = 'funil'
   and c.telefone is not null
   and c.telefone = privado.normalizar_telefone(n.telefone_contato);

update public.negocios n
   set contato_id = c.id
  from public.contatos c
 where n.contato_id is null
   and c.org_id = n.org_id
   and c.origem = 'funil'
   and c.telefone is null
   and privado.normalizar_telefone(n.telefone_contato) is null
   and n.nome_contato is not null
   and lower(c.nome) = lower(left(btrim(n.nome_contato), 160));

-- 7c) Leads CONSENTIDOS de clientes com telefone → contatos (origem 'lead').
--     LGPD: consentimento_marketing_em = NULL DE PROPÓSITO — o cliente consentiu
--     em compartilhar dados de NAVEGAÇÃO (finalidade: atendimento/leads), o que
--     NÃO autoriza MARKETING ativo. Finalidades distintas, consentimentos
--     distintos (art. 8º §4º). O opt-in de marketing será coletado à parte.
insert into public.contatos
  (org_id, responsavel_id, nome, telefone, email, cliente_id, origem,
   consentimento_marketing_em)
select org_id, responsavel_id, nome, telefone, email, cliente_id, 'lead', null
  from (
    select distinct on (l.org_id, privado.normalizar_telefone(cp.telefone))
           l.org_id                                            as org_id,
           l.corretor_id                                       as responsavel_id,
           left(btrim(coalesce(nullif(p.nome, ''), 'Cliente')), 160) as nome,
           privado.normalizar_telefone(cp.telefone)            as telefone,
           u.email                                             as email,
           l.cliente_id                                        as cliente_id
      from public.leads l
      join public.cliente_profiles cp on cp.usuario_id = l.cliente_id
      join public.perfis p            on p.id = l.cliente_id
      left join auth.users u          on u.id = l.cliente_id
     where cp.consentimento_leads
       and privado.normalizar_telefone(cp.telefone) is not null
     order by l.org_id, privado.normalizar_telefone(cp.telefone), l.criado_em desc
  ) as alvo
    on conflict (org_id, telefone) where telefone is not null do nothing;

-- 7d) Enriquecimento: se um contato do funil é, na verdade, um cliente da
--     plataforma (mesmo telefone, mesma org, lead consentido), vincula cliente_id.
update public.contatos c
   set cliente_id = l.cliente_id
  from public.leads l
  join public.cliente_profiles cp on cp.usuario_id = l.cliente_id
 where c.cliente_id is null
   and cp.consentimento_leads
   and c.org_id = l.org_id
   and c.telefone is not null
   and c.telefone = privado.normalizar_telefone(cp.telefone);
