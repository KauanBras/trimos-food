create type public.order_status as enum (
  'new',
  'confirmed',
  'preparing',
  'ready',
  'awaiting_driver',
  'out_for_delivery',
  'completed',
  'cancelled'
);

create type public.order_type as enum (
  'delivery',
  'pickup',
  'dine_in'
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, name)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  description text,
  price numeric(10,2) not null,
  image_url text,
  is_active boolean not null default true,
  is_available boolean not null default true,
  preparation_minutes integer,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (price >= 0),
  check (preparation_minutes is null or preparation_minutes > 0)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  customer_name text not null,
  customer_phone text,
  customer_email text,
  type public.order_type not null,
  status public.order_status not null default 'new',
  subtotal numeric(10,2) not null default 0,
  delivery_fee numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  delivery_address text,
  notes text,
  estimated_minutes integer,
  accepted_at timestamptz,
  ready_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (subtotal >= 0),
  check (delivery_fee >= 0),
  check (total >= 0)
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity integer not null,
  unit_price numeric(10,2) not null,
  notes text,
  created_at timestamptz not null default now(),
  check (quantity > 0),
  check (unit_price >= 0)
);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status public.order_status not null,
  changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index categories_restaurant_idx
  on public.categories(restaurant_id, sort_order);

create index products_restaurant_idx
  on public.products(restaurant_id, is_active, is_available);

create index products_category_idx
  on public.products(category_id, sort_order);

create index orders_restaurant_status_idx
  on public.orders(restaurant_id, status, created_at desc);

create index order_items_order_idx
  on public.order_items(order_id);

create index order_status_history_order_idx
  on public.order_status_history(order_id, created_at);

create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

create or replace function public.log_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    insert into public.order_status_history (
      order_id,
      status,
      changed_by
    )
    values (
      new.id,
      new.status,
      auth.uid()
    );
  end if;

  return new;
end;
$$;

create trigger orders_log_status_change
after insert or update of status on public.orders
for each row execute function public.log_order_status_change();

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;

create policy categories_public_read
on public.categories
for select
to anon, authenticated
using (
  is_active = true
  or public.is_restaurant_member(restaurant_id)
  or public.is_super_admin()
);

create policy categories_manage
on public.categories
for all
to authenticated
using (
  public.is_super_admin()
  or public.has_restaurant_role(
    restaurant_id,
    array['owner','admin','manager']::public.restaurant_role[]
  )
)
with check (
  public.is_super_admin()
  or public.has_restaurant_role(
    restaurant_id,
    array['owner','admin','manager']::public.restaurant_role[]
  )
);

create policy products_public_read
on public.products
for select
to anon, authenticated
using (
  (is_active = true and is_available = true)
  or public.is_restaurant_member(restaurant_id)
  or public.is_super_admin()
);

create policy products_manage
on public.products
for all
to authenticated
using (
  public.is_super_admin()
  or public.has_restaurant_role(
    restaurant_id,
    array['owner','admin','manager']::public.restaurant_role[]
  )
)
with check (
  public.is_super_admin()
  or public.has_restaurant_role(
    restaurant_id,
    array['owner','admin','manager']::public.restaurant_role[]
  )
);

create policy orders_insert_public
on public.orders
for insert
to anon, authenticated
with check (
  exists (
    select 1
    from public.restaurants
    where id = restaurant_id
      and status = 'active'
  )
);

create policy orders_member_read
on public.orders
for select
to authenticated
using (
  public.is_restaurant_member(restaurant_id)
  or public.is_super_admin()
);

create policy orders_member_update
on public.orders
for update
to authenticated
using (
  public.is_restaurant_member(restaurant_id)
  or public.is_super_admin()
)
with check (
  public.is_restaurant_member(restaurant_id)
  or public.is_super_admin()
);

create policy order_items_insert_public
on public.order_items
for insert
to anon, authenticated
with check (
  exists (
    select 1
    from public.orders
    where id = order_id
  )
);

create policy order_items_member_read
on public.order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.orders
    where orders.id = order_items.order_id
      and (
        public.is_restaurant_member(orders.restaurant_id)
        or public.is_super_admin()
      )
  )
);

create policy order_status_history_member_read
on public.order_status_history
for select
to authenticated
using (
  exists (
    select 1
    from public.orders
    where orders.id = order_status_history.order_id
      and (
        public.is_restaurant_member(orders.restaurant_id)
        or public.is_super_admin()
      )
  )
);

alter publication supabase_realtime
add table public.orders;

alter publication supabase_realtime
add table public.order_items;
