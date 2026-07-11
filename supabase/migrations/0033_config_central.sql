-- ============================================================================
-- 0033_config_central.sql — Central de configuração da org.
--
-- Quatro tabelas + três RPCs de convite:
--   1. org_config       — flags de envio (WhatsApp/e-mail), motivos de perda,
--                         destino do Meta Lead Ads. 1 linha por org.
--   2. tokens_captacao  — tokens de API do endpoint público de captação de
--                         leads. Só o HASH (sha256 hex) vive no banco; o token
--                         em claro aparece UMA vez, na criação (camada de
--                         dados). `prefixo` guarda os 8 primeiros chars para a
--                         UI exibir "imob_a1b2…" sem revelar o segredo.
--   3. webhooks_saida   — webhooks de SAÍDA (avisamos Zapier/Make/RD quando
--                         lead é criado / muda de funil / negócio ganho).
--                         TRADE-OFF DELIBERADO: o segredo fica em CLARO na
--                         coluna `segredo` porque ele é usado para ASSINAR
--                         (HMAC-SHA256) cada entrega — não é credencial de
--                         verificação nossa, é material de emissão; um hash
--                         não serve para assinar. Mitigações: RLS restrita a
--                         gestor/admin da org, a CAMADA DE DADOS nunca retorna
--                         a coluna após a criação (RLS não esconde colunas) e
--                         o segredo jamais é logado.
--   4. metas_corretor   — metas individuais por corretor (vendas e receita do
--                         mês em CENTAVOS), complementando public.metas (0017,
--                         metas da org). Corretor lê (vê a própria meta);
--                         gestor/admin define.
--
-- CONVITES (privado.convites, 0004): a tabela sempre existiu sem UI. As RPCs
-- SECURITY DEFINER abaixo expõem emissão/listagem/revogação para gestor/admin
-- DA PRÓPRIA org. Compatibilidade com privado.handle_new_user (0004): o
-- convite é consumido no signup via raw_user_meta_data.convite_token, e como
-- ele valida `email` quando preenchido, emitir_convite SEMPRE fixa o e-mail —
-- o token só promove quem se cadastrar com aquele e-mail. O token aparece UMA
-- vez (retorno de emitir_convite); listar_convites não o devolve.
--
-- SEGURANÇA (default seguro): whatsapp_modo nasce 'teste' e email_modo nasce
-- 'simulado' — org nova NUNCA nasce enviando para cliente real.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) org_config — 1 linha por org (pk = org_id).
-- ----------------------------------------------------------------------------
create table public.org_config (
  org_id                 uuid primary key references public.organizacoes(id),
  -- 'teste': só envia WhatsApp para os números listados abaixo.
  whatsapp_modo          text not null default 'teste'
                           check (whatsapp_modo in ('teste', 'producao')),
  -- Dígitos com DDI 55 (ex.: 5511999998888) — validação de formato na camada
  -- de dados (zod), aqui só o tipo.
  whatsapp_numeros_teste text[] not null default '{}',
  email_modo             text not null default 'simulado'
                           check (email_modo in ('simulado', 'real')),
  -- Motivos de perda configuráveis (um por linha na UI).
  motivos_perda          text[] not null default array[
                           'Sem resposta / esfriou',
                           'Preco',
                           'Comprou concorrente',
                           'Sem interesse',
                           'Momento errado',
                           'Outro'
                         ],
  -- Funil que recebe leads do Meta Lead Ads (null = funil padrão).
  leadads_funil_id       uuid references public.funis(id),
  -- LGPD: só importa leads do Lead Ads se a org declarou base de consentimento.
  leadads_consentimento  boolean not null default false,
  atualizado_em          timestamptz
);

alter table public.org_config enable row level security;

-- Corretor LÊ (os gates de envio precisam da config); só gestor/admin escreve.
create policy org_config_select on public.org_config
  for select to authenticated
  using (org_id = privado.org_atual());

