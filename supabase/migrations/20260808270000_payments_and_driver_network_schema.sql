-- Pagamentos diretos por restaurante, rede partilhada de estafetas e acertos.

do $$ begin
  create type public.payment_method as enum ('cash', 'terminal', 'mb_way');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum (
    'pending',
    'awaiting_collection',
    'paid',
    'failed',
    'refunded',
    'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.driver_pool_mode as enum ('private', 'network', 'hybrid');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.driver_assignment_source as enum ('private', 'network');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.driver_payout_method as enum ('mb_way', 'bank_transfer', 'cash');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.driver_earning_status as enum ('pending', 'settled', 'cancelled');
exception when duplicate_object then null; end $$;

alter type public.order_status add value if not exists 'pending_payment' before 'new';

alter table public.restaurant_settings
  add column if not exists accepts_cash boolean not null default true,
  add column if not exists accepts_terminal boolean not null default true,
  add column if not exists accepts_mb_way boolean not null default false,
  add column if not exists stripe_account_id text,
  add column if not exists stripe_charges_enabled boolean not null default false,
  add column if not exists stripe_payouts_enabled boolean not null default false,
  add column if not exists stripe_details_submitted boolean not null default false,
  add column if not exists stripe_connected_at timestamptz,
  add column if not exists driver_pool_mode public.driver_pool_mode not null default 'private',
  add column if not exists driver_fee_base numeric(10,2),
  add column if not exists driver_fee_per_km numeric(10,2);

alter table public.restaurant_settings
  drop constraint if exists restaurant_settings_driver_fee_base_positive,
  add constraint restaurant_settings_driver_fee_base_positive
    check (driver_fee_base is null or driver_fee_base >= 0),
  drop constraint if exists restaurant_settings_driver_fee_per_km_positive,
  add constraint restaurant_settings_driver_fee_per_km_positive
    check (driver_fee_per_km is null or driver_fee_per_km >= 0);

create unique index if not exists restaurant_settings_stripe_account_unique
  on public.restaurant_settings(stripe_account_id)
  where stripe_account_id is not null;

alter table public.orders
  add column if not exists payment_method public.payment_method not null default 'cash',
  add column if not exists payment_status public.payment_status not null default 'awaiting_collection',
  add column if not exists cash_tendered_amount numeric(10,2),
  add column if not exists payment_provider text,
  add column if not exists provider_checkout_session_id text,
  add column if not exists provider_payment_id text,
  add column if not exists payment_failure_reason text,
  add column if not exists paid_at timestamptz,
  add column if not exists refunded_at timestamptz;

alter table public.orders
  drop constraint if exists orders_cash_tendered_positive,
  add constraint orders_cash_tendered_positive
    check (cash_tendered_amount is null or cash_tendered_amount >= 0);

create unique index if not exists orders_provider_checkout_session_unique
  on public.orders(provider_checkout_session_id)
  where provider_checkout_session_id is not null;

update public.orders
set payment_status = 'paid',
    paid_at = coalesce(completed_at, updated_at)
where status = 'completed'
  and payment_status = 'awaiting_collection';

alter table public.drivers
  add column if not exists is_network_enabled boolean not null default false,
  add column if not exists network_enabled_at timestamptz,
  add column if not exists network_radius_km numeric(6,2) not null default 10,
  add column if not exists payout_method public.driver_payout_method not null default 'mb_way',
  add column if not exists payout_phone text,
  add column if not exists payout_iban text;

alter table public.drivers
  drop constraint if exists drivers_network_radius_valid,
  add constraint drivers_network_radius_valid
    check (network_radius_km between 1 and 100);

create table if not exists public.restaurant_drivers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  is_active boolean not null default true,
  is_preferred boolean not null default true,
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, driver_id)
);

insert into public.restaurant_drivers (restaurant_id, driver_id, is_active, is_preferred)
select driver.restaurant_id, driver.id, driver.is_active, true
from public.drivers as driver
on conflict (restaurant_id, driver_id)
do update set is_active = excluded.is_active;

create index if not exists restaurant_drivers_restaurant_idx
  on public.restaurant_drivers(restaurant_id, is_active, is_preferred);
create index if not exists restaurant_drivers_driver_idx
  on public.restaurant_drivers(driver_id, is_active);

create trigger restaurant_drivers_set_updated_at
before update on public.restaurant_drivers
for each row execute function public.set_updated_at();

alter table public.deliveries
  add column if not exists driver_fee numeric(10,2) not null default 0,
  add column if not exists assignment_source public.driver_assignment_source;

alter table public.deliveries
  drop constraint if exists deliveries_driver_fee_positive,
  add constraint deliveries_driver_fee_positive check (driver_fee >= 0);

create table if not exists public.driver_earnings (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  delivery_id uuid not null unique references public.deliveries(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  payment_method public.payment_method not null,
  order_total numeric(10,2) not null,
  driver_fee numeric(10,2) not null,
  cash_collected numeric(10,2) not null default 0,
  net_balance numeric(10,2) not null,
  status public.driver_earning_status not null default 'pending',
  settlement_reference text,
  settled_at timestamptz,
  settled_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (order_total >= 0),
  check (driver_fee >= 0),
  check (cash_collected >= 0)
);

create index if not exists driver_earnings_restaurant_idx
  on public.driver_earnings(restaurant_id, status, created_at desc);
create index if not exists driver_earnings_driver_idx
  on public.driver_earnings(driver_id, status, created_at desc);

create trigger driver_earnings_set_updated_at
before update on public.driver_earnings
for each row execute function public.set_updated_at();

alter table public.restaurant_drivers enable row level security;
alter table public.driver_earnings enable row level security;

drop policy if exists restaurant_drivers_read on public.restaurant_drivers;
create policy restaurant_drivers_read
on public.restaurant_drivers for select to authenticated
using (
  public.is_restaurant_member(restaurant_id)
  or exists (
    select 1 from public.drivers
    where drivers.id = restaurant_drivers.driver_id
      and drivers.user_id = auth.uid()
  )
  or public.is_super_admin()
);

drop policy if exists restaurant_drivers_manage on public.restaurant_drivers;
create policy restaurant_drivers_manage
on public.restaurant_drivers for all to authenticated
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

drop policy if exists driver_earnings_read on public.driver_earnings;
create policy driver_earnings_read
on public.driver_earnings for select to authenticated
using (
  public.is_restaurant_member(restaurant_id)
  or exists (
    select 1 from public.drivers
    where drivers.id = driver_earnings.driver_id
      and drivers.user_id = auth.uid()
  )
  or public.is_super_admin()
);

do $$ begin
  alter publication supabase_realtime add table public.driver_earnings;
exception when duplicate_object then null; end $$;
