-- Atributos de listagem do imóvel (padrão de portal: ZAP/VivaReal/OLX).
-- Essenciais para o card e a ficha exibirem a linha "área · quartos · banheiros
-- · vagas". Nuláveis (terreno não tem quartos; imóvel antigo pode não ter dado).

alter table public.imoveis
  add column if not exists quartos smallint check (quartos is null or quartos >= 0),
  add column if not exists banheiros smallint check (banheiros is null or banheiros >= 0),
  add column if not exists vagas smallint check (vagas is null or vagas >= 0),
  add column if not exists area_util integer check (area_util is null or area_util >= 0);

comment on column public.imoveis.area_util is 'Área útil/privativa em m² (para terreno, área total).';

-- Atributos realistas para os imóveis de demonstração ([demo]) e fixtures.
update public.imoveis set quartos = 3, banheiros = 2, vagas = 2, area_util = 110
  where id = 'd1000001-0000-4000-8000-000000000001';
update public.imoveis set quartos = 2, banheiros = 1, vagas = 1, area_util = 48
  where id = 'd1000002-0000-4000-8000-000000000002';
update public.imoveis set quartos = 4, banheiros = 5, vagas = 4, area_util = 380
  where id = 'd1000003-0000-4000-8000-000000000003';
update public.imoveis set area_util = 250
  where id = 'd1000004-0000-4000-8000-000000000004';
update public.imoveis set quartos = 3, banheiros = 2, vagas = 2, area_util = 92
  where id = 'd1000005-0000-4000-8000-000000000005';
update public.imoveis set quartos = 2, banheiros = 1, vagas = 1, area_util = 55
  where id = 'd1000006-0000-4000-8000-000000000006';
