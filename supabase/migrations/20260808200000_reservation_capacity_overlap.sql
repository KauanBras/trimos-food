-- Controla a capacidade considerando toda a duração da mesa, não apenas o horário inicial.

create or replace function public.enforce_reservation_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  configured_capacity integer;
  occupied_seats integer;
  requested_start timestamp;
  requested_end timestamp;
begin
  if new.status in ('cancelled', 'no_show') then
    return new;
  end if;

  select reservation_capacity into configured_capacity
  from public.restaurant_settings
  where restaurant_id = new.restaurant_id;

  if configured_capacity is null then
    raise exception 'As reservas deste restaurante ainda não estão configuradas.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      new.restaurant_id::text || ':' || new.reservation_date::text,
      0
    )
  );

  requested_start := new.reservation_date + new.reservation_time;
  requested_end := requested_start + pg_catalog.make_interval(mins => new.duration_minutes);

  select coalesce(sum(reservation.party_size), 0)::integer
  into occupied_seats
  from public.reservations as reservation
  where reservation.restaurant_id = new.restaurant_id
    and reservation.id is distinct from new.id
    and reservation.status not in ('cancelled', 'no_show')
    and (reservation.reservation_date + reservation.reservation_time) < requested_end
    and (
      reservation.reservation_date
      + reservation.reservation_time
      + pg_catalog.make_interval(mins => reservation.duration_minutes)
    ) > requested_start;

  if occupied_seats + new.party_size > configured_capacity then
    raise exception 'Este horário já não tem lugares suficientes.';
  end if;

  return new;
end;
$$;

drop trigger if exists reservations_enforce_capacity on public.reservations;
create trigger reservations_enforce_capacity
before insert or update of restaurant_id, reservation_date, reservation_time,
  party_size, duration_minutes, status
on public.reservations
for each row execute function public.enforce_reservation_capacity();
