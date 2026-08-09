-- Configurable reservation offers (TheFork-style) and real product promotions
-- (Glovo-style). Product.price remains the amount charged by checkout; when a
-- promotion is enabled, regular_price stores the crossed-out reference price.

alter table public.products
  add column if not exists regular_price numeric(10,2),
  add column if not exists promotion_enabled boolean not null default false,
  add column if not exists promotion_label text,
  add column if not exists archived_at timestamptz;

alter table public.products
  drop constraint if exists products_regular_price_check,
  add constraint products_regular_price_check
  check (regular_price is null or regular_price >= 0),
  drop constraint if exists products_active_promotion_check,
  add constraint products_active_promotion_check
  check (
    not promotion_enabled
    or (regular_price is not null and regular_price > price)
  );

alter table public.restaurant_settings
  add column if not exists reservation_discount_enabled boolean not null default false,
  add column if not exists reservation_discount_percent numeric(5,2),
  add column if not exists reservation_discount_description text,
  add column if not exists reservation_discount_starts_on date,
  add column if not exists reservation_discount_ends_on date,
  add column if not exists reservation_discount_days smallint[] not null default array[0,1,2,3,4,5,6]::smallint[],
  add column if not exists reservation_discount_start_time time,
  add column if not exists reservation_discount_end_time time;

alter table public.restaurant_settings
  drop constraint if exists restaurant_settings_reservation_discount_percent_check,
  add constraint restaurant_settings_reservation_discount_percent_check
  check (
    reservation_discount_percent is null
    or reservation_discount_percent between 1 and 90
  ),
  drop constraint if exists restaurant_settings_reservation_discount_dates_check,
  add constraint restaurant_settings_reservation_discount_dates_check
  check (
    reservation_discount_starts_on is null
    or reservation_discount_ends_on is null
    or reservation_discount_starts_on <= reservation_discount_ends_on
  ),
  drop constraint if exists restaurant_settings_reservation_discount_days_check,
  add constraint restaurant_settings_reservation_discount_days_check
  check (
    cardinality(reservation_discount_days) between 1 and 7
    and reservation_discount_days <@ array[0,1,2,3,4,5,6]::smallint[]
  ),
  drop constraint if exists restaurant_settings_reservation_discount_times_check,
  add constraint restaurant_settings_reservation_discount_times_check
  check (
    (reservation_discount_start_time is null and reservation_discount_end_time is null)
    or (
      reservation_discount_start_time is not null
      and reservation_discount_end_time is not null
      and reservation_discount_start_time <> reservation_discount_end_time
    )
  ),
  drop constraint if exists restaurant_settings_reservation_discount_enabled_check,
  add constraint restaurant_settings_reservation_discount_enabled_check
  check (
    not reservation_discount_enabled
    or reservation_discount_percent is not null
  );

alter table public.reservations
  add column if not exists discount_percent numeric(5,2),
  add column if not exists discount_label text;

alter table public.reservations
  drop constraint if exists reservations_discount_percent_check,
  add constraint reservations_discount_percent_check
  check (discount_percent is null or discount_percent between 1 and 90);

create or replace function public.reservation_discount_for_slot(
  requested_restaurant_id uuid,
  requested_date date,
  requested_time time
)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when settings.reservation_discount_enabled
      and settings.reservation_discount_percent is not null
      and (
        settings.reservation_discount_starts_on is null
        or requested_date >= settings.reservation_discount_starts_on
      )
      and (
        settings.reservation_discount_ends_on is null
        or requested_date <= settings.reservation_discount_ends_on
      )
      and extract(dow from requested_date)::smallint = any(settings.reservation_discount_days)
      and (
        settings.reservation_discount_start_time is null
        or (
          settings.reservation_discount_start_time < settings.reservation_discount_end_time
          and requested_time >= settings.reservation_discount_start_time
          and requested_time < settings.reservation_discount_end_time
        )
        or (
          settings.reservation_discount_start_time > settings.reservation_discount_end_time
          and (
            requested_time >= settings.reservation_discount_start_time
            or requested_time < settings.reservation_discount_end_time
          )
        )
      )
    then round(settings.reservation_discount_percent, 2)
    else 0::numeric
  end
  from public.restaurant_settings as settings
  where settings.restaurant_id = requested_restaurant_id;
