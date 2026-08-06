-- =========================================================
-- TRIMOS FOOD
-- CORE: autenticação, restaurantes e permissões
-- =========================================================

create extension if not exists pgcrypto;

-- =========================================================
-- ENUMS
-- =========================================================

create type public.platform_role as enum (
  'user',
  'super_admin'
);

create type public.restaurant_role as enum (
  'owner',
  'admin',
  'manager',
  'kitchen',
  'driver',
  'staff'
);

create type public.restaurant_status as enum (
  'draft',
  'active',
  'suspended',
  'inactive'
);

-- =========================================================
-- PERFIS
-- =========================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  platform_role public.platform_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- RESTAURANTES
-- =========================================================

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  logo_url text,
  cover_url text,
  phone text,
  email text,
  tax_number text,
  address_line text,
  city text,
  postal_code text,
  country_code char(2) not null default 'PT',
  currency_code char(3) not null default 'EUR',
  timezone text not null default 'Europe/Lisbon',
  status public.restaurant_status not null default 'draft',

  accepts_delivery boolean not null default true,
  accepts_pickup boolean not null default true,
  accepts_dine_in boolean not null default false,
  accepts_reservations boolean not null default false,

  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint restaurants_slug_format
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create index restaurants_slug_idx
  on public.restaurants(slug);

create index restaurants_status_idx
  on public.restaurants(status);

-- =========================================================
-- UTILIZADORES DOS RESTAURANTES
-- =========================================================

create table public.restaurant_users (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null
    references public.restaurants(id) on delete cascade,
  user_id uuid not null
    references public.profiles(id) on delete cascade,
  role public.restaurant_role not null default 'staff',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint restaurant_users_unique_membership
    unique (restaurant_id, user_id)
);

create index restaurant_users_restaurant_idx
  on public.restaurant_users(restaurant_id);

create index restaurant_users_user_idx
  on public.restaurant_users(user_id);

create index restaurant_users_active_idx
  on public.restaurant_users(restaurant_id, is_active);

-- =========================================================
-- CONFIGURAÇÕES DO RESTAURANTE
-- =========================================================

create table public.restaurant_settings (
  restaurant_id uuid primary key
    references public.restaurants(id) on delete cascade,

  primary_color text not null default '#fbbf24',
  secondary_color text not null default '#18181b',

  delivery_radius_km numeric(6,2) not null default 5,
  minimum_order_amount numeric(10,2) not null default 0,
  default_delivery_fee numeric(10,2) not null default 0,
  free_delivery_from numeric(10,2),

  default_preparation_minutes integer not null default 30,
  order_sound_enabled boolean not null default true,
  auto_accept_orders boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint restaurant_settings_delivery_radius_positive
    check (delivery_radius_km >= 0),

  constraint restaurant_settings_preparation_positive
    check (default_preparation_minutes > 0)
);

-- =========================================================
-- HORÁRIOS
-- 0 = domingo, 1 = segunda ... 6 = sábado
-- =========================================================

create table public.business_hours (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null
    references public.restaurants(id) on delete cascade,
  day_of_week smallint not null,
  opens_at time,
  closes_at time,
  is_closed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint business_hours_day_range
    check (day_of_week between 0 and 6),

  constraint business_hours_unique_day
    unique (restaurant_id, day_of_week),

  constraint business_hours_valid_times
    check (
      is_closed = true
      or (
        opens_at is not null
        and closes_at is not null
        and opens_at <> closes_at
      )
    )
);

create index business_hours_restaurant_idx
  on public.business_hours(restaurant_id);

-- =========================================================
-- UPDATED_AT AUTOMÁTICO
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger restaurants_set_updated_at
before update on public.restaurants
for each row execute function public.set_updated_at();

create trigger restaurant_users_set_updated_at
before update on public.restaurant_users
for each row execute function public.set_updated_at();

create trigger restaurant_settings_set_updated_at
before update on public.restaurant_settings
for each row execute function public.set_updated_at();

create trigger business_hours_set_updated_at
before update on public.business_hours
for each row execute function public.set_updated_at();

-- =========================================================
-- CRIAÇÃO AUTOMÁTICA DE PERFIL
-- =========================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    full_name,
    phone
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- =========================================================
-- CONFIGURAÇÃO AUTOMÁTICA DO RESTAURANTE
-- =========================================================

create or replace function public.handle_new_restaurant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.restaurant_settings (restaurant_id)
  values (new.id);

  insert into public.business_hours (
    restaurant_id,
    day_of_week,
    opens_at,
    closes_at,
    is_closed
  )
  select
    new.id,
    day_number,
    time '18:00',
    time '23:00',
    false
  from generate_series(0, 6) as day_number;

  return new;
end;
$$;

create trigger on_restaurant_created
after insert on public.restaurants
for each row execute function public.handle_new_restaurant();

