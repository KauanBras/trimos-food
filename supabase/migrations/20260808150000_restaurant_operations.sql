-- Clientes, reservas e configurações operacionais do restaurante.

create type public.reservation_status as enum (
  'pending',
  'confirmed',
  'seated',
  'completed',
  'cancelled',
  'no_show'
);

create type public.reservation_source as enum (
  'public',
  'dashboard',
  'phone',
  'walk_in'
);

alter table public.restaurant_settings
  add column reservation_slot_minutes integer not null default 30
    check (reservation_slot_minutes between 15 and 120),
  add column reservation_capacity integer not null default 30
    check (reservation_capacity between 1 and 500),
  add column reservation_advance_days integer not null default 60
    check (reservation_advance_days between 1 and 365),
  add column reservation_duration_minutes integer not null default 90
    check (reservation_duration_minutes between 30 and 360),
  add column auto_confirm_reservations boolean not null default false;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  notes text,
  tags text[] not null default '{}'::text[],
  is_blocked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_contact_required check (
    nullif(trim(coalesce(phone, '')), '') is not null
    or nullif(trim(coalesce(email, '')), '') is not null
  ),
  constraint customers_restaurant_phone_unique unique (restaurant_id, phone)
);

create index customers_restaurant_name_idx
  on public.customers(restaurant_id, lower(name));

create index customers_restaurant_email_idx
  on public.customers(restaurant_id, lower(email));

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  reservation_date date not null,
  reservation_time time not null,
  party_size integer not null check (party_size between 1 and 50),
  duration_minutes integer not null default 90 check (duration_minutes between 30 and 360),
  table_label text,
  status public.reservation_status not null default 'pending',
  source public.reservation_source not null default 'dashboard',
  special_requests text,
  internal_notes text,
  public_token uuid not null default gen_random_uuid() unique,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reservations_restaurant_schedule_idx
  on public.reservations(restaurant_id, reservation_date, reservation_time);

create index reservations_restaurant_status_idx
  on public.reservations(restaurant_id, status, reservation_date);

alter table public.orders
  add column customer_id uuid references public.customers(id) on delete set null;

create index orders_customer_idx on public.orders(customer_id, created_at desc);

create trigger customers_set_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

create trigger reservations_set_updated_at
before update on public.reservations
for each row execute function public.set_updated_at();

