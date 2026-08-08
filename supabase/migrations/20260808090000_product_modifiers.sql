-- Reusable modifier groups. Existing products remain valid and may have no category/groups.
create table public.modifier_groups (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  min_selections integer not null default 0 check (min_selections >= 0),
  max_selections integer not null default 1 check (max_selections > 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (min_selections <= max_selections)
);

create table public.modifier_options (
  id uuid primary key default gen_random_uuid(),
  modifier_group_id uuid not null references public.modifier_groups(id) on delete cascade,
  name text not null,
  price_delta numeric(10,2) not null default 0 check (price_delta >= 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_modifier_groups (
  product_id uuid not null references public.products(id) on delete cascade,
  modifier_group_id uuid not null references public.modifier_groups(id) on delete cascade,
  sort_order integer not null default 0,
  primary key (product_id, modifier_group_id)
);

create index modifier_groups_restaurant_idx on public.modifier_groups(restaurant_id, sort_order);
create index modifier_options_group_idx on public.modifier_options(modifier_group_id, sort_order);
create index product_modifier_groups_product_idx on public.product_modifier_groups(product_id, sort_order);

create trigger modifier_groups_set_updated_at before update on public.modifier_groups
for each row execute function public.set_updated_at();
create trigger modifier_options_set_updated_at before update on public.modifier_options
for each row execute function public.set_updated_at();

alter table public.modifier_groups enable row level security;
alter table public.modifier_options enable row level security;
alter table public.product_modifier_groups enable row level security;
grant select on public.modifier_groups, public.modifier_options, public.product_modifier_groups to anon, authenticated;
grant insert, update, delete on public.modifier_groups, public.modifier_options, public.product_modifier_groups to authenticated;

create policy modifier_groups_read on public.modifier_groups for select to anon, authenticated
using (is_active or public.is_restaurant_member(restaurant_id) or public.is_super_admin());
create policy modifier_groups_manage on public.modifier_groups for all to authenticated
using (public.is_super_admin() or public.has_restaurant_role(restaurant_id, array['owner','admin','manager']::public.restaurant_role[]))
with check (public.is_super_admin() or public.has_restaurant_role(restaurant_id, array['owner','admin','manager']::public.restaurant_role[]));

create policy modifier_options_read on public.modifier_options for select to anon, authenticated using (
  exists (select 1 from public.modifier_groups g where g.id = modifier_group_id and (g.is_active or public.is_restaurant_member(g.restaurant_id) or public.is_super_admin()))
);
create policy modifier_options_manage on public.modifier_options for all to authenticated using (
  exists (select 1 from public.modifier_groups g where g.id = modifier_group_id and (public.is_super_admin() or public.has_restaurant_role(g.restaurant_id, array['owner','admin','manager']::public.restaurant_role[])))
) with check (
  exists (select 1 from public.modifier_groups g where g.id = modifier_group_id and (public.is_super_admin() or public.has_restaurant_role(g.restaurant_id, array['owner','admin','manager']::public.restaurant_role[])))
);

create policy product_modifier_groups_read on public.product_modifier_groups for select to anon, authenticated using (
  exists (select 1 from public.products p where p.id = product_id and ((p.is_active and p.is_available) or public.is_restaurant_member(p.restaurant_id) or public.is_super_admin()))
);
create policy product_modifier_groups_manage on public.product_modifier_groups for all to authenticated using (
  exists (select 1 from public.products p where p.id = product_id and (public.is_super_admin() or public.has_restaurant_role(p.restaurant_id, array['owner','admin','manager']::public.restaurant_role[])))
) with check (
  exists (select 1 from public.products p join public.modifier_groups g on g.id = modifier_group_id where p.id = product_id and p.restaurant_id = g.restaurant_id and (public.is_super_admin() or public.has_restaurant_role(p.restaurant_id, array['owner','admin','manager']::public.restaurant_role[])))
);
