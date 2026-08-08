create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  price numeric(10,2) not null check (price >= 0),
  is_active boolean not null default true,
  is_available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index product_variants_product_idx
  on public.product_variants(product_id, sort_order);

create trigger product_variants_set_updated_at
before update on public.product_variants
for each row execute function public.set_updated_at();

alter table public.product_variants enable row level security;
grant select on public.product_variants to anon, authenticated;
grant insert, update, delete on public.product_variants to authenticated;

create policy product_variants_read on public.product_variants for select to anon, authenticated
using (
  exists (
    select 1 from public.products as product
    where product.id = product_id
      and (
        (product.is_active and product.is_available and is_active and is_available)
        or public.is_restaurant_member(product.restaurant_id)
        or public.is_super_admin()
      )
  )
);

create policy product_variants_manage on public.product_variants for all to authenticated
using (
  exists (
    select 1 from public.products as product
    where product.id = product_id
      and (
        public.is_super_admin()
        or public.has_restaurant_role(product.restaurant_id, array['owner','admin','manager']::public.restaurant_role[])
      )
  )
)
with check (
  exists (
    select 1 from public.products as product
    where product.id = product_id
      and (
        public.is_super_admin()
        or public.has_restaurant_role(product.restaurant_id, array['owner','admin','manager']::public.restaurant_role[])
      )
  )
);
