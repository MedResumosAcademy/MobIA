-- ============================================================================
-- 0032_reiniciar_simulacao.sql — RESET REAL do contato de simulação.
--
-- POR QUÊ: o contato de teste do simulador é ÚNICO por org e reusado para
-- sempre; sem apagar as mensagens, o histórico acumulado acabava travando a
-- demo (e não há DELETE em mensagens no RLS — de propósito: histórico de
-- cliente REAL nunca se perde). Esta função SECURITY DEFINER abre um caminho
-- ESTREITO e ADITIVO: apaga mensagens SÓ de contatos origem='simulacao' da
-- PRÓPRIA org, chamada por gestor/admin no "Reiniciar teste". Nenhuma policy
-- muda; conversa de cliente real continua intocável.
-- ============================================================================

create function public.reiniciar_simulacao(p_contato_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org         uuid;
  v_papel       text;
  v_contato_org uuid;
  v_origem      text;
begin
  -- Quem chama: gestor/admin com org (o simulador é ferramenta de gestão).
  select p.org_id, p.papel
    into v_org, v_papel
    from public.perfis p
   where p.id = auth.uid();
  if v_org is null or v_papel not in ('gestor', 'admin') then
    raise exception 'só gestor/admin reiniciam a simulação';
  end if;

  -- Contato precisa ser da MESMA org E de simulação (nunca cliente real).
  select c.org_id, c.origem
    into v_contato_org, v_origem
    from public.contatos c
   where c.id = p_contato_id;
  if v_contato_org is null or v_contato_org <> v_org then
    raise exception 'contato fora da sua organização';
  end if;
  if v_origem is distinct from 'simulacao' then
    raise exception 'só o contato de simulação pode ser reiniciado';
  end if;

  -- Zera a demo: mensagens fora, contato volta ao estado de fábrica (IA
  -- atendendo, sem dono, sem não-lidas, sem carimbo de última mensagem).
  delete from public.mensagens where contato_id = p_contato_id;
  update public.contatos
     set atendimento        = 'ia',
         atribuido_a        = null,
         nao_lidas          = 0,
         ultima_mensagem_em = null
   where id = p_contato_id;
end;
$$;

-- Só usuários autenticados chamam (as checagens internas fazem o resto).
revoke execute on function public.reiniciar_simulacao(uuid) from public, anon;
grant execute on function public.reiniciar_simulacao(uuid) to authenticated;