create policy org_config_insert on public.org_config
  for insert to authenticated
  with check (
    org_id = privado.org_atual()
    and privado.papel_atual() in ('gestor', 'admin')
    and (leadads_funil_id is null
         or exists (select 1 from public.funis f
                    where f.id = leadads_funil_id
                      and f.org_id = privado.org_atual()))
  );

create policy org_config_update on public.org_config
  for update to authenticated
  using (
    org_id = privado.org_atual()
    and privado.papel_atual() in ('gestor', 'admin')
  )
  with check (
    org_id = privado.org_atual()
    and privado.papel_atual() in ('gestor', 'admin')
    and (leadads_funil_id is null
         or exists (select 1 from public.funis f
                    where f.id = leadads_funil_id
                      and f.org_id = privado.org_atual()))
  );

create trigger org_config_tocar_atualizado_em
  before update on public.org_config
  for each row execute function privado.crm_tocar_atualizado_em();

-- SEED: uma linha (defaults seguros) para cada org existente.
insert into public.org_config (org_id)
select id from public.organizacoes
on conflict (org_id) do nothing;

-- ----------------------------------------------------------------------------
-- 2) tokens_captacao — tokens do endpoint público POST de captação.
-- ----------------------------------------------------------------------------
create table public.tokens_captacao (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizacoes(id),
  -- De onde vem o lead: "landing-page", "trafego-meta"...
  origem        text not null
                  check (char_length(btrim(origem)) between 1 and 60),
  -- sha256 hex do token; o claro só existe no retorno da criação.
  token_hash    text not null,
  -- Primeiros 8 chars do token para a UI exibir "imob_a1b2…".
  prefixo       text not null,
  ativo         boolean not null default true,
  criado_por    uuid references public.perfis(id),
  criado_em     timestamptz not null default now(),
  ultimo_uso_em timestamptz
);

-- Lookup do endpoint de captação (server-side) + impede token duplicado.
create unique index tokens_captacao_token_hash_idx
  on public.tokens_captacao (token_hash);
create index tokens_captacao_org_id_idx on public.tokens_captacao (org_id);
create index tokens_captacao_criado_por_idx on public.tokens_captacao (criado_por);

alter table public.tokens_captacao enable row level security;

-- Só gestor/admin da org gerencia tokens (todas as operações).
create policy tokens_captacao_select on public.tokens_captacao
  for select to authenticated
  using (
    org_id = privado.org_atual()
    and privado.papel_atual() in ('gestor', 'admin')
  );

create policy tokens_captacao_insert on public.tokens_captacao
  for insert to authenticated
  with check (
    org_id = privado.org_atual()
    and privado.papel_atual() in ('gestor', 'admin')
  );

create policy tokens_captacao_update on public.tokens_captacao
  for update to authenticated
  using (
    org_id = privado.org_atual()
    and privado.papel_atual() in ('gestor', 'admin')
  )
  with check (
    org_id = privado.org_atual()
    and privado.papel_atual() in ('gestor', 'admin')
  );

create policy tokens_captacao_delete on public.tokens_captacao
  for delete to authenticated
  using (
    org_id = privado.org_atual()
    and privado.papel_atual() in ('gestor', 'admin')
  );

-- ----------------------------------------------------------------------------
-- 3) webhooks_saida — ver trade-off do segredo no cabeçalho.
-- ----------------------------------------------------------------------------
create table public.webhooks_saida (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references public.organizacoes(id),
  url                   text not null check (url like 'https://%'),
  -- EM CLARO por necessidade: assina cada entrega (HMAC-SHA256 no header
  -- x-assinatura). Exibido ao usuário SÓ na criação; a camada de dados nunca
  -- o retorna depois. Não logar. Ver cabeçalho.
  segredo               text not null,
  eventos               text[] not null default array[
                          'contato.criado',
                          'contato.mudou_etapa',
                          'negocio.ganho'
                        ],
  ativo                 boolean not null default true,
  ultima_entrega_em     timestamptz,
  ultima_entrega_status int,
  falhas_seguidas       int not null default 0,
  criado_em             timestamptz not null default now()
);

