-- ============================================================================
-- 0006_leads_consentimento.sql — Portão de consentimento LGPD + materialização
-- de leads a partir de eventos (área do corretor, docs/ESCOPO.md §5).
--
-- DECISÃO 6 (LGPD, opt-in): o corretor/gestor só enxerga o comportamento de um
-- cliente (leads, eventos, favoritos, simulações) DEPOIS que aquele cliente
-- CONSENTIR. Consentimento é OPT-IN (default false) e é imposto na RLS via o
-- helper SECURITY DEFINER privado.cliente_consentiu(), não só na UI.
--
-- O termômetro (temperatura do lead) é calculado NO APP pelo @imobia/core a
-- partir dos sinais materializados aqui — NENHUM score é calculado em SQL.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) cliente_profiles — flag de consentimento (opt-in). A escrita permanece
--    restrita ao próprio cliente (policy cliente_profiles_update do 0002).
-- ----------------------------------------------------------------------------
alter table public.cliente_profiles
  add column consentimento_leads boolean not null default false,
  add column consentimento_leads_em timestamptz;

-- ----------------------------------------------------------------------------
-- 2) leads — contadores de sinais materializados a partir dos eventos. O app
--    lê estes campos e recalcula a temperatura no @imobia/core na leitura.
-- ----------------------------------------------------------------------------
alter table public.leads
  add column visitas int not null default 0,
  add column simulacoes int not null default 0,
  add column favoritos int not null default 0,
  add column cliques_financiamento int not null default 0,
  add column retornos int not null default 0,
  add column ultimo_evento_em timestamptz;

-- ----------------------------------------------------------------------------
-- 3) privado.cliente_consentiu(p_cliente) — portão de consentimento usado nas
--    policies de SELECT do ramo corretor/gestor. SECURITY DEFINER: lê
--    cliente_profiles SEM passar pela RLS (que restringe leitura ao próprio
--    cliente), retornando apenas o booleano. STABLE, search_path vazio.
-- ----------------------------------------------------------------------------
create function privado.cliente_consentiu(p_cliente uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select consentimento_leads
       from public.cliente_profiles
      where usuario_id = p_cliente),
    false
  );
$$;

revoke execute on function privado.cliente_consentiu(uuid) from public, anon;
grant execute on function privado.cliente_consentiu(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 4) Materialização de leads — AFTER INSERT em public.eventos.
--    Quando o evento tem imóvel E org (imovel_id/org_id preenchidos pelo
--    trigger definir_org_do_imovel do 0002), faz UPSERT do lead por
--    (org_id, cliente_id, imovel_id): incrementa eventos_count, atualiza
--    ultimo_evento_em e o contador de sinal correspondente ao tipo.
--    SECURITY DEFINER: escreve em public.leads (escrita reservada a service_role
--    pela ausência de policy de INSERT/UPDATE — H-22).
-- ----------------------------------------------------------------------------
create function privado.materializar_lead()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_corretor uuid;
  v_origem   text;
  d_visitas  int := 0;
  d_simul    int := 0;
  d_favor    int := 0;
  d_financ   int := 0;
  d_retorno  int := 0;
