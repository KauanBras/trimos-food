-- =========================================================
-- TRIMOS FOOD
-- ESTAFETAS E ENTREGAS
-- =========================================================

create type public.driver_status as enum (
  'offline',
  'available',
  'busy',
  'suspended'
);

create type public.delivery_status as enum (
  'searching_driver',
  'offered',
  'accepted',
  'picked_up',
  'delivered',
  'cancelled'
);

-- =========================================================
-- ESTAFETAS
-- =========================================================

create table public.drivers (
  id uuid primary key default gen_random_uuid(),

  restaurant_id uuid not null
    references public.restaurants(id) on delete cascade,

  user_id uuid not null
    references public.profiles(id) on delete cascade,

  status public.driver_status not null default 'offline',

  vehicle_type text,
  vehicle_plate text,

  phone text,

  is_active boolean not null default true,

  current_latitude numeric(10,7),
  current_longitude numeric(10,7),
  location_updated_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint drivers_unique_user_per_restaurant
    unique (restaurant_id, user_id)
);

create index drivers_restaurant_status_idx
  on public.drivers(restaurant_id, status, is_active);

create index drivers_user_idx
  on public.drivers(user_id);

-- =========================================================
-- ENTREGAS
-- =========================================================

create table public.deliveries (
  id uuid primary key default gen_random_uuid(),

  restaurant_id uuid not null
    references public.restaurants(id) on delete cascade,

  order_id uuid not null unique
    references public.orders(id) on delete cascade,

  driver_id uuid
    references public.drivers(id) on delete set null,

  status public.delivery_status not null default 'searching_driver',

  delivery_address text not null,

  delivery_fee numeric(10,2) not null default 0,

  distance_km numeric(8,2),

  offered_at timestamptz,
  accepted_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint deliveries_fee_positive
    check (delivery_fee >= 0),

  constraint deliveries_distance_positive
    check (distance_km is null or distance_km >= 0)
);

create index deliveries_restaurant_status_idx
  on public.deliveries(restaurant_id, status, created_at desc);

create index deliveries_driver_status_idx
  on public.deliveries(driver_id, status, created_at desc);

create index deliveries_order_idx
  on public.deliveries(order_id);

-- =========================================================
-- UPDATED_AT
-- =========================================================

create trigger drivers_set_updated_at
before update on public.drivers
for each row execute function public.set_updated_at();

create trigger deliveries_set_updated_at
before update on public.deliveries
for each row execute function public.set_updated_at();

-- =========================================================
-- CRIAR ENTREGA QUANDO O RESTAURANTE CHAMAR ESTAFETA
-- =========================================================