-- =========================================================
-- FUNÇÕES DE AUTORIZAÇÃO
-- =========================================================

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and platform_role = 'super_admin'
  );
$$;

create or replace function public.is_restaurant_member(
  requested_restaurant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.restaurant_users
    where restaurant_id = requested_restaurant_id
      and user_id = auth.uid()
      and is_active = true
  );
$$;

create or replace function public.has_restaurant_role(
  requested_restaurant_id uuid,
  allowed_roles public.restaurant_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.restaurant_users
    where restaurant_id = requested_restaurant_id
      and user_id = auth.uid()
      and role = any(allowed_roles)
      and is_active = true
  );
$$;

grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.is_restaurant_member(uuid) to authenticated;
grant execute on function public.has_restaurant_role(
  uuid,
  public.restaurant_role[]
) to authenticated;

-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================

alter table public.profiles enable row level security;
alter table public.restaurants enable row level security;
alter table public.restaurant_users enable row level security;
alter table public.restaurant_settings enable row level security;
alter table public.business_hours enable row level security;

-- PERFIS

create policy profiles_select_own
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.is_super_admin()
);

create policy profiles_update_own
on public.profiles
for update
to authenticated
using (
  id = auth.uid()
  or public.is_super_admin()
)
with check (
  id = auth.uid()
  or public.is_super_admin()
);

-- RESTAURANTES

create policy restaurants_read
on public.restaurants
for select
to anon, authenticated
using (
  status = 'active'
  or public.is_restaurant_member(id)
  or public.is_super_admin()
);

create policy restaurants_insert
on public.restaurants
for insert
to authenticated
with check (
  created_by = auth.uid()
  or public.is_super_admin()
);

create policy restaurants_update
on public.restaurants
for update
to authenticated
using (
  public.is_super_admin()
  or public.has_restaurant_role(
    id,
    array['owner', 'admin']::public.restaurant_role[]
  )
)
with check (
  public.is_super_admin()
  or public.has_restaurant_role(
    id,
    array['owner', 'admin']::public.restaurant_role[]
  )
);

-- EQUIPA

create policy restaurant_users_read
on public.restaurant_users
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_restaurant_member(restaurant_id)
  or public.is_super_admin()
);

create policy restaurant_users_insert
on public.restaurant_users
for insert
to authenticated
with check (
  public.is_super_admin()
  or public.has_restaurant_role(
    restaurant_id,
    array['owner', 'admin']::public.restaurant_role[]
  )
);

create policy restaurant_users_update
on public.restaurant_users
for update
to authenticated
using (
  public.is_super_admin()
  or public.has_restaurant_role(
    restaurant_id,
    array['owner', 'admin']::public.restaurant_role[]
  )
)
with check (
  public.is_super_admin()
  or public.has_restaurant_role(
    restaurant_id,
    array['owner', 'admin']::public.restaurant_role[]
  )
);

create policy restaurant_users_delete
on public.restaurant_users
for delete
to authenticated
using (
  public.is_super_admin()
  or public.has_restaurant_role(
    restaurant_id,
    array['owner', 'admin']::public.restaurant_role[]
  )
);

-- CONFIGURAÇÕES

create policy restaurant_settings_read
on public.restaurant_settings
for select
to authenticated
using (
  public.is_restaurant_member(restaurant_id)
  or public.is_super_admin()
);

create policy restaurant_settings_update
on public.restaurant_settings
for update
to authenticated
using (
  public.is_super_admin()
  or public.has_restaurant_role(
    restaurant_id,
    array['owner', 'admin', 'manager']::public.restaurant_role[]
  )
)
with check (
  public.is_super_admin()
  or public.has_restaurant_role(
    restaurant_id,
    array['owner', 'admin', 'manager']::public.restaurant_role[]
  )
);

-- HORÁRIOS

create policy business_hours_public_read
on public.business_hours
for select
to anon, authenticated
using (true);

create policy business_hours_insert
on public.business_hours
for insert
to authenticated
with check (
  public.is_super_admin()
  or public.has_restaurant_role(
    restaurant_id,
    array['owner', 'admin', 'manager']::public.restaurant_role[]
  )
);

create policy business_hours_update
on public.business_hours
for update
to authenticated
using (
  public.is_super_admin()
  or public.has_restaurant_role(
    restaurant_id,
    array['owner', 'admin', 'manager']::public.restaurant_role[]
  )
)
with check (
  public.is_super_admin()
  or public.has_restaurant_role(
    restaurant_id,
    array['owner', 'admin', 'manager']::public.restaurant_role[]
  )
);

create policy business_hours_delete
on public.business_hours
for delete
to authenticated
using (
  public.is_super_admin()
  or public.has_restaurant_role(
    restaurant_id,
    array['owner', 'admin', 'manager']::public.restaurant_role[]
  )
);
