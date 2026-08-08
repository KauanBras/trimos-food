-- Upgrade the first, product-owned modifier schema to reusable restaurant groups.
-- This migration is also safe on fresh databases where the reusable schema
-- was already created by 20260808090000_product_modifiers.sql.

drop function if exists public.update_product_with_modifiers(uuid, text, text, numeric, uuid, jsonb);

do $$
begin
  if to_regclass('public.modifier_groups') is null
     and to_regclass('public.product_modifier_groups') is not null then
    execute 'drop policy if exists product_modifier_groups_read on public.product_modifier_groups';
    execute 'drop policy if exists product_modifier_groups_manage on public.product_modifier_groups';

    if to_regclass('public.product_modifier_options') is not null then
      execute 'drop policy if exists product_modifier_options_read on public.product_modifier_options';
      execute 'drop policy if exists product_modifier_options_manage on public.product_modifier_options';
      alter table public.product_modifier_options rename to modifier_options;
    end if;

    alter table public.product_modifier_groups rename to modifier_groups;
    drop index if exists public.product_modifier_groups_product_idx;

    alter table public.modifier_groups add column restaurant_id uuid;
    update public.modifier_groups as modifier_group
    set restaurant_id = product.restaurant_id
    from public.products as product
    where product.id = modifier_group.product_id;

    alter table public.modifier_groups alter column restaurant_id set not null;
    alter table public.modifier_groups
      add constraint modifier_groups_restaurant_id_fkey
      foreign key (restaurant_id) references public.restaurants(id) on delete cascade;

    create table public.product_modifier_groups (
      product_id uuid not null references public.products(id) on delete cascade,
      modifier_group_id uuid not null references public.modifier_groups(id) on delete cascade,
      sort_order integer not null default 0,
      primary key (product_id, modifier_group_id)
    );

    insert into public.product_modifier_groups (product_id, modifier_group_id, sort_order)
    select product_id, id, sort_order
    from public.modifier_groups;

    alter table public.modifier_groups
      drop constraint if exists product_modifier_groups_product_id_fkey;
    alter table public.modifier_groups drop column product_id;
  end if;
end
$$;

create index if not exists modifier_groups_restaurant_idx
  on public.modifier_groups(restaurant_id, sort_order);
create index if not exists modifier_options_group_idx
  on public.modifier_options(modifier_group_id, sort_order);
create index if not exists product_modifier_groups_product_idx
  on public.product_modifier_groups(product_id, sort_order);

alter table public.modifier_groups enable row level security;
alter table public.modifier_options enable row level security;
alter table public.product_modifier_groups enable row level security;

grant select on public.modifier_groups, public.modifier_options, public.product_modifier_groups
  to anon, authenticated;
grant insert, update, delete on public.modifier_groups, public.modifier_options, public.product_modifier_groups
  to authenticated;

drop policy if exists modifier_groups_read on public.modifier_groups;
drop policy if exists modifier_groups_manage on public.modifier_groups;
drop policy if exists modifier_options_read on public.modifier_options;
drop policy if exists modifier_options_manage on public.modifier_options;
drop policy if exists product_modifier_groups_read on public.product_modifier_groups;
drop policy if exists product_modifier_groups_manage on public.product_modifier_groups;

create policy modifier_groups_read on public.modifier_groups for select to anon, authenticated
using (is_active or public.is_restaurant_member(restaurant_id) or public.is_super_admin());

create policy modifier_groups_manage on public.modifier_groups for all to authenticated
using (
  public.is_super_admin()
  or public.has_restaurant_role(restaurant_id, array['owner','admin','manager']::public.restaurant_role[])
)
with check (
  public.is_super_admin()
  or public.has_restaurant_role(restaurant_id, array['owner','admin','manager']::public.restaurant_role[])
);

create policy modifier_options_read on public.modifier_options for select to anon, authenticated
using (
  exists (
    select 1 from public.modifier_groups as modifier_group
    where modifier_group.id = modifier_group_id
      and (
        modifier_group.is_active
        or public.is_restaurant_member(modifier_group.restaurant_id)
        or public.is_super_admin()
      )
  )
);

create policy modifier_options_manage on public.modifier_options for all to authenticated
using (
  exists (
    select 1 from public.modifier_groups as modifier_group
    where modifier_group.id = modifier_group_id
      and (
        public.is_super_admin()
        or public.has_restaurant_role(modifier_group.restaurant_id, array['owner','admin','manager']::public.restaurant_role[])
      )
  )
)
with check (
  exists (
    select 1 from public.modifier_groups as modifier_group
    where modifier_group.id = modifier_group_id
      and (
        public.is_super_admin()
        or public.has_restaurant_role(modifier_group.restaurant_id, array['owner','admin','manager']::public.restaurant_role[])
      )
  )
);

create policy product_modifier_groups_read on public.product_modifier_groups for select to anon, authenticated
using (
  exists (
    select 1 from public.products as product
    where product.id = product_id
      and (
        (product.is_active and product.is_available)
        or public.is_restaurant_member(product.restaurant_id)
        or public.is_super_admin()
      )
  )
);

create policy product_modifier_groups_manage on public.product_modifier_groups for all to authenticated
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
    select 1
    from public.products as product
    join public.modifier_groups as modifier_group on modifier_group.id = modifier_group_id
    where product.id = product_id
      and product.restaurant_id = modifier_group.restaurant_id
      and (
        public.is_super_admin()
        or public.has_restaurant_role(product.restaurant_id, array['owner','admin','manager']::public.restaurant_role[])
      )
  )
);
