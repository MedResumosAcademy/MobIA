-- 0024 — Performance (get_advisors): índices em FKs de caminhos quentes e
-- consolidação de policies SELECT permissivas duplicadas.
--
-- PARTE 1 — índices (puramente aditiva, zero mudança de semântica):
-- FKs sem índice que aparecem em filtros/joins reais do app:
--   leads.corretor_id / leads.cliente_id  → RLS e joins de listarLeads/termômetro
--   negocios.lead_id                      → dedup .eq("lead_id") em criarNegocioDeLead
--   publicacao_curtidas.perfil_id         → .eq("perfil_id") em listarFeed
--   agenda_eventos.negocio_id             → agenda ligada a negócio
--   imoveis.corretor_responsavel_id       → responsável pelo imóvel
create index if not exists leads_corretor_id_idx
  on public.leads (corretor_id);
create index if not exists leads_cliente_id_idx
  on public.leads (cliente_id);
create index if not exists negocios_lead_id_idx
  on public.negocios (lead_id);
create index if not exists publicacao_curtidas_perfil_id_idx
  on public.publicacao_curtidas (perfil_id);
create index if not exists agenda_eventos_negocio_id_idx
  on public.agenda_eventos (negocio_id);
create index if not exists imoveis_corretor_responsavel_id_idx
  on public.imoveis (corretor_responsavel_id);

-- PARTE 2 — consolidação de policies SELECT permissivas duplicadas
-- (multiple_permissive_policies): cada par vira UMA policy por role, com o
-- USING combinando os quals originais por OR — semântica EXATAMENTE preservada.

-- perfis: perfis_select + perfis_select_lead (ambas TO authenticated).
drop policy if exists perfis_select on public.perfis;
drop policy if exists perfis_select_lead on public.perfis;
create policy perfis_select on public.perfis
  for select to authenticated
  using (
    (id = (select auth.uid()))
    or (
      privado.papel_atual() = any (array['gestor'::text, 'admin'::text])
      and org_id = privado.org_atual()
    )
    or privado.cliente_lead_visivel(id)
  );

-- cliente_profiles: cliente_profiles_select + cliente_profiles_select_lead
-- (ambas TO authenticated).
drop policy if exists cliente_profiles_select on public.cliente_profiles;
drop policy if exists cliente_profiles_select_lead on public.cliente_profiles;
create policy cliente_profiles_select on public.cliente_profiles
  for select to authenticated
  using (
    (usuario_id = (select auth.uid()))
    or privado.cliente_lead_visivel(usuario_id)
  );

-- imoveis: o catálogo público (anon) fica só com a policy pública; para
-- authenticated, org OU disponível numa única policy (antes eram duas
-- permissivas avaliadas em TODA query do catálogo).
drop policy if exists imoveis_select_publico on public.imoveis;
drop policy if exists imoveis_select_org on public.imoveis;
create policy imoveis_select_publico on public.imoveis
  for select to anon
  using (status = 'disponivel'::text);
create policy imoveis_select_org on public.imoveis
  for select to authenticated
  using (
    (
      org_id = privado.org_atual()
      and privado.papel_atual() = any (array['corretor'::text, 'gestor'::text])
    )
    or status = 'disponivel'::text
  );

-- unidades: mesmo padrão de imoveis.
drop policy if exists unidades_select_publico on public.unidades;
drop policy if exists unidades_select_org on public.unidades;
create policy unidades_select_publico on public.unidades
  for select to anon
  using (status = 'disponivel'::text);
create policy unidades_select_org on public.unidades
  for select to authenticated
  using (
    (
      org_id = privado.org_atual()
      and privado.papel_atual() = any (array['corretor'::text, 'gestor'::text])
    )
    or status = 'disponivel'::text
  );