create or replace function public.upsert_customer_for_contact(
  requested_restaurant_id uuid,
  requested_name text,
  requested_phone text,
  requested_email text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_phone text;
  normalized_email text;
  selected_customer_id uuid;
begin
  normalized_phone := nullif(regexp_replace(trim(coalesce(requested_phone, '')), '[^0-9+]', '', 'g'), '');
  normalized_email := nullif(lower(trim(coalesce(requested_email, ''))), '');

  if normalized_phone is not null then
    insert into public.customers (restaurant_id, name, phone, email)
    values (
      requested_restaurant_id,
      coalesce(nullif(trim(requested_name), ''), 'Cliente'),
      normalized_phone,
      normalized_email
    )
    on conflict (restaurant_id, phone)
    do update set
      name = excluded.name,
      email = coalesce(excluded.email, public.customers.email),
      updated_at = now()
    returning id into selected_customer_id;

    return selected_customer_id;
  end if;

  if normalized_email is not null then
    select id into selected_customer_id
    from public.customers
    where restaurant_id = requested_restaurant_id
      and lower(email) = normalized_email
    order by created_at
    limit 1;

    if selected_customer_id is not null then
      update public.customers
      set name = coalesce(nullif(trim(requested_name), ''), name),
          updated_at = now()
      where id = selected_customer_id;
      return selected_customer_id;
    end if;

    insert into public.customers (restaurant_id, name, email)
    values (
      requested_restaurant_id,
      coalesce(nullif(trim(requested_name), ''), 'Cliente'),
      normalized_email
    )
    returning id into selected_customer_id;

    return selected_customer_id;
  end if;

  return null;
end;
$$;

revoke all on function public.upsert_customer_for_contact(uuid, text, text, text)
from public, anon, authenticated;

create or replace function public.link_order_customer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.customer_phone := nullif(regexp_replace(trim(coalesce(new.customer_phone, '')), '[^0-9+]', '', 'g'), '');
  new.customer_email := nullif(lower(trim(coalesce(new.customer_email, ''))), '');
  new.customer_id := public.upsert_customer_for_contact(
    new.restaurant_id,
    new.customer_name,
    new.customer_phone,
    new.customer_email
  );
  return new;
end;
$$;

create trigger orders_link_customer
before insert or update of customer_name, customer_phone, customer_email
on public.orders
for each row execute function public.link_order_customer();

create or replace function public.link_reservation_customer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.customer_phone := regexp_replace(trim(new.customer_phone), '[^0-9+]', '', 'g');
  new.customer_email := nullif(lower(trim(coalesce(new.customer_email, ''))), '');
  new.customer_id := public.upsert_customer_for_contact(
    new.restaurant_id,
    new.customer_name,
    new.customer_phone,
    new.customer_email
  );
  return new;
end;
$$;

create trigger reservations_link_customer
before insert or update of customer_name, customer_phone, customer_email
on public.reservations
for each row execute function public.link_reservation_customer();

-- Associa os pedidos já existentes ao CRM.
update public.orders
set customer_name = customer_name
where customer_id is null
  and (
    nullif(trim(coalesce(customer_phone, '')), '') is not null
    or nullif(trim(coalesce(customer_email, '')), '') is not null
  );

alter table public.customers enable row level security;
alter table public.reservations enable row level security;

grant select, insert, update on public.customers to authenticated;
grant select, insert, update, delete on public.reservations to authenticated;

create policy customers_member_read
on public.customers for select to authenticated
using (
  public.is_restaurant_member(restaurant_id)
  or public.is_super_admin()
);

create policy customers_member_insert
on public.customers for insert to authenticated
with check (
  public.is_super_admin()
  or public.has_restaurant_role(
    restaurant_id,
    array['owner','admin','manager','staff']::public.restaurant_role[]
  )
);

create policy customers_member_update
on public.customers for update to authenticated
using (
  public.is_super_admin()
  or public.has_restaurant_role(
    restaurant_id,
    array['owner','admin','manager','staff']::public.restaurant_role[]
  )
)
with check (
  public.is_super_admin()
  or public.has_restaurant_role(
    restaurant_id,
    array['owner','admin','manager','staff']::public.restaurant_role[]
  )
);

create policy reservations_member_read
on public.reservations for select to authenticated
using (
  public.is_restaurant_member(restaurant_id)
  or public.is_super_admin()
);

create policy reservations_member_insert
on public.reservations for insert to authenticated
with check (
  public.is_super_admin()
  or public.has_restaurant_role(
    restaurant_id,
    array['owner','admin','manager','staff']::public.restaurant_role[]
  )
);

create policy reservations_member_update
on public.reservations for update to authenticated
using (
  public.is_super_admin()
  or public.has_restaurant_role(
    restaurant_id,
    array['owner','admin','manager','staff']::public.restaurant_role[]
  )
)
with check (
  public.is_super_admin()
  or public.has_restaurant_role(
    restaurant_id,
    array['owner','admin','manager','staff']::public.restaurant_role[]
  )
);

create policy reservations_member_delete
on public.reservations for delete to authenticated
using (
  public.is_super_admin()
  or public.has_restaurant_role(
    restaurant_id,
    array['owner','admin','manager']::public.restaurant_role[]
  )
);

create or replace function public.create_public_reservation(
  requested_restaurant_id uuid,
  requested_customer_name text,
  requested_customer_phone text,
  requested_customer_email text,
  requested_date date,
  requested_time time,
  requested_party_size integer,
  requested_special_requests text
)
returns table (
  reservation_id uuid,
  reservation_token uuid,
  reservation_state public.reservation_status
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_restaurant public.restaurants%rowtype;
  target_settings public.restaurant_settings%rowtype;
  target_hours public.business_hours%rowtype;
  local_now timestamp;
  occupied_seats integer;
  selected_status public.reservation_status;
  created_reservation_id uuid;
  created_reservation_token uuid;
begin
  select * into target_restaurant
  from public.restaurants
  where id = requested_restaurant_id
    and status = 'active'
    and accepts_reservations = true;

  if target_restaurant.id is null then
    raise exception 'Este restaurante não está a aceitar reservas.';
  end if;

  select * into target_settings
  from public.restaurant_settings
  where restaurant_id = requested_restaurant_id;

  local_now := timezone(target_restaurant.timezone, now());

  if requested_date < local_now::date
    or requested_date > local_now::date + target_settings.reservation_advance_days then
    raise exception 'A data escolhida não está disponível para reserva.';
  end if;

  if requested_date = local_now::date and requested_time <= local_now::time then
    raise exception 'Escolha um horário futuro.';
  end if;

  if requested_party_size < 1 or requested_party_size > 50 then
    raise exception 'O número de pessoas é inválido.';
  end if;

  if length(trim(coalesce(requested_customer_name, ''))) < 2 then
    raise exception 'Informe o nome da reserva.';
  end if;

  if length(regexp_replace(coalesce(requested_customer_phone, ''), '[^0-9+]', '', 'g')) < 6 then
    raise exception 'Informe um telefone válido.';
  end if;

  select * into target_hours
  from public.business_hours
  where restaurant_id = requested_restaurant_id
    and day_of_week = extract(dow from requested_date)::smallint;

  if target_hours.id is null or target_hours.is_closed then
    raise exception 'O restaurante está fechado nesta data.';
  end if;

  if target_hours.closes_at > target_hours.opens_at then
    if requested_time < target_hours.opens_at or requested_time >= target_hours.closes_at then
      raise exception 'O horário escolhido está fora do funcionamento do restaurante.';
    end if;
  elsif requested_time < target_hours.opens_at and requested_time >= target_hours.closes_at then
    raise exception 'O horário escolhido está fora do funcionamento do restaurante.';
  end if;

  if mod(
    extract(hour from requested_time)::integer * 60
      + extract(minute from requested_time)::integer,
    target_settings.reservation_slot_minutes
  ) <> 0 then
    raise exception 'Escolha um dos horários disponíveis.';
  end if;

  select coalesce(sum(party_size), 0)::integer into occupied_seats
  from public.reservations
  where restaurant_id = requested_restaurant_id
    and reservation_date = requested_date
    and reservation_time = requested_time
    and status not in ('cancelled', 'no_show');

  if occupied_seats + requested_party_size > target_settings.reservation_capacity then
    raise exception 'Este horário já não tem lugares suficientes.';
  end if;

  selected_status := case
    when target_settings.auto_confirm_reservations then 'confirmed'::public.reservation_status
    else 'pending'::public.reservation_status
  end;

  insert into public.reservations (
    restaurant_id,
    customer_name,
    customer_phone,
    customer_email,
    reservation_date,
    reservation_time,
    party_size,
    duration_minutes,
    status,
    source,
    special_requests
  ) values (
    requested_restaurant_id,
    trim(requested_customer_name),
    trim(requested_customer_phone),
    nullif(trim(coalesce(requested_customer_email, '')), ''),
    requested_date,
    requested_time,
    requested_party_size,
    target_settings.reservation_duration_minutes,
    selected_status,
    'public',
    nullif(trim(coalesce(requested_special_requests, '')), '')
  )
  returning id, public_token
  into created_reservation_id, created_reservation_token;

  return query
  select created_reservation_id, created_reservation_token, selected_status;
end;
$$;

create or replace function public.get_public_reservation_status(
  requested_reservation_id uuid,
  requested_reservation_token uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', reservation.id,
    'restaurantId', reservation.restaurant_id,
    'customerName', reservation.customer_name,
    'date', reservation.reservation_date,
    'time', reservation.reservation_time,
    'partySize', reservation.party_size,
    'status', reservation.status,
    'tableLabel', reservation.table_label,
    'createdAt', reservation.created_at
  )
  from public.reservations as reservation
  where reservation.id = requested_reservation_id
    and reservation.public_token = requested_reservation_token;
$$;

create or replace function public.cancel_public_reservation(
  requested_reservation_id uuid,
  requested_reservation_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_rows integer;
begin
  update public.reservations
  set status = 'cancelled'
  where id = requested_reservation_id
    and public_token = requested_reservation_token
    and status in ('pending', 'confirmed');

  get diagnostics affected_rows = row_count;
  return affected_rows = 1;
end;
$$;

grant execute on function public.create_public_reservation(uuid, text, text, text, date, time, integer, text)
to anon, authenticated;

grant execute on function public.get_public_reservation_status(uuid, uuid)
to anon, authenticated;

grant execute on function public.cancel_public_reservation(uuid, uuid)
to anon, authenticated;

drop policy if exists profiles_select_restaurant_colleague on public.profiles;
create policy profiles_select_restaurant_colleague
on public.profiles for select to authenticated
using (
  exists (
    select 1 from public.restaurant_users as colleague
    where colleague.user_id = profiles.id
      and colleague.is_active
      and public.is_restaurant_member(colleague.restaurant_id)
  )
  or exists (
    select 1 from public.drivers as colleague_driver
    where colleague_driver.user_id = profiles.id
      and colleague_driver.is_active
      and public.is_restaurant_member(colleague_driver.restaurant_id)
  )
);

drop policy if exists driver_invites_restaurant_insert on public.driver_invites;
drop policy if exists driver_invites_restaurant_update on public.driver_invites;

create policy driver_invites_restaurant_insert
on public.driver_invites for insert to authenticated
with check (
  public.is_super_admin()
  or public.has_restaurant_role(
    restaurant_id,
    array['owner','admin','manager']::public.restaurant_role[]
  )
);

create policy driver_invites_restaurant_update
on public.driver_invites for update to authenticated
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

create policy driver_invites_restaurant_delete
on public.driver_invites for delete to authenticated
using (
  public.is_super_admin()
  or public.has_restaurant_role(
    restaurant_id,
    array['owner','admin','manager']::public.restaurant_role[]
  )
);

alter publication supabase_realtime add table public.reservations;