create or replace function public.create_delivery_for_order(
  requested_order_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_order public.orders;
  new_delivery_id uuid;
begin
  select *
  into requested_order
  from public.orders
  where id = requested_order_id;

  if requested_order.id is null then
    raise exception 'Pedido não encontrado';
  end if;

  if not (
    public.is_restaurant_member(requested_order.restaurant_id)
    or public.is_super_admin()
  ) then
    raise exception 'Sem permissão para criar esta entrega';
  end if;

  if requested_order.type <> 'delivery' then
    raise exception 'Este pedido não é uma entrega';
  end if;

  if requested_order.status <> 'ready' then
    raise exception 'O pedido precisa estar pronto';
  end if;

  insert into public.deliveries (
    restaurant_id,
    order_id,
    status,
    delivery_address,
    delivery_fee,
    offered_at
  )
  values (
    requested_order.restaurant_id,
    requested_order.id,
    'searching_driver',
    coalesce(requested_order.delivery_address, 'Morada não informada'),
    requested_order.delivery_fee,
    now()
  )
  on conflict (order_id)
  do update set
    status = 'searching_driver',
    offered_at = now(),
    cancelled_at = null
  returning id into new_delivery_id;

  update public.orders
  set status = 'awaiting_driver'
  where id = requested_order.id;

  return new_delivery_id;
end;
$$;

grant execute on function public.create_delivery_for_order(uuid)
to authenticated;

-- =========================================================
-- ESTAFETA ACEITA ENTREGA
-- =========================================================

create or replace function public.accept_delivery(
  requested_delivery_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_driver public.drivers;
  selected_delivery public.deliveries;
begin
  select *
  into current_driver
  from public.drivers
  where user_id = auth.uid()
    and is_active = true
  limit 1;

  if current_driver.id is null then
    raise exception 'Perfil de estafeta não encontrado';
  end if;

  if current_driver.status <> 'available' then
    raise exception 'O estafeta precisa estar disponível';
  end if;

  select *
  into selected_delivery
  from public.deliveries
  where id = requested_delivery_id
  for update;

  if selected_delivery.id is null then
    raise exception 'Entrega não encontrada';
  end if;

  if selected_delivery.restaurant_id <> current_driver.restaurant_id then
    raise exception 'Entrega pertence a outro restaurante';
  end if;

  if selected_delivery.status not in ('searching_driver', 'offered') then
    raise exception 'Entrega já não está disponível';
  end if;

  update public.deliveries
  set
    driver_id = current_driver.id,
    status = 'accepted',
    accepted_at = now()
  where id = selected_delivery.id;

  update public.drivers
  set status = 'busy'
  where id = current_driver.id;
end;
$$;

grant execute on function public.accept_delivery(uuid)
to authenticated;

-- =========================================================
-- ESTAFETA RECOLHE O PEDIDO
-- =========================================================

create or replace function public.pick_up_delivery(
  requested_delivery_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_driver public.drivers;
  selected_delivery public.deliveries;
begin
  select *
  into current_driver
  from public.drivers
  where user_id = auth.uid()
    and is_active = true
  limit 1;

  select *
  into selected_delivery
  from public.deliveries
  where id = requested_delivery_id;

  if selected_delivery.driver_id <> current_driver.id then
    raise exception 'Esta entrega não pertence ao estafeta';
  end if;

  if selected_delivery.status <> 'accepted' then
    raise exception 'A entrega ainda não pode ser recolhida';
  end if;

  update public.deliveries
  set
    status = 'picked_up',
    picked_up_at = now()
  where id = selected_delivery.id;

  update public.orders
  set status = 'out_for_delivery'
  where id = selected_delivery.order_id;
end;
$$;

grant execute on function public.pick_up_delivery(uuid)
to authenticated;

-- =========================================================
-- ESTAFETA CONCLUI A ENTREGA
-- =========================================================

create or replace function public.complete_delivery(
  requested_delivery_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_driver public.drivers;
  selected_delivery public.deliveries;
begin
  select *
  into current_driver
  from public.drivers
  where user_id = auth.uid()
    and is_active = true
  limit 1;

  select *
  into selected_delivery
  from public.deliveries
  where id = requested_delivery_id;

  if selected_delivery.driver_id <> current_driver.id then
    raise exception 'Esta entrega não pertence ao estafeta';
  end if;

  if selected_delivery.status <> 'picked_up' then
    raise exception 'A entrega ainda não foi recolhida';
  end if;

  update public.deliveries
  set
    status = 'delivered',
    delivered_at = now()
  where id = selected_delivery.id;

  update public.orders
  set
    status = 'completed',
    completed_at = now()
  where id = selected_delivery.order_id;

  update public.drivers
  set status = 'available'
  where id = current_driver.id;
end;
$$;

grant execute on function public.complete_delivery(uuid)
to authenticated;

-- =========================================================
-- RLS
-- =========================================================

alter table public.drivers enable row level security;
alter table public.deliveries enable row level security;

create policy drivers_member_read
on public.drivers
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_restaurant_member(restaurant_id)
  or public.is_super_admin()
);

create policy drivers_management
on public.drivers
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

create policy drivers_update_self
on public.drivers
for update
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);

create policy deliveries_restaurant_read
on public.deliveries
for select
to authenticated
using (
  public.is_restaurant_member(restaurant_id)
  or exists (
    select 1
    from public.drivers
    where drivers.id = deliveries.driver_id
      and drivers.user_id = auth.uid()
  )
  or (
    status in ('searching_driver', 'offered')
    and exists (
      select 1
      from public.drivers
      where drivers.restaurant_id = deliveries.restaurant_id
        and drivers.user_id = auth.uid()
        and drivers.status = 'available'
        and drivers.is_active = true
    )
  )
  or public.is_super_admin()
);

create policy deliveries_restaurant_management
on public.deliveries
for update
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

-- =========================================================
-- REALTIME
-- =========================================================

alter publication supabase_realtime
add table public.deliveries;

alter publication supabase_realtime
add table public.drivers;
