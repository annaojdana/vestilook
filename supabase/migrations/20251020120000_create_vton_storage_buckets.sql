-- purpose: provision private buckets for persona, garment and generation assets with per-user row level security
-- notes: the helper function `storage_path_owned_by_auth_user` makes it easy to scope any future buckets to user prefixes

create or replace function public.storage_path_owned_by_auth_user(object_name text, allowed_prefixes text[])
returns boolean
language sql
stable
as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from unnest(coalesce(allowed_prefixes, '{}'::text[])) as prefix
      where object_name like (prefix || auth.uid()::text || '/%')
    );
$$;

insert into storage.buckets (id, name, public)
values
  ('vestilook-personas', 'vestilook-personas', false),
  ('vestilook-garments', 'vestilook-garments', false),
  ('vestilook-generations', 'vestilook-generations', false)
on conflict (id) do nothing;

create policy persona_assets_are_private_per_user
on storage.objects
for all
to authenticated
using (
  bucket_id = 'vestilook-personas'
  and storage_path_owned_by_auth_user(name, array['personas/', 'users/'])
)
with check (
  bucket_id = 'vestilook-personas'
  and storage_path_owned_by_auth_user(name, array['personas/', 'users/'])
);

create policy garment_assets_are_private_per_user
on storage.objects
for all
to authenticated
using (
  bucket_id = 'vestilook-garments'
  and storage_path_owned_by_auth_user(name, array['users/'])
)
with check (
  bucket_id = 'vestilook-garments'
  and storage_path_owned_by_auth_user(name, array['users/'])
);

create policy generation_assets_are_private_per_user
on storage.objects
for all
to authenticated
using (
  bucket_id = 'vestilook-generations'
  and storage_path_owned_by_auth_user(name, array['users/'])
)
with check (
  bucket_id = 'vestilook-generations'
  and storage_path_owned_by_auth_user(name, array['users/'])
);
