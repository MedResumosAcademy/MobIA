-- ============================================================================
-- 0029_atendimento_ia.sql — Atendimento com IA (estágio 3 do CRM 2.0):
--   1) public.atendimento_config   — 1 config por org (persona/FAQ da IA).
--   2) contatos: estado da CONVERSA no próprio contato (atendimento,
--      atribuido_a, nao_lidas, ultima_mensagem_em) + trigger em mensagens.
--   3) public.whatsapp_templates   — espelho LOCAL dos templates da Meta
--      (a APROVAÇÃO acontece NA Meta; aqui só acompanhamos o status).
--
-- Princípios: IA desligada por padrão (ia_ativa=false — degrade honesto);
-- contatos nascem em atendimento='humano'; RLS org multi-tenant via
-- privado.org_atual()/papel_atual().
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) public.atendimento_config — 1 linha por org.
--    faq: jsonb array de { pergunta, resposta } (máx 30 — validado no zod;
--    aqui só o formato/limite estrutural).
-- ----------------------------------------------------------------------------
create table public.atendimento_config (
  org_id          uuid primary key references public.organizacoes(id),
  ia_ativa        boolean not null default false,
  nome_assistente text not null default 'Assistente'
                    check (char_length(btrim(nome_assistente)) between 1 and 80),
  persona         text
                    check (persona is null or char_length(persona) <= 2000),
  boas_vindas     text
                    check (boas_vindas is null or char_length(boas_vindas) <= 1000),
  faq             jsonb not null default '[]'
                    check (jsonb_typeof(faq) = 'array'
                           and jsonb_array_length(faq) <= 30),
  escalar_quando  text
                    check (escalar_quando is null
                           or char_length(escalar_quando) <= 2000),
  atualizado_em   timestamptz
);

-- BEFORE INSERT: org derivada da sessão quando omitida (anti-forja).
create function privado.atendimento_config_preencher_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.org_id := coalesce(new.org_id, privado.org_atual());
  return new;
end;
$$;

revoke execute on function privado.atendimento_config_preencher_org()
  from public, anon, authenticated;

create trigger atendimento_config_preencher_org
  before insert on public.atendimento_config
  for each row execute function privado.atendimento_config_preencher_org();

-- BEFORE UPDATE: carimba atualizado_em (reusa o helper do CRM).
create trigger atendimento_config_tocar_atualizado_em
  before update on public.atendimento_config
  for each row execute function privado.crm_tocar_atualizado_em();

alter table public.atendimento_config enable row level security;

-- Toda a equipe LÊ (a UI mostra o estado da IA)...
create policy atendimento_config_select on public.atendimento_config
  for select to authenticated
  using (
    org_id = privado.org_atual()
    and privado.papel_atual() = any (array['corretor'::text, 'gestor'::text, 'admin'::text])
  );

-- ...mas só gestor/admin criam/editam a config.
create policy atendimento_config_insert on public.atendimento_config
  for insert to authenticated
  with check (
    org_id = privado.org_atual()
    and privado.papel_atual() = any (array['gestor'::text, 'admin'::text])
  );

create policy atendimento_config_update on public.atendimento_config
  for update to authenticated
  using (
    org_id = privado.org_atual()
    and privado.papel_atual() = any (array['gestor'::text, 'admin'::text])
  )
  with check (org_id = privado.org_atual());

-- ----------------------------------------------------------------------------
-- 2) Estado da conversa NO CONTATO (sem tabela nova):
--    atendimento: quem está atendendo AGORA ('ia' | 'humano' | 'resolvido');
--    atribuido_a: humano dono da conversa (fila "Minhas");
--    nao_lidas / ultima_mensagem_em: contadores mantidos por trigger.
-- ----------------------------------------------------------------------------
alter table public.contatos
  add column atendimento text not null default 'humano'
    check (atendimento in ('ia', 'humano', 'resolvido')),
  add column atribuido_a uuid references public.perfis(id),
  add column nao_lidas integer not null default 0
    check (nao_lidas >= 0),
  add column ultima_mensagem_em timestamptz;

create index contatos_org_atendimento_idx
  on public.contatos (org_id, atendimento);
create index contatos_atribuido_a_idx
  on public.contatos (atribuido_a);

-- AFTER INSERT em mensagens: entrada => nao_lidas+1; saída (humano OU IA
-- respondeu) => zera nao_lidas; ambas carimbam ultima_mensagem_em.
-- SECURITY DEFINER: vale também para o service role do webhook.
create function privado.mensagens_atualizar_contato()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.direcao = 'entrada' then
    update public.contatos c
       set nao_lidas = c.nao_lidas + 1,
           ultima_mensagem_em = new.criado_em
     where c.id = new.contato_id;
  else
    update public.contatos c
       set nao_lidas = 0,
           ultima_mensagem_em = new.criado_em
     where c.id = new.contato_id;
  end if;
  return null;
