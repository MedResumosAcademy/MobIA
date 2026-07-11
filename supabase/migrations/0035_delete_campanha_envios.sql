-- 0035 — policy DELETE em campanha_envios (correção de auditoria).
--
-- PROBLEMA: dispararCampanhaAction refaz os envios NÃO concluídos com
-- delete + insert, mas a 0026 só criou policies SELECT/INSERT/UPDATE.
-- Com RLS deny-by-default, o DELETE afetava 0 linhas SILENCIOSAMENTE e o
-- INSERT seguinte violava o UNIQUE campanha_envios_unico (23505) — campanha
-- com qualquer linha não-concluída (bloqueado_modo_teste, falhou, pendente
-- órfão, sem_consentimento, sem_telefone) nunca mais re-disparava.
--
-- Isso NÃO afrouxa RLS: dá ao gestor/admin da PRÓPRIA org (mesmo escopo que
-- já pode INSERT/UPDATE nessas linhas) a capacidade de removê-las — mesmo
-- padrão das policies de tokens_captacao/webhooks_saida (0033).

create policy campanha_envios_delete on public.campanha_envios
  for delete to authenticated
  using (
    org_id = privado.org_atual()
    and privado.papel_atual() in ('gestor', 'admin')
  );
