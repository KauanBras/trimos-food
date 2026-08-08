-- Armazenamento público para logótipos e capas, isolado por restaurante.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'restaurant-branding',
  'restaurant-branding',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists restaurant_branding_public_read on storage.objects;
drop policy if exists restaurant_branding_member_insert on storage.objects;
drop policy if exists restaurant_branding_member_update on storage.objects;
drop policy if exists restaurant_branding_member_delete on storage.objects;

create policy restaurant_branding_public_read
on storage.objects for select to public
using (bucket_id = 'restaurant-branding');

create policy restaurant_branding_member_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'restaurant-branding'
  and (
    public.is_super_admin()
    or public.has_restaurant_role(
      ((storage.foldername(name))[1])::uuid,
      array['owner','admin','manager']::public.restaurant_role[]
    )
  )
);

create policy restaurant_branding_member_update
on storage.objects for update to authenticated
using (
  bucket_id = 'restaurant-branding'
  and (
    public.is_super_admin()
    or public.has_restaurant_role(
      ((storage.foldername(name))[1])::uuid,
      array['owner','admin','manager']::public.restaurant_role[]
    )
  )
)
with check (
  bucket_id = 'restaurant-branding'
  and (
    public.is_super_admin()
    or public.has_restaurant_role(
      ((storage.foldername(name))[1])::uuid,
      array['owner','admin','manager']::public.restaurant_role[]
    )
  )
);

create policy restaurant_branding_member_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'restaurant-branding'
  and (
    public.is_super_admin()
    or public.has_restaurant_role(
      ((storage.foldername(name))[1])::uuid,
      array['owner','admin','manager']::public.restaurant_role[]
    )
  )
);
