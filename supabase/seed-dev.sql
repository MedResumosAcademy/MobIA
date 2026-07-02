-- ============================================================================
-- seed-dev.sql — Seed de desenvolvimento/teste RLS do ImobIA (H-03 DoD).
-- IDEMPOTENTE: re-executável (on conflict do nothing em todos os inserts).
-- Executar como service_role/postgres (bypassa RLS; org_id dos favoritos/
-- simulacoes/eventos é reescrito pelo trigger anti-forja de qualquer forma).
--
-- 2 orgs, 5 usuários (@teste.mobia, senha MobIA!teste1), 3 imóveis,
-- 1 favorito + 1 simulação + 2 eventos do cliente.um no imóvel disponível da
-- org A, 1 lead correspondente.
-- ============================================================================

-- Organizações ---------------------------------------------------------------
insert into public.organizacoes (id, nome, assentos) values
  ('11111111-1111-4111-8111-111111111111', 'Imobiliária Alfa', 3),
  ('22222222-2222-4222-8222-222222222222', 'Corretor Beta', 1)
on conflict (id) do nothing;

-- Convites (privado.convites) — promoção a corretor/gestor NUNCA vem do
-- metadata (0004); só um convite assinado, consumido por convite_token no
-- signup, promove. Devem existir ANTES dos auth.users abaixo. ----------------
insert into privado.convites (org_id, papel, token, email) values
  ('11111111-1111-4111-8111-111111111111', 'corretor', 'seed-corretor-alfa', 'corretor.alfa@teste.mobia'),
  ('11111111-1111-4111-8111-111111111111', 'gestor',   'seed-gestor-alfa',   'gestor.alfa@teste.mobia'),
  ('22222222-2222-4222-8222-222222222222', 'corretor', 'seed-corretor-beta', 'corretor.beta@teste.mobia')
on conflict (token) do nothing;

-- Usuários (auth.users) — trigger handle_new_user cria public.perfis.
-- Corretor/gestor carregam convite_token (consome o convite acima); clientes
-- nascem 'cliente'. Colunas de token vão como '' (NUNCA null) — GoTrue não
-- tolera null e derruba o login por senha com 500 (H-04). ---------------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                        confirmation_token, recovery_token, email_change,
                        email_change_token_new, email_change_token_current,
                        phone_change, phone_change_token, reauthentication_token,
                        created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
   'authenticated', 'authenticated', 'corretor.alfa@teste.mobia',
   extensions.crypt('MobIA!teste1', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"convite_token":"seed-corretor-alfa","nome":"Corretor Alfa"}',
   '', '', '', '', '', '', '', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
   'authenticated', 'authenticated', 'gestor.alfa@teste.mobia',
   extensions.crypt('MobIA!teste1', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"convite_token":"seed-gestor-alfa","nome":"Gestor Alfa"}',
   '', '', '', '', '', '', '', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
   'authenticated', 'authenticated', 'corretor.beta@teste.mobia',
   extensions.crypt('MobIA!teste1', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"convite_token":"seed-corretor-beta","nome":"Corretor Beta"}',
   '', '', '', '', '', '', '', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
   'authenticated', 'authenticated', 'cliente.um@teste.mobia',
   extensions.crypt('MobIA!teste1', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"nome":"Cliente Um"}',
   '', '', '', '', '', '', '', '', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
   'authenticated', 'authenticated', 'cliente.dois@teste.mobia',
   extensions.crypt('MobIA!teste1', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"nome":"Cliente Dois"}',
   '', '', '', '', '', '', '', '', now(), now())
on conflict (id) do nothing;

-- Perfis de corretor e do cliente (dados sensíveis do cliente.um) ------------
insert into public.corretor_profiles (usuario_id, creci, org_id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'CRECI-SP 111111', '11111111-1111-4111-8111-111111111111'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'CRECI-SP 222222', '22222222-2222-4222-8222-222222222222')
on conflict (usuario_id) do nothing;