create index webhooks_saida_org_id_idx on public.webhooks_saida (org_id);

alter table public.webhooks_saida enable row level security;

create policy webhooks_saida_select on public.webhooks_saida
  for select to authenticated
  using (
    org_id = privado.org_atual()
    and privado.papel_atual() in ('gestor', 'admin')
  );

create policy webhooks_saida_insert on public.webhooks_saida
  for insert to authenticated
  with check (
    org_id = privado.org_atual()
    and privado.papel_atual() in ('gestor', 'admin')
  );

create policy webhooks_saida_update on public.webhooks_saida
  for update to authenticated
  using (
    org_id = privado.org_atual()
    and privado.papel_atual() in ('gestor', 'admin')
  )
  with check (
    org_id = privado.org_atual()
    and privado.papel_atual() in ('gestor', 'admin')
  );

create policy webhooks_saida_delete on public.webhooks_saida
  for delete to authenticated
  using (
    org_id = privado.org_atual()
    and privado.papel_atual() in ('gestor', 'admin')
  );

-- ----------------------------------------------------------------------------
-- 4) metas_corretor — metas individuais (complementa public.metas da org).
-- ----------------------------------------------------------------------------
create table public.metas_corretor (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references public.organizacoes(id),
  corretor_id           uuid not null references public.perfis(id),
  vendas_mes            int check (vendas_mes >= 0),
  -- CENTAVOS (padrão do projeto).
  receita_mes_centavos  bigint check (receita_mes_centavos >= 0),
  atualizado_em         timestamptz,
  constraint metas_corretor_unico unique (org_id, corretor_id)
);

create index metas_corretor_corretor_id_idx
  on public.metas_corretor (corretor_id);

alter table public.metas_corretor enable row level security;

-- Todo membro da org lê (corretor vê a própria meta e o ranking);
-- gestor/admin define. O corretor precisa ser perfil DA org (anti cross-org:
-- gestor de perfis só enxerga a própria org, então o exists é suficiente).
create policy metas_corretor_select on public.metas_corretor
  for select to authenticated
  using (org_id = privado.org_atual());

create policy metas_corretor_insert on public.metas_corretor
  for insert to authenticated
  with check (
    org_id = privado.org_atual()
    and privado.papel_atual() in ('gestor', 'admin')
    and exists (select 1 from public.perfis p
                where p.id = corretor_id and p.org_id = privado.org_atual())
  );

create policy metas_corretor_update on public.metas_corretor
  for update to authenticated
  using (
    org_id = privado.org_atual()
    and privado.papel_atual() in ('gestor', 'admin')
  )
  with check (
    org_id = privado.org_atual()
    and privado.papel_atual() in ('gestor', 'admin')
    and exists (select 1 from public.perfis p
                where p.id = corretor_id and p.org_id = privado.org_atual())
  );

create policy metas_corretor_delete on public.metas_corretor
  for delete to authenticated
  using (
    org_id = privado.org_atual()
    and privado.papel_atual() in ('gestor', 'admin')
  );

create trigger metas_corretor_tocar_atualizado_em
  before update on public.metas_corretor
  for each row execute function privado.crm_tocar_atualizado_em();

-- ============================================================================
-- 5) RPCs de convite (privado.convites, 0004) — UI de "Equipe & acessos".
-- SECURITY DEFINER (a tabela é do schema privado, deny-by-default); toda
-- autorização é explícita DENTRO da função via papel_atual()/org_atual().
-- ============================================================================

