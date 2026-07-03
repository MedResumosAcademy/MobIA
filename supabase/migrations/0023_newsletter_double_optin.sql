-- ============================================================================
-- 0023_newsletter_double_optin.sql — SEGURANÇA/LGPD: double opt-in na
-- newsletter. A 0021 permitia INSERT público com WITH CHECK (true) e
-- consentiu_em era carimbado sem provar posse do e-mail — qualquer pessoa
-- podia inscrever e-mails de terceiros em massa e o envio (Resend) chegaria
-- a caixas que nunca consentiram.
--
-- Modelo:
--   - Novas colunas: confirmado_em (null = inscrição PENDENTE) e
--     token_confirmacao (uuid, gerado no servidor; só viaja por e-mail).
--   - Backfill: inscrições existentes viram confirmadas (confirmado_em =
--     consentiu_em) — não invalida a base atual.
--   - INSERT público endurecido: WITH CHECK impede carimbar confirmado_em
--     (ou ressuscitar cancelado_em) direto pela API anon/PostgREST.
--   - Confirmação via função SECURITY DEFINER newsletter_confirmar(token):
--     o token NÃO vaza no INSERT porque a policy de SELECT segue admin-only
--     e o PostgREST não devolve representation sem SELECT.
--   - newsletter_total_inscritos passa a contar só confirmados; a camada de
--     dados (listarInscritos) filtra confirmado_em is not null — logo
--     enviarEdicaoAction nunca envia a e-mail não confirmado.
--
-- Limitação documentada: um atacante que fale PostgREST direto com a chave
-- anon ainda pode inserir com um token que ele mesmo escolheu e confirmá-lo.
-- Mitigações complementares: rate limit (WAF/Vercel) e, se necessário,
-- captcha no formulário. O ganho principal aqui é que o fluxo normal do
-- produto NUNCA envia e-mail sem confirmação de posse da caixa.
-- ============================================================================

alter table public.newsletter_inscricoes
  add column confirmado_em     timestamptz,
  add column token_confirmacao uuid not null default gen_random_uuid();

-- Backfill: quem já estava na base continua ativo (não invalidar inscritos).
update public.newsletter_inscricoes
   set confirmado_em = consentiu_em
 where confirmado_em is null;

-- Busca por token é o caminho quente da confirmação (e garante unicidade).
create unique index newsletter_inscricoes_token_idx
  on public.newsletter_inscricoes (token_confirmacao);

-- INSERT público continua aberto (captura no site), mas SEM poder forjar
-- confirmado_em/cancelado_em.
drop policy newsletter_inscricoes_insert on public.newsletter_inscricoes;

create policy newsletter_inscricoes_insert on public.newsletter_inscricoes
  for insert to anon, authenticated
  with check (confirmado_em is null and cancelado_em is null);

-- ----------------------------------------------------------------------------
-- public.newsletter_confirmar — confirma a inscrição dona do token (double
-- opt-in). SECURITY DEFINER (a policy de UPDATE é admin-only), search_path
-- vazio. Retorna true se confirmou agora; false para token desconhecido,
-- já confirmado ou cancelado (resposta genérica — não enumera inscritos).
-- ----------------------------------------------------------------------------
create function public.newsletter_confirmar(p_token uuid)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  with confirmada as (
    update public.newsletter_inscricoes
       set confirmado_em = now()
     where token_confirmacao = p_token
       and confirmado_em is null
       and cancelado_em is null
    returning 1
  )
  select exists (select 1 from confirmada);
$$;

revoke execute on function public.newsletter_confirmar(uuid) from public;
grant execute on function public.newsletter_confirmar(uuid) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- newsletter_total_inscritos — recriada (mesma assinatura da 0022) contando
-- apenas inscrições CONFIRMADAS e ativas.
-- ----------------------------------------------------------------------------
create or replace function public.newsletter_total_inscritos()
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
        and confirmado_em is not null
    )
    else 0
  end;
$$;