insert into public.cliente_profiles (usuario_id, renda_mensal, fgts, cidade, uf) values
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 850000, 3200000, 'São Paulo', 'SP')
on conflict (usuario_id) do nothing;

-- Imóveis (valores em CENTAVOS) ----------------------------------------------
insert into public.imoveis (id, org_id, corretor_responsavel_id, tipo, condicao,
                            status, cidade, uf, valor, descricao) values
  ('11111111-aaaa-4aaa-8aaa-000000000001', '11111111-1111-4111-8111-111111111111',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'apartamento', 'novo', 'disponivel',
   'São Paulo', 'SP', 32000000, 'Apto Alfa disponível'),
  ('11111111-aaaa-4aaa-8aaa-000000000002', '11111111-1111-4111-8111-111111111111',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'casa', 'usado', 'vendido',
   'São Paulo', 'SP', 55000000, 'Casa Alfa vendida'),
  ('22222222-bbbb-4bbb-8bbb-000000000001', '22222222-2222-4222-8222-222222222222',
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'casa', 'novo', 'disponivel',
   'Campinas', 'SP', 42000000, 'Casa Beta disponível')
on conflict (id) do nothing;

-- Atividade do cliente.um no imóvel disponível da org A.
-- (No teste do DoD H-03 estes inserts foram executados SIMULANDO o JWT do
-- cliente.um, provando as policies de INSERT; aqui entram como service para
-- idempotência. O trigger definir_org_do_imovel reescreve org_id.) -----------
insert into public.favoritos (id, org_id, cliente_id, imovel_id) values
  ('ffffffff-ffff-4fff-8fff-000000000001', '11111111-1111-4111-8111-111111111111',
   'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', '11111111-aaaa-4aaa-8aaa-000000000001')
on conflict (cliente_id, imovel_id) do nothing;

insert into public.simulacoes (id, org_id, cliente_id, imovel_id,
                               entrada_escolhida, modalidade, resultado,
                               parametros_versao) values
  ('dddddddd-dddd-4ddd-8ddd-000000000001', '11111111-1111-4111-8111-111111111111',
   'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', '11111111-aaaa-4aaa-8aaa-000000000001',
   6400000, 'sbpe', '{"parcelaInicial": 250000, "prazoMeses": 360}', 1)
on conflict (id) do nothing;

insert into public.eventos (id, cliente_id, imovel_id, org_id, tipo, metadata) values
  ('eeeeeeee-eeee-4eee-8eee-000000000001', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
   '11111111-aaaa-4aaa-8aaa-000000000001', '11111111-1111-4111-8111-111111111111',
   'visita_ficha', '{}'),
  ('eeeeeeee-eeee-4eee-8eee-000000000002', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
   '11111111-aaaa-4aaa-8aaa-000000000001', '11111111-1111-4111-8111-111111111111',
   'simulacao', '{"entrada": 6400000}')
on conflict (id) do nothing;

-- Lead correspondente (criação server-side, H-22) ----------------------------
-- Contadores por tipo alinhados aos 2 eventos acima (1 visita_ficha + 1 simulacao),
-- espelhando o mapeamento do trigger privado.materializar_lead. Como os eventos são
-- semeados diretamente (sem passar pelo trigger AFTER INSERT), os contadores PRECISAM
-- ser explícitos aqui, senão o lead consentido aparece com score 0 no painel.
insert into public.leads (id, org_id, corretor_id, cliente_id, imovel_id,
                          temperatura, origem, eventos_count,
                          visitas, simulacoes, favoritos, cliques_financiamento, retornos) values
  ('abcdefab-cdef-4abc-8def-000000000001', '11111111-1111-4111-8111-111111111111',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
   '11111111-aaaa-4aaa-8aaa-000000000001', 'quente', 'catalogo', 2,
   1, 1, 0, 0, 0)
on conflict (org_id, cliente_id, imovel_id) do nothing;
