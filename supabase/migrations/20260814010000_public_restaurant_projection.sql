-- Public projection: deliberately excludes tax, ownership and demo-control data.
create or replace view public.public_restaurants
with (security_barrier = true)
as
select
  id,
  name,
  slug,
  description,
  logo_url,
  cover_url,
  phone,
  email,
  address_line,
  city,
  postal_code,
  country_code,
  currency_code,
  timezone,
  accepts_delivery,
  accepts_pickup,
  accepts_dine_in,
  accepts_reservations,
  status,
  is_demo
from public.restaurants
where status = 'active';

revoke all on public.public_restaurants from public;
grant select on public.public_restaurants to anon, authenticated;

