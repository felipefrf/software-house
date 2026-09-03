-- Cache privado preenchido exclusivamente pelo backend (service role).
-- O caminho versiona a origem sem expor IDs externos: <operation>/<sha256(item + imported_at)>.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'estoquenow-item-photos',
  'estoquenow-item-photos',
  false,
  6000000,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Sem policies para este bucket: anon/authenticated não acessam os objetos.
-- A service role ignora RLS e usa somente a Storage API no backend.
