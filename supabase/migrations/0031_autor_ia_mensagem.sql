-- ============================================================================
-- 0031_autor_ia_mensagem.sql — marca as mensagens de SAÍDA escritas pela IA.
--
-- POR QUÊ: o inbox mostra o selo "IA" nas respostas da assistente virtual —
-- transparência para a EQUIPE saber o que foi a IA e o que foi um humano
-- (o CLIENTE já recebe a apresentação da IA no próprio texto, regra do core).
--
-- Coluna ADITIVA com default false: mensagens humanas, campanhas e todo o
-- histórico continuam como estão; só o pipeline de atendimento
-- (registrarSaidaIa em apps/web/lib/dados/atendimento.ts) grava true.
-- Nenhuma policy muda.
-- ============================================================================

alter table public.mensagens
  add column autor_ia boolean not null default false;

comment on column public.mensagens.autor_ia is
  'true quando a mensagem de saída foi escrita pela IA de atendimento (selo na UI).';