-- ----------------------------------------------------------------------------
-- emitir_convite(email, papel) — gestor/admin convida para a PRÓPRIA org.
-- Retorna o token UMA única vez (não há como recuperá-lo depois; se perder,
-- revogue e emita outro). O convite fica atrelado ao e-mail: handle_new_user
-- (0004) só promove se o signup usar o mesmo e-mail + convite_token.
-- ----------------------------------------------------------------------------
create function public.emitir_convite(p_email text, p_papel text)
returns table (id uuid, codigo text, email text, papel text, expira_em timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org   uuid := privado.org_atual();
  v_email text := lower(btrim(p_email));
  v_token text;
begin
  if privado.papel_atual() not in ('gestor', 'admin') or v_org is null then
    raise exception 'apenas gestor ou admin da organização pode emitir convites'
      using errcode = '42501';
  end if;

  if p_papel not in ('corretor', 'gestor') then
    raise exception 'papel inválido: use corretor ou gestor'
      using errcode = '22023';
  end if;

  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'e-mail inválido' using errcode = '22023';
  end if;

  -- Um convite pendente por e-mail/org (evita pilha de tokens vivos).
  if exists (select 1 from privado.convites c
             where c.org_id = v_org and lower(c.email) = v_email
               and c.consumido_em is null and c.expira_em > now()) then
    raise exception 'já existe convite pendente para este e-mail'
      using errcode = '23505';
  end if;

  -- 256 bits de aleatoriedade sem depender de pgcrypto.
  v_token := replace(gen_random_uuid()::text, '-', '')
             || replace(gen_random_uuid()::text, '-', '');

  return query
  insert into privado.convites as c (org_id, papel, token, email)
  values (v_org, p_papel, v_token, v_email)
  returning c.id, c.token, c.email, c.papel, c.expira_em;
end;
$$;

-- ----------------------------------------------------------------------------
-- listar_convites() — pendentes/consumidos/expirados da PRÓPRIA org, SEM o
-- token (exibido só na emissão). Nunca cruza tenant: filtra por org_atual().
-- ----------------------------------------------------------------------------
create function public.listar_convites()
returns table (
  id uuid, email text, papel text, status text,
  expira_em timestamptz, consumido_em timestamptz, criado_em timestamptz
)
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_org uuid := privado.org_atual();
begin
  if privado.papel_atual() not in ('gestor', 'admin') or v_org is null then
    raise exception 'apenas gestor ou admin da organização pode listar convites'
      using errcode = '42501';
  end if;

  return query
  select c.id, c.email, c.papel,
         case
           when c.consumido_em is not null then 'consumido'
           when c.expira_em <= now()       then 'expirado'
           else 'pendente'
         end,
         c.expira_em, c.consumido_em, c.criado_em
  from privado.convites c
  where c.org_id = v_org
  order by c.criado_em desc;
end;
$$;

-- ----------------------------------------------------------------------------
-- revogar_convite(id) — apaga convite AINDA NÃO consumido da própria org.
-- Retorna true se revogou, false se não achou (ou já consumido).
-- ----------------------------------------------------------------------------
create function public.revogar_convite(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := privado.org_atual();
  v_apagados int;
begin
  if privado.papel_atual() not in ('gestor', 'admin') or v_org is null then
    raise exception 'apenas gestor ou admin da organização pode revogar convites'
      using errcode = '42501';
  end if;

  delete from privado.convites c
  where c.id = p_id and c.org_id = v_org and c.consumido_em is null;

  get diagnostics v_apagados = row_count;
  return v_apagados > 0;
end;
$$;

-- Execução restrita: só usuários autenticados (a autorização fina — papel e
-- org — é validada dentro de cada função).
revoke execute on function public.emitir_convite(text, text) from public, anon;
revoke execute on function public.listar_convites() from public, anon;
revoke execute on function public.revogar_convite(uuid) from public, anon;
grant execute on function public.emitir_convite(text, text) to authenticated;
grant execute on function public.listar_convites() to authenticated;
grant execute on function public.revogar_convite(uuid) to authenticated;
