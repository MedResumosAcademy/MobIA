-- ============================================================================
-- 0027_funis_relacionamento.sql — funis customizados de RELACIONAMENTO.
--
-- DECISÃO DE ARQUITETURA: funis customizados se aplicam a CONTATOS (agenda /
-- relacionamento). O funil de NEGÓCIOS (novo→contato→visita→proposta→
-- fechamento) continua canônico e INTOCADO — é dele que saem receita,
-- métricas e gamificação. "Ganhos" no relatório de um funil de contatos =
-- negócios GANHOS vinculados aos contatos daquele funil (camada de dados).
--
-- Entidades:
--   - public.funis — funis nomeados por org (emoji, etapas ordenadas em jsonb,
--     regra do 🔥 "a contatar" via dias_para_esfriar).
--   - contatos.funil_id/etapa_chave/etapa_movida_em/ultima_interacao_em.
--
-- etapas (jsonb): array ORDENADO de { chave, nome, cor? } — chave é slug curto
-- único no funil, cor é hex opcional. Validado pelo zod (funilSchema) na
-- aplicação; o banco garante só o frame (array de 2 a 15 itens).
--
-- Regra do 🔥 ("a contatar"): contato sem interação há >= dias_para_esfriar
-- dias (ou sem interação alguma). ultima_interacao_em é tocada por trigger a
-- cada INSERT em mensagens; para atividades/tarefas a camada de dados toca
-- junto (decisão: manter o trigger simples, um só ponto de escrita no banco).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) public.funis
-- ----------------------------------------------------------------------------
create table public.funis (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizacoes(id),
  nome              text not null
                      check (char_length(btrim(nome)) between 1 and 80),
  emoji             text,
  descricao         text,
  -- array ordenado de { chave, nome, cor? } — ver cabeçalho.
  etapas            jsonb not null
                      check (jsonb_typeof(etapas) = 'array'
                             and jsonb_array_length(etapas) between 2 and 15),
  -- regra do 🔥: "a contatar" = sem interação há >= N dias.
  dias_para_esfriar integer not null default 7
                      check (dias_para_esfriar between 1 and 365),
  padrao            boolean not null default false,
  arquivado         boolean not null default false,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz
);

create index funis_org_id_idx on public.funis (org_id);

-- No máximo UM funil padrão por org.
create unique index funis_org_padrao_unico
  on public.funis (org_id)
  where padrao;

-- BEFORE INSERT: org derivada da sessão quando omitida (padrão do CRM).
create function privado.funis_preencher_sessao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.org_id := coalesce(
    new.org_id,
    (select p.org_id from public.perfis p where p.id = auth.uid())
  );
  return new;
end;
$$;

revoke execute on function privado.funis_preencher_sessao()
  from public, anon, authenticated;

create trigger funis_preencher_sessao
  before insert on public.funis
  for each row execute function privado.funis_preencher_sessao();

-- BEFORE UPDATE: carimba atualizado_em (reusa o helper do CRM, 0026).
create trigger funis_tocar_atualizado_em
  before update on public.funis
  for each row execute function privado.crm_tocar_atualizado_em();

-- RLS: toda a org LÊ; só gestor/admin criam e editam.
alter table public.funis enable row level security;

create policy funis_select on public.funis
  for select to authenticated
  using (
    org_id = privado.org_atual()
    and privado.papel_atual() = any (array['corretor'::text, 'gestor'::text, 'admin'::text])
  );

create policy funis_insert on public.funis
  for insert to authenticated
  with check (
    org_id = privado.org_atual()
    and privado.papel_atual() = any (array['gestor'::text, 'admin'::text])
  );

create policy funis_update on public.funis
  for update to authenticated
  using (
    org_id = privado.org_atual()
    and privado.papel_atual() = any (array['gestor'::text, 'admin'::text])
  )
  with check (org_id = privado.org_atual());

-- ----------------------------------------------------------------------------
-- 2) contatos: posição no funil + última interação.
-- ----------------------------------------------------------------------------
alter table public.contatos
  add column funil_id            uuid references public.funis(id),
  add column etapa_chave         text,
  add column etapa_movida_em     timestamptz,
  add column ultima_interacao_em timestamptz;

create index contatos_funil_etapa_idx
  on public.contatos (funil_id, etapa_chave);

-- AFTER INSERT em mensagens: toca ultima_interacao_em do contato (qualquer
-- direção — enviar TAMBÉM é interagir). Para atividades fora de mensagens,
-- a camada de dados atualiza a coluna junto (ver cabeçalho).
create function privado.mensagens_tocar_interacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.contatos c
     set ultima_interacao_em = greatest(
           coalesce(c.ultima_interacao_em, new.criado_em),
           new.criado_em
         )
   where c.id = new.contato_id;
  return new;
end;
$$;

revoke execute on function privado.mensagens_tocar_interacao()
  from public, anon, authenticated;

create trigger mensagens_tocar_interacao
  after insert on public.mensagens
  for each row execute function privado.mensagens_tocar_interacao();

-- ----------------------------------------------------------------------------
-- 3) SEED por org existente: funil padrão "Relacionamento" + "Captação
--    Instagram"; contatos do backfill entram no padrão em novo_contato.
-- ----------------------------------------------------------------------------
insert into public.funis (org_id, nome, emoji, descricao, etapas, padrao)
select o.id,
       'Relacionamento',
       '🤝',
       'Funil padrão de relacionamento com contatos da agenda.',
       '[
         {"chave": "novo_contato",       "nome": "Novo contato",       "cor": "#3b82f6"},
         {"chave": "em_conversa",        "nome": "Em conversa",        "cor": "#8b5cf6"},
         {"chave": "aguardando_retorno", "nome": "Aguardando retorno", "cor": "#f59e0b"},
         {"chave": "cliente_ativo",      "nome": "Cliente ativo",      "cor": "#10b981"},
         {"chave": "encerrado",          "nome": "Encerrado",          "cor": "#6b7280"}
       ]'::jsonb,
       true
  from public.organizacoes o;

insert into public.funis (org_id, nome, emoji, descricao, etapas, padrao)
select o.id,
       'Captação Instagram',
       '📸',
       'Quem comentou ou chamou na DM até virar negócio.',
       '[
         {"chave": "comentou",      "nome": "Comentou/DM",   "cor": "#ec4899"},
         {"chave": "respondido",    "nome": "Respondido",    "cor": "#8b5cf6"},
         {"chave": "qualificado",   "nome": "Qualificado",   "cor": "#f59e0b"},
         {"chave": "virou_negocio", "nome": "Virou negócio", "cor": "#10b981"}
       ]'::jsonb,
       false
  from public.organizacoes o;

-- Contatos existentes (backfill da 0026) → funil padrão, etapa inicial.
update public.contatos c
   set funil_id        = f.id,
       etapa_chave     = 'novo_contato',
       etapa_movida_em = now()
  from public.funis f
 where f.org_id = c.org_id
   and f.padrao
   and c.funil_id is null;

-- Backfill de ultima_interacao_em a partir do histórico de mensagens.
update public.contatos c
   set ultima_interacao_em = m.ultima
  from (
    select contato_id, max(criado_em) as ultima
      from public.mensagens
     group by contato_id
  ) m
 where m.contato_id = c.id
   and c.ultima_interacao_em is null;