$$;

revoke all on function public.reservation_discount_for_slot(uuid, date, time)
from public;

create or replace function public.apply_reservation_discount_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_discount numeric;
  selected_label text;
begin
  if new.source <> 'public'::public.reservation_source then
    new.discount_percent := null;
    new.discount_label := null;
    return new;
  end if;

  selected_discount := public.reservation_discount_for_slot(
    new.restaurant_id,
    new.reservation_date,
    new.reservation_time
  );

  if coalesce(selected_discount, 0) <= 0 then
    new.discount_percent := null;
    new.discount_label := null;
    return new;
  end if;

  select coalesce(
    nullif(trim(settings.reservation_discount_description), ''),
    'Desconto na refeição'
  )
  into selected_label
  from public.restaurant_settings as settings
  where settings.restaurant_id = new.restaurant_id;

  new.discount_percent := selected_discount;
  new.discount_label := selected_label;
  return new;
end;
$$;

drop trigger if exists reservations_apply_discount_snapshot
on public.reservations;
create trigger reservations_apply_discount_snapshot
before insert or update of restaurant_id, reservation_date, reservation_time, source
on public.reservations
for each row execute function public.apply_reservation_discount_snapshot();

drop function if exists public.get_public_reservation_settings(uuid);
create function public.get_public_reservation_settings(
  requested_restaurant_id uuid
)
returns table (
  reservation_slot_minutes integer,
  reservation_advance_days integer,
  reservation_discount_enabled boolean,
  reservation_discount_percent numeric,
  reservation_discount_description text,
  reservation_discount_starts_on date,
  reservation_discount_ends_on date,
  reservation_discount_days smallint[],
  reservation_discount_start_time time,
  reservation_discount_end_time time
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    settings.reservation_slot_minutes,
    settings.reservation_advance_days,
    settings.reservation_discount_enabled,
    settings.reservation_discount_percent,
    settings.reservation_discount_description,
    settings.reservation_discount_starts_on,
    settings.reservation_discount_ends_on,
    settings.reservation_discount_days,
    settings.reservation_discount_start_time,
    settings.reservation_discount_end_time
  from public.restaurant_settings as settings
  join public.restaurants as restaurant
    on restaurant.id = settings.restaurant_id
  where settings.restaurant_id = requested_restaurant_id
    and restaurant.status = 'active'
    and restaurant.accepts_reservations;
$$;

revoke all on function public.get_public_reservation_settings(uuid) from public;
grant execute on function public.get_public_reservation_settings(uuid)
to anon, authenticated;

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
    'discountPercent', reservation.discount_percent,
    'discountLabel', reservation.discount_label,
    'createdAt', reservation.created_at
  )
  from public.reservations as reservation
  where reservation.id = requested_reservation_id
    and reservation.public_token = requested_reservation_token;
$$;

-- Reproduce the currently visible Glovo promotions in the imported catalogue.
update public.products as product
set price = promotion.price,
    regular_price = promotion.regular_price,
    promotion_enabled = true,
    promotion_label = promotion.label
from (
  values
    ('Gyoza 5 unidades'::text, 5.02::numeric, 5.90::numeric, '-15%'),
    ('Combo Mix 1'::text, 21.17::numeric, 22.28::numeric, '-5%'),
    ('Sushi Box 20 peças'::text, 16.92::numeric, 17.81::numeric, '-5%'),
    ('Sushi Hot (16 unidades)'::text, 16.06::numeric, 16.91::numeric, '-5%')
) as promotion(name, price, regular_price, label)
cross join public.restaurants as restaurant
where restaurant.slug = 'hirotatsu-sushi'
  and restaurant.id = product.restaurant_id
  and lower(trim(product.name)) = lower(trim(promotion.name))
  and product.is_active;

-- Keep replaced rows recoverable while removing them from normal management.
update public.products as product
set archived_at = now()
from public.restaurants as restaurant
where restaurant.id = product.restaurant_id
  and restaurant.slug = 'hirotatsu-sushi'
  and not product.is_active
  and product.archived_at is null;
