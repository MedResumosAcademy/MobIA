-- ============================================================================
-- 0001_esquema_base.sql — Esquema base do MobIA (Postgres 17 / Supabase)
--
-- Espelha os schemas zod de packages/domain/src/*.ts (fonte de verdade do
-- vocabulário) e as histórias E0.2/E0.3, H-03/H-04/H-05 (docs/MVP-HISTORIAS.md).
--
-- Convenções:
--   - snake_case em tabelas/colunas.
--   - Dinheiro SEMPRE em BIGINT de CENTAVOS (ex.: R$ 320.000,00 = 32000000).
--   - Multi-tenant: todo dado de negócio carrega org_id (H-03).
--   - Enums modelados como text + CHECK (mesmos literais de tipos-base.ts).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- organizacoes — tenant (H-03). Corretor autônomo = org de 1 assento;
-- imobiliária = org de N assentos. Espelha organizacaoSchema.
-- ----------------------------------------------------------------------------
create table public.organizacoes (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  -- Número de assentos contratados (corretor autônomo = 1).
  assentos      int  not null check (assentos > 0),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz
);

-- ----------------------------------------------------------------------------
-- perfis — extensão de auth.users com papel e vínculo organizacional (H-04).
-- Espelha usuarioSchema (papel: cliente | corretor | gestor | admin).
-- Criado automaticamente pelo trigger handle_new_user (ver 0002).
-- ----------------------------------------------------------------------------
create table public.perfis (
  id            uuid primary key references auth.users (id) on delete cascade,
  papel         text not null default 'cliente'
                check (papel in ('cliente', 'corretor', 'gestor', 'admin')),
  -- Cliente não pertence a organização; corretor/gestor sim (check abaixo).
  org_id        uuid references public.organizacoes (id),
  nome          text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz,
  -- Corretor/gestor SEMPRE pertencem a uma organização (H-03/H-04).
  constraint perfis_corretor_gestor_exigem_org
    check (papel not in ('corretor', 'gestor') or org_id is not null)
);

create index perfis_org_id_idx on public.perfis (org_id);

-- ----------------------------------------------------------------------------
-- cliente_profiles — perfil do comprador: entradas do Sonhômetro (§6.3).
-- Espelha clienteProfileSchema. Campos anuláveis: o cliente preenche aos
-- poucos (formulário guiado, H-16). Dados FINANCEIRAMENTE SENSÍVEIS —
-- acesso restrito ao próprio cliente via RLS (ver 0002).
-- ----------------------------------------------------------------------------
create table public.cliente_profiles (
  usuario_id            uuid primary key references public.perfis (id) on delete cascade,
  -- Renda mensal bruta, em centavos.
  renda_mensal          bigint check (renda_mensal >= 0),
  -- Saldo de FGTS disponível para composição de entrada, em centavos.
  fgts                  bigint check (fgts >= 0),
  data_nascimento       date,
  estado_civil          text check (estado_civil in
                          ('solteiro', 'casado', 'uniao_estavel', 'divorciado', 'viuvo')),
  dependentes           int check (dependentes >= 0),
  cidade                text,
  uf                    char(2),
  -- Renda do cônjuge para composição de renda, em centavos.
  renda_conjuge         bigint check (renda_conjuge >= 0),
  -- Renda de outros membros da família para composição, em centavos.
  renda_outros_membros  bigint check (renda_outros_membros >= 0),
  -- Valor máximo de imóvel financiável calculado pelo Sonhômetro (estimativa),
  -- em centavos.
  capacidade_calculada  bigint check (capacidade_calculada >= 0),
  atualizado_em         timestamptz
);

-- ----------------------------------------------------------------------------
-- corretor_profiles — perfil do corretor (espelha corretorProfileSchema).
-- A carteira do corretor é DERIVADA (imoveis.corretor_responsavel_id) — não é
-- coluna aqui. Fonte de verdade do vínculo organizacional do corretor.
-- ----------------------------------------------------------------------------
create table public.corretor_profiles (
  usuario_id uuid primary key references public.perfis (id) on delete cascade,
  creci      text not null,
  org_id     uuid not null references public.organizacoes (id)
);

create index corretor_profiles_org_id_idx on public.corretor_profiles (org_id);

-- ----------------------------------------------------------------------------
-- imoveis — imóvel/empreendimento (espelha imovelSchema; H-23).
-- ----------------------------------------------------------------------------
create table public.imoveis (
  id                       uuid primary key default gen_random_uuid(),
  org_id                   uuid not null references public.organizacoes (id),
  corretor_responsavel_id  uuid not null references public.perfis (id),
  tipo                     text check (tipo in ('casa', 'apartamento', 'terreno')),
  -- Categorias de vitrine dos filtros do catálogo (lancamento, alto_padrao, mcmv).
  categorias               text[] not null default '{}',
  condicao                 text check (condicao in ('novo', 'usado')),
  status                   text not null default 'disponivel'
                           check (status in ('disponivel', 'reservado', 'vendido')),
  endereco                 text,
  cidade                   text not null,
  uf                       char(2) not null,
  lat                      double precision,
  lng                      double precision,
  -- Valor de tabela do imóvel, em centavos.
  valor                    bigint not null check (valor >= 0),
  -- URLs das fotos e das plantas.
  fotos                    text[] not null default '{}',
  plantas                  text[] not null default '{}',
  -- Modalidades de financiamento em que o imóvel se enquadra (tipos-base.ts).
  modalidades_elegiveis    text[] not null default '{}',
  -- Regras do empreendimento para montagem do plano (esquemaPagamentoSchema):
  -- percentual mínimo do ato, parcelas mensais, balões, modalidade padrão.
  esquema_pagamento        jsonb,
  descricao                text,
  criado_em                timestamptz not null default now(),
  atualizado_em            timestamptz
);

create index imoveis_org_id_idx     on public.imoveis (org_id);
-- Catálogo público filtra por status e por localização (H-07/H-08/H-09).
create index imoveis_status_idx     on public.imoveis (status);
create index imoveis_cidade_uf_idx  on public.imoveis (cidade, uf);

-- ----------------------------------------------------------------------------
-- unidades — unidade de um empreendimento (ex.: apto 905 vs 705). Espelha
-- unidadeSchema (H-24). org_id é herdado do imóvel (denormalização H-03).
-- ----------------------------------------------------------------------------
create table public.unidades (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizacoes (id),
  imovel_id     uuid not null references public.imoveis (id) on delete cascade,
  -- Identificador da unidade dentro do empreendimento, ex.: '905'.
  identificador text not null,
  andar         int,
  -- Posição na planta, ex.: 'norte', 'final 05'.
  posicao       text,
  -- Valor da unidade, em centavos.
  valor         bigint not null check (valor >= 0),
  -- Mesmo vocabulário de status de imoveis.
  status        text not null default 'disponivel'
                check (status in ('disponivel', 'reservado', 'vendido')),
  unique (imovel_id, identificador)
);

create index unidades_org_id_idx on public.unidades (org_id);
-- Consultas por imovel_id são cobertas pelo índice do UNIQUE
-- (imovel_id, identificador) — prefixo imovel_id; não precisa de índice extra.

-- ----------------------------------------------------------------------------
-- simulacoes — snapshot IMUTÁVEL de uma simulação (espelha simulacaoSchema).
-- Sempre uma ESTIMATIVA, nunca proposta formal (§6.4).
-- ----------------------------------------------------------------------------
create table public.simulacoes (
  id                uuid primary key default gen_random_uuid(),
  -- Organização dona do imóvel — denormalizado na criação por trigger
  -- anti-forja (ver 0002).
  org_id            uuid not null references public.organizacoes (id),
  -- Nullable: visitante anônimo pode simular sem estar logado/identificado.
  cliente_id        uuid references public.perfis (id),
  imovel_id         uuid not null references public.imoveis (id),
  unidade_id        uuid references public.unidades (id),
  -- Entrada escolhida pelo cliente no slider, em centavos (H-12).
  entrada_escolhida bigint not null check (entrada_escolhida >= 0),
  modalidade        text not null check (modalidade in
                      ('mcmv', 'sbpe', 'credito_associativo',
                       'imovel_novo', 'imovel_usado', 'terreno_e_construcao')),
  -- Snapshot da saída de recalcularPlano (planoPagamentoRecalculadoSchema).
  resultado         jsonb not null,
  -- Versão de parametros_financeiros usada no cálculo — rastreabilidade (H-05).
  parametros_versao int not null check (parametros_versao > 0),
  -- Disclaimer estrutural: toda simulação é estimativa (zod: literal true).
  eh_estimativa     boolean not null default true check (eh_estimativa),
  criado_em         timestamptz not null default now()
);

create index simulacoes_org_id_idx    on public.simulacoes (org_id);
create index simulacoes_imovel_id_idx on public.simulacoes (imovel_id);

-- ----------------------------------------------------------------------------
-- eventos — log de comportamento do cliente (espelha eventoSchema; H-21).
-- Base do lead scoring e da timeline do corretor (§5.2/§5.3).
-- ----------------------------------------------------------------------------
create table public.eventos (
  id         uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.perfis (id),
  -- Nullable: eventos globais não têm imóvel (ex.: sonhometro_completo).
  imovel_id  uuid references public.imoveis (id),
  -- Organização dona do imóvel — denormalizado na criação por trigger
  -- anti-forja (ver 0002). Nullable APENAS para eventos sem imóvel.
  org_id     uuid references public.organizacoes (id),
  tipo       text not null check (tipo in
               ('clique', 'visita_ficha', 'simulacao', 'favorito',
                'retorno', 'clique_financiamento', 'sonhometro_completo')),
  -- Dados livres do evento (ex.: entrada escolhida numa simulação).
  metadata   jsonb not null default '{}'::jsonb,
  criado_em  timestamptz not null default now(),
  -- Evento ligado a imóvel exige org_id (mesmo refine do eventoSchema).
  constraint eventos_imovel_exige_org
    check (imovel_id is null or org_id is not null)
);

create index eventos_org_id_idx    on public.eventos (org_id);
create index eventos_imovel_id_idx on public.eventos (imovel_id);
-- Timeline por cliente, do evento mais recente ao mais antigo (§5.2).
create index eventos_cliente_id_criado_em_idx
  on public.eventos (cliente_id, criado_em desc);

-- ----------------------------------------------------------------------------
-- leads — cliente + imóvel + temperatura + origem, capturado automaticamente
-- a partir dos eventos (espelha leadSchema; H-22). Criação server-side.
-- ----------------------------------------------------------------------------
create table public.leads (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizacoes (id),
  -- Corretor responsável pelo imóvel que originou o lead.
  corretor_id   uuid not null references public.perfis (id),
  cliente_id    uuid not null references public.perfis (id),
  imovel_id     uuid not null references public.imoveis (id),
  -- Termômetro (§5.3). Nullable: lead recém-criado pode ainda não ter score.
  temperatura   text check (temperatura in
                  ('quente', 'muito_quente', 'pronto_para_compra')),
  -- Origem do lead, ex.: 'catalogo', 'sonhometro', 'indicacao'.
  origem        text,
  -- Contagem de eventos acumulados do cliente neste imóvel.
  eventos_count int not null default 0,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz,
  -- Um lead por (org, cliente, imóvel): eventos posteriores ENRIQUECEM (H-22).
  unique (org_id, cliente_id, imovel_id)
);

-- org_id é coberto pelo índice do UNIQUE (org_id, cliente_id, imovel_id) —
-- prefixo org_id; não precisa de índice extra.
create index leads_imovel_id_idx on public.leads (imovel_id);

-- ----------------------------------------------------------------------------
-- favoritos — cliente ↔ imóvel, opcionalmente unidade específica (espelha
-- favoritoSchema; H-19). org_id denormalizado do imóvel por trigger (0002).
-- ----------------------------------------------------------------------------
create table public.favoritos (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizacoes (id),
  cliente_id uuid not null references public.perfis (id),
  imovel_id  uuid not null references public.imoveis (id) on delete cascade,
  unidade_id uuid references public.unidades (id),
  criado_em  timestamptz not null default now(),
  -- Um favorito por (cliente, imóvel).
  unique (cliente_id, imovel_id)
);

create index favoritos_org_id_idx    on public.favoritos (org_id);
create index favoritos_imovel_id_idx on public.favoritos (imovel_id);

-- ----------------------------------------------------------------------------
-- parametros_financeiros — tabela VERSIONADA de taxas/tetos/regras (H-05).
-- Espelha parametrosFinanceirosSchema: `dados` guarda o snapshot completo
-- (parametrosGerais + modalidades), atualizável sem deploy. O motor seleciona
-- a versão vigente por vigencia_inicio (obterParametrosVigentes no core).
-- ----------------------------------------------------------------------------
create table public.parametros_financeiros (
  versao          int primary key check (versao > 0),
  -- Início de vigência do snapshot (a versão vigente numa data é a de maior
  -- vigencia_inicio <= data).
  vigencia_inicio date not null,
  -- Fonte oficial dos valores, ex.: 'Planilha simulação Caixa 2026-06'.
  fonte           text not null,
  -- Snapshot COMPLETO (ParametrosFinanceiros): inclui versao/vigenciaInicio/
  -- fonte também dentro do JSON, espelhando o tipo do domain.
  dados           jsonb not null,
  criado_em       timestamptz not null default now()
);