end;
$$;

revoke execute on function privado.mensagens_atualizar_contato()
  from public, anon, authenticated;

create trigger mensagens_atualizar_contato
  after insert on public.mensagens
  for each row execute function privado.mensagens_atualizar_contato();

-- BACKFILL dos contadores a partir do histórico existente:
--   ultima_mensagem_em = última mensagem do contato;
--   nao_lidas = entradas DEPOIS da última saída (0 se a última foi saída).
update public.contatos c
   set ultima_mensagem_em = m.ultima
  from (
    select contato_id, max(criado_em) as ultima
      from public.mensagens
     group by contato_id
  ) m
 where m.contato_id = c.id;

with ultima_saida as (
  select contato_id, max(criado_em) as em
    from public.mensagens
   where direcao = 'saida'
   group by contato_id
),
pendentes as (
  select m.contato_id, count(*)::int as qtd
    from public.mensagens m
    left join ultima_saida s on s.contato_id = m.contato_id
   where m.direcao = 'entrada'
     and (s.em is null or m.criado_em > s.em)
   group by m.contato_id
)
update public.contatos c
   set nao_lidas = p.qtd
  from pendentes p
 where p.contato_id = c.id;

-- ----------------------------------------------------------------------------
-- 3) public.whatsapp_templates — espelho local dos templates da Meta.
--    nome = slug exato registrado na Meta; status_meta acompanha o ciclo
--    (rascunho local → submetido → aprovado/rejeitado PELA META — a aprovação
--    NUNCA acontece aqui dentro).
-- ----------------------------------------------------------------------------
create table public.whatsapp_templates (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizacoes(id),
  nome        text not null
                check (nome ~ '^[a-z0-9_]{1,120}$'),
  idioma      text not null default 'pt_BR'
                check (char_length(idioma) between 2 and 15),
  corpo       text not null
                check (char_length(corpo) between 1 and 1024),
  categoria   text not null
                check (categoria in ('marketing', 'utility')),
  status_meta text not null default 'rascunho'
                check (status_meta in ('rascunho', 'submetido', 'aprovado',
                                       'rejeitado')),
  criado_em   timestamptz not null default now(),
  constraint whatsapp_templates_org_nome_idioma_unico
    unique (org_id, nome, idioma)
);

-- BEFORE INSERT: org derivada da sessão quando omitida.
create trigger whatsapp_templates_preencher_org
  before insert on public.whatsapp_templates
  for each row execute function privado.atendimento_config_preencher_org();

alter table public.whatsapp_templates enable row level security;

-- Toda a equipe LÊ (corretor escolhe template no disparo)...
create policy whatsapp_templates_select on public.whatsapp_templates
  for select to authenticated
  using (
    org_id = privado.org_atual()
    and privado.papel_atual() = any (array['corretor'::text, 'gestor'::text, 'admin'::text])
  );

-- ...só gestor/admin escrevem.
create policy whatsapp_templates_insert on public.whatsapp_templates
  for insert to authenticated
  with check (
    org_id = privado.org_atual()
    and privado.papel_atual() = any (array['gestor'::text, 'admin'::text])
  );

create policy whatsapp_templates_update on public.whatsapp_templates
  for update to authenticated
  using (
    org_id = privado.org_atual()
    and privado.papel_atual() = any (array['gestor'::text, 'admin'::text])
  )
  with check (org_id = privado.org_atual());

create policy whatsapp_templates_delete on public.whatsapp_templates
  for delete to authenticated
  using (
    org_id = privado.org_atual()
    and privado.papel_atual() = any (array['gestor'::text, 'admin'::text])
  );

-- SEED (org Alfa): 2 templates de EXEMPLO em 'rascunho' — deixam claro na UI
-- que o texto ainda precisa ser submetido e APROVADO NA META antes de enviar.
insert into public.whatsapp_templates (org_id, nome, idioma, corpo, categoria, status_meta)
select o.id, t.nome, 'pt_BR', t.corpo, t.categoria, 'rascunho'
  from public.organizacoes o
  cross join (values
    ('boas_vindas_imobiliaria',
     'Olá {{1}}! Aqui é a equipe da {{2}}. Recebemos seu interesse e um de nossos corretores vai te atender. Pode nos contar o que você procura?',
     'utility'),
    ('novidades_imoveis',
     'Oi {{1}}! Temos novidades de imóveis que combinam com o seu perfil. Quer receber uma seleção personalizada? Responda SIM para conferir.',
     'marketing')
  ) as t(nome, corpo, categoria)
 where o.nome = 'Imobiliária Alfa'
    on conflict on constraint whatsapp_templates_org_nome_idioma_unico do nothing;
