-- ============================================================================
-- 0034_status_bloqueio_teste.sql — vocabulário dos GATES de envio (0033).
--
-- A central de configuração (org_config) passa a GOVERNAR os envios. Quando o
-- WhatsApp da org está em MODO TESTE, mensagens para números fora da lista de
-- teste NÃO saem pela Meta — e o registro precisa ser HONESTO no histórico:
--
--   - mensagens.status       += 'bloqueada_teste'      (resposta da IA retida
--                               pelo modo teste — o texto fica no histórico,
--                               a Meta nunca é chamada);
--   - campanha_envios.status += 'bloqueado_modo_teste' (alvo apto da campanha
--                               que NÃO recebeu por estar fora da lista de
--                               teste — conta como excluído no resumo);
--   - newsletter_edicoes.status += 'simulada'          (edição que passou pelo
--                               fluxo de envio com email_modo='simulado': tudo
--                               roda menos o Resend; a edição pode ser enviada
--                               DE VERDADE depois — só 'enviada' é imutável).
--
-- Só CHECKs de vocabulário: nenhuma policy muda (RLS intocada).
-- ============================================================================

alter table public.mensagens
  drop constraint mensagens_status_check;
alter table public.mensagens
  add constraint mensagens_status_check
  check (status in ('pendente', 'enviada', 'entregue', 'lida',
                    'falhou', 'recebida', 'bloqueada_teste'));

alter table public.campanha_envios
  drop constraint campanha_envios_status_check;
alter table public.campanha_envios
  add constraint campanha_envios_status_check
  check (status in ('pendente', 'enviado', 'falhou',
                    'sem_consentimento', 'sem_telefone',
                    'bloqueado_modo_teste'));

alter table public.newsletter_edicoes
  drop constraint newsletter_edicoes_status_check;
alter table public.newsletter_edicoes
  add constraint newsletter_edicoes_status_check
  check (status in ('rascunho', 'pronta', 'enviada', 'simulada'));
