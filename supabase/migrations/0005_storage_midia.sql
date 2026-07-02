-- Storage de mídia dos imóveis (E8/E2): fotos e plantas.
-- Buckets públicos para leitura (o catálogo é público), escrita restrita a
-- corretor/gestor da organização dona. Convenção de path: {org_id}/{imovel_id}/{arquivo}.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('imoveis-fotos', 'imoveis-fotos', true, 10485760,
   array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('imoveis-plantas', 'imoveis-plantas', true, 10485760,
   array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'application/pdf'])
on conflict (id) do nothing;

-- Leitura pública (anon + authenticated) dos dois buckets.
create policy "midia_imoveis_leitura_publica"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id in ('imoveis-fotos', 'imoveis-plantas'));

-- Escrita: apenas corretor/gestor, e só na pasta da própria organização
-- (primeiro segmento do path = org_id). Vale para os dois buckets.
create policy "midia_imoveis_insert_org"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('imoveis-fotos', 'imoveis-plantas')
    and privado.papel_atual() in ('corretor', 'gestor')
    and (storage.foldername(name))[1] = privado.org_atual()::text
  );

create policy "midia_imoveis_update_org"
  on storage.objects for update
  to authenticated
  using (
    bucket_id in ('imoveis-fotos', 'imoveis-plantas')
    and privado.papel_atual() in ('corretor', 'gestor')
    and (storage.foldername(name))[1] = privado.org_atual()::text
  )
  with check (
    bucket_id in ('imoveis-fotos', 'imoveis-plantas')
    and privado.papel_atual() in ('corretor', 'gestor')
    and (storage.foldername(name))[1] = privado.org_atual()::text
  );

create policy "midia_imoveis_delete_org"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id in ('imoveis-fotos', 'imoveis-plantas')
    and privado.papel_atual() in ('corretor', 'gestor')
    and (storage.foldername(name))[1] = privado.org_atual()::text
  );
