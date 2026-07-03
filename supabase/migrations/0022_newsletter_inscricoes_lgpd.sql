-- ============================================================================
-- 0022_newsletter_inscricoes_lgpd.sql — LGPD: e-mails de inscritos são dado
-- pessoal confiado à PLATAFORMA ImobIA (o consentimento do formulário diz
-- "novidades e oportunidades da ImobIA"), não a cada imobiliária.
--
-- A 0021 liberava SELECT/UPDATE a gestor/admin de QUALQUER org (decisão de
-- demo, "lista compartilhada") — em produção isso expõe e-mails de pessoas
-- físicas a controladores não previstos no consentimento.
--
-- Modelo adotado (a): a newsletter é DA PLATAFORMA.
--   - E-mails crus (SELECT) e cancelamento (UPDATE): só papel 'admin'.
--   - Gestor mantém o TOTAL agregado (sem dado pessoal) via função
--     SECURITY DEFINER gateada por papel — a central da newsletter e o
--     dashboard de equipe continuam funcionais.
--   - INSERT público (captura) e ausência de DELETE (auditoria) inalterados.
-- ============================================================================

-- Recria as policies de leitura/cancelamento restritas ao admin da plataforma.
drop policy newsletter_inscricoes_select on public.newsletter_inscricoes;
drop policy newsletter_inscricoes_update on public.newsletter_inscricoes;

create policy newsletter_inscricoes_select on public.newsletter_inscricoes
  for select to authenticated
  using (privado.papel_atual() = 'admin');

create policy newsletter_inscricoes_update on public.newsletter_inscricoes
  for update to authenticated
  using (privado.papel_atual() = 'admin')
  with check (privado.papel_atual() = 'admin');

-- ----------------------------------------------------------------------------
-- public.newsletter_total_inscritos — total de inscritos ATIVOS (agregado,
-- sem dado pessoal). SECURITY DEFINER para não depender da policy de SELECT
-- (restrita ao admin), mas gateada por papel: gestor/admin recebem o número;
-- qualquer outro papel (ou anon), 0. search_path vazio (mesmo padrão das
-- funções de privado.*).
-- ----------------------------------------------------------------------------
create function public.newsletter_total_inscritos()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when privado.papel_atual() in ('gestor', 'admin') then (
      select count(*)::integer
      from public.newsletter_inscricoes
      where cancelado_em is null
    )
    else 0
  end;
$$;

revoke execute on function public.newsletter_total_inscritos() from public, anon;
grant execute on function public.newsletter_total_inscritos() to authenticated;
