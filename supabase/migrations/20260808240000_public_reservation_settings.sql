-- Expõe somente as regras necessárias ao formulário público de reservas.
-- As restantes configurações do restaurante, incluindo coordenadas, continuam privadas.

create or replace function public.get_public_reservation_settings(
  requested_restaurant_id uuid
)
returns table (
  reservation_slot_minutes integer,
  reservation_advance_days integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    settings.reservation_slot_minutes,
    settings.reservation_advance_days
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
