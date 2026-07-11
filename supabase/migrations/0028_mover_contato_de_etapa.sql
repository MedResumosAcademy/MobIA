-- ============================================================================
-- 0028_mover_contato_de_etapa.sql — mover contato de etapa no funil de
-- RELACIONAMENTO por QUALQUER membro da equipe da org.
--
-- POR QUÊ UMA FUNÇÃO (e não policy): a policy contatos_update (0026) permite
-- editar só ao responsável ou gestor/admin — e ela NÃO afrouxa (regra do
-- projeto). Mas o kanban/lista de funis é colaborativo: o corretor vê TODOS os
-- contatos da org (contatos_select) e precisa mover cards de colegas. Esta
-- função SECURITY DEFINER abre um caminho ADITIVO e ESTREITO: só as colunas de
-- posição no funil (funil_id, etapa_chave, etapa_movida_em), só dentro da
-- própria org, só para papéis profissionais, só para funil ativo e etapa
-- existente. Nada além disso passa por aqui.
-- ============================================================================

create function public.mover_contato_de_etapa(
  p_contato_id uuid,
  p_funil_id   uuid,
  p_etapa_chave text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org   uuid;
  v_papel text;
  v_contato_org uuid;
  v_funil public.funis%rowtype;
begin
  -- Quem chama: precisa de papel profissional com org.
  select p.org_id, p.papel
    into v_org, v_papel
    from public.perfis p
   where p.id = auth.uid();
  if v_org is null
     or v_papel not in ('corretor', 'gestor', 'admin') then
    raise exception 'sem permissão para mover contatos';
  end if;

  -- Contato precisa ser da MESMA org do usuário.
  select c.org_id into v_contato_org
    from public.contatos c
   where c.id = p_contato_id;
  if v_contato_org is null or v_contato_org <> v_org then
    raise exception 'contato fora da sua organização';
  end if;

  -- Funil da mesma org, ativo, e a etapa precisa existir nele.
  select f.* into v_funil
    from public.funis f
   where f.id = p_funil_id;
  if v_funil.id is null or v_funil.org_id <> v_org then
    raise exception 'funil fora da sua organização';
  end if;
  if v_funil.arquivado then
    raise exception 'funil arquivado não recebe contatos';
  end if;
  if not exists (
    select 1
      from jsonb_array_elements(v_funil.etapas) e
     where e->>'chave' = p_etapa_chave
  ) then
    raise exception 'etapa desconhecida neste funil';
  end if;

  update public.contatos
     set funil_id        = p_funil_id,
         etapa_chave     = p_etapa_chave,
         etapa_movida_em = now()
   where id = p_contato_id;
end;
$$;

-- Só usuários autenticados chamam (as checagens internas fazem o resto).
revoke execute on function public.mover_contato_de_etapa(uuid, uuid, text)
  from public, anon;
grant execute on function public.mover_contato_de_etapa(uuid, uuid, text)
  to authenticated;