begin
  -- Sem imóvel ou sem org (ex.: sonhometro_completo) não gera lead.
  if new.imovel_id is null or new.org_id is null then
    return new;
  end if;

  -- Mapeia o tipo do evento para o contador de sinal.
  case new.tipo
    when 'visita_ficha'         then d_visitas := 1;
    when 'clique'               then d_visitas := 1;
    when 'simulacao'            then d_simul  := 1;
    when 'favorito'             then d_favor  := 1;
    when 'clique_financiamento' then d_financ := 1;
    when 'retorno'              then d_retorno := 1;
    else
      -- tipos sem sinal de imóvel dedicado: ainda conta como evento genérico.
      null;
  end case;

  v_corretor := (select i.corretor_responsavel_id
                   from public.imoveis i
                  where i.id = new.imovel_id);
  v_origem   := coalesce(new.metadata ->> 'origem', 'catalogo');

  insert into public.leads (
    org_id, corretor_id, cliente_id, imovel_id,
    temperatura, origem, eventos_count,
    visitas, simulacoes, favoritos, cliques_financiamento, retornos,
    ultimo_evento_em, criado_em, atualizado_em
  )
  values (
    new.org_id, v_corretor, new.cliente_id, new.imovel_id,
    'quente', v_origem, 1,
    d_visitas, d_simul, d_favor, d_financ, d_retorno,
    new.criado_em, now(), now()
  )
  on conflict (org_id, cliente_id, imovel_id) do update set
    eventos_count         = public.leads.eventos_count + 1,
    visitas               = public.leads.visitas + excluded.visitas,
    simulacoes            = public.leads.simulacoes + excluded.simulacoes,
    favoritos             = public.leads.favoritos + excluded.favoritos,
    cliques_financiamento = public.leads.cliques_financiamento + excluded.cliques_financiamento,
    retornos              = public.leads.retornos + excluded.retornos,
    ultimo_evento_em      = excluded.ultimo_evento_em,
    atualizado_em         = now();

  return new;
end;
$$;

revoke execute on function privado.materializar_lead() from public, anon, authenticated;

create trigger materializar_lead
  after insert on public.eventos
  for each row execute function privado.materializar_lead();

-- ----------------------------------------------------------------------------
-- 5) Portão de consentimento na RLS — o ramo CORRETOR/GESTOR das policies de
--    SELECT passa a exigir privado.cliente_consentiu(<cliente>) além de
--    org_id = privado.org_atual(). O ramo do PRÓPRIO CLIENTE fica inalterado
--    (o cliente sempre vê os próprios dados). DROP das policies antigas + CREATE
--    das novas para não deixar duplicadas.
-- ----------------------------------------------------------------------------

-- leads — único leitor é corretor/gestor; some se o cliente não consentiu.
drop policy if exists leads_select on public.leads;
create policy leads_select on public.leads
  for select to authenticated
  using (
    (
      (corretor_id = (select auth.uid()) and privado.papel_atual() = 'corretor')
      or (privado.papel_atual() in ('gestor', 'admin') and org_id = privado.org_atual())
    )
    and privado.cliente_consentiu(cliente_id)
  );

-- eventos — cliente vê os próprios; corretor/gestor só com consentimento.
drop policy if exists eventos_select on public.eventos;
create policy eventos_select on public.eventos
  for select to authenticated
  using (
    cliente_id = (select auth.uid())
    or (
      privado.papel_atual() in ('corretor', 'gestor')
      and org_id = privado.org_atual()
      and privado.cliente_consentiu(cliente_id)
    )
  );

-- favoritos — idem.
drop policy if exists favoritos_select on public.favoritos;
create policy favoritos_select on public.favoritos
  for select to authenticated
  using (
    cliente_id = (select auth.uid())
    or (
      privado.papel_atual() in ('corretor', 'gestor')
      and org_id = privado.org_atual()
      and privado.cliente_consentiu(cliente_id)
    )
  );

-- simulacoes — idem.
drop policy if exists simulacoes_select on public.simulacoes;
create policy simulacoes_select on public.simulacoes
  for select to authenticated
  using (
    cliente_id = (select auth.uid())
    or (
      privado.papel_atual() in ('corretor', 'gestor')
      and org_id = privado.org_atual()
      and privado.cliente_consentiu(cliente_id)
    )
  );

-- ----------------------------------------------------------------------------
-- 6) Índices — listagem de leads da org por recência e timeline de eventos.
-- ----------------------------------------------------------------------------
create index leads_org_ultimo_evento_idx
  on public.leads (org_id, ultimo_evento_em desc);

create index eventos_cliente_imovel_criado_idx
  on public.eventos (cliente_id, imovel_id, criado_em);
