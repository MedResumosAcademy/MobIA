-- ============================================================================
-- 0030_estado_conversa.sql — gestão do ESTADO DA CONVERSA (fila de
-- atendimento) por QUALQUER membro da equipe da org.
--
-- POR QUÊ UMA FUNÇÃO (mesmo racional do 0028): a policy contatos_update (0026)
-- permite editar só ao responsável ou gestor/admin — e ela NÃO afrouxa (regra
-- do projeto). Mas a fila de conversas é colaborativa: um corretor pega da
-- fila "Precisam" uma conversa cujo responsável é um colega (me atribuo),
-- devolve para a IA, marca como lida ou resolvida. Esta função SECURITY
-- DEFINER abre um caminho ADITIVO e ESTREITO: só as colunas de ESTADO da
-- conversa (atendimento, atribuido_a, nao_lidas), só dentro da própria org,
-- só para papéis profissionais. Nome, telefone, tags, consentimento LGPD e
-- todo o resto continuam protegidos pela policy de sempre.
-- ============================================================================

create function public.atualizar_estado_conversa(
  p_contato_id      uuid,
  -- null = mantém; senão 'ia' | 'humano' | 'resolvido'.
  p_atendimento     text default null,
  -- null = mantém; 'eu' = atribui a quem chama; 'ninguem' = desatribui.
  p_atribuir        text default null,
  p_zerar_nao_lidas boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org         uuid;
  v_papel       text;
  v_contato_org uuid;
begin
  -- Quem chama: precisa de papel profissional com org.
  select p.org_id, p.papel
    into v_org, v_papel
    from public.perfis p
   where p.id = auth.uid();
  if v_org is null
     or v_papel not in ('corretor', 'gestor', 'admin') then
    raise exception 'sem permissão para gerenciar conversas';
  end if;

  -- Contato precisa ser da MESMA org do usuário.
  select c.org_id into v_contato_org
    from public.contatos c
   where c.id = p_contato_id;
  if v_contato_org is null or v_contato_org <> v_org then
    raise exception 'contato fora da sua organização';
  end if;

  -- Vocabulários fechados (espelham os CHECKs do 0029).
  if p_atendimento is not null
     and p_atendimento not in ('ia', 'humano', 'resolvido') then
    raise exception 'estado de atendimento desconhecido';
  end if;
  if p_atribuir is not null and p_atribuir not in ('eu', 'ninguem') then
    raise exception 'atribuição desconhecida';
  end if;

  update public.contatos
     set atendimento = coalesce(p_atendimento, atendimento),
         atribuido_a = case
                         when p_atribuir = 'eu'      then auth.uid()
                         when p_atribuir = 'ninguem' then null
                         else atribuido_a
                       end,
         nao_lidas   = case when p_zerar_nao_lidas then 0 else nao_lidas end
   where id = p_contato_id;
end;
$$;

-- Só usuários autenticados chamam (as checagens internas fazem o resto).
revoke execute on function public.atualizar_estado_conversa(uuid, text, text, boolean)
  from public, anon;
grant execute on function public.atualizar_estado_conversa(uuid, text, text, boolean)
  to authenticated;
