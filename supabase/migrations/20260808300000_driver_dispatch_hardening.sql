-- Reforça a autorização das etapas de entrega e respeita bloqueios locais
-- mesmo quando o estafeta participa na rede partilhada.

create or replace function public.dispatch_next_driver(requested_delivery_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_delivery public.deliveries;
  selected_driver_id uuid;
  selected_source public.driver_assignment_source;
begin
  select * into selected_delivery
  from public.deliveries where id = requested_delivery_id for update;

  if selected_delivery.id is null then raise exception 'Entrega não encontrada'; end if;
  if selected_delivery.status in ('accepted', 'picked_up', 'delivered', 'cancelled') then
    return selected_delivery.offered_driver_id;
  end if;

  select candidate.id, candidate.assignment_source
  into selected_driver_id, selected_source
  from (
    select
      driver.id,
      case when private_link.driver_id is not null and private_link.is_active
        then 'private'::public.driver_assignment_source
        else 'network'::public.driver_assignment_source
      end as assignment_source,
      case
        when driver.current_latitude is not null
          and driver.current_longitude is not null
          and settings.delivery_origin_latitude is not null
          and settings.delivery_origin_longitude is not null
        then 6371 * 2 * asin(least(1, sqrt(
          power(sin(radians(driver.current_latitude - settings.delivery_origin_latitude) / 2), 2)
          + cos(radians(settings.delivery_origin_latitude)) * cos(radians(driver.current_latitude))
          * power(sin(radians(driver.current_longitude - settings.delivery_origin_longitude) / 2), 2)
        )))
        else null
      end as distance_from_restaurant,
      settings.driver_pool_mode
    from public.drivers as driver
    join public.restaurant_settings as settings
      on settings.restaurant_id = selected_delivery.restaurant_id
    left join public.restaurant_drivers as private_link
      on private_link.restaurant_id = selected_delivery.restaurant_id
      and private_link.driver_id = driver.id
    where driver.status = 'available'
      and driver.is_active
      and coalesce(private_link.is_active, true)
      and (
        (settings.driver_pool_mode in ('private', 'hybrid')
          and private_link.driver_id is not null and private_link.is_active)
        or (
          settings.driver_pool_mode in ('network', 'hybrid')
          and driver.is_network_enabled
          and driver.current_latitude is not null
          and driver.current_longitude is not null
          and driver.location_updated_at >= now() - interval '20 minutes'
          and (
            settings.delivery_origin_latitude is null
            or settings.delivery_origin_longitude is null
            or 6371 * 2 * asin(least(1, sqrt(
              power(sin(radians(driver.current_latitude - settings.delivery_origin_latitude) / 2), 2)
              + cos(radians(settings.delivery_origin_latitude)) * cos(radians(driver.current_latitude))
              * power(sin(radians(driver.current_longitude - settings.delivery_origin_longitude) / 2), 2)
            ))) <= driver.network_radius_km
          )
        )
      )
      and not exists (
        select 1 from public.delivery_rejections as rejection
        where rejection.delivery_id = selected_delivery.id
          and rejection.driver_id = driver.id
      )
      and not exists (
        select 1 from public.deliveries as active_delivery
        where active_delivery.driver_id = driver.id
          and active_delivery.status in ('accepted', 'picked_up')
      )
  ) as candidate
  order by
    case when candidate.driver_pool_mode = 'hybrid'
      then (candidate.assignment_source = 'private')::integer else 0 end desc,
    candidate.distance_from_restaurant asc nulls last,
    candidate.id
  limit 1;

  if selected_driver_id is null then
    update public.deliveries
    set status = 'searching_driver', offered_driver_id = null,
        assignment_source = null, offer_started_at = null, offer_expires_at = null
    where id = selected_delivery.id;
    return null;
  end if;

  update public.deliveries
  set status = 'offered', offered_driver_id = selected_driver_id,
      assignment_source = selected_source, offer_started_at = now(),
      offer_expires_at = now() + interval '30 seconds',
      dispatch_attempts = dispatch_attempts + 1
  where id = selected_delivery.id;

  return selected_driver_id;
end;
$$;

grant execute on function public.dispatch_next_driver(uuid) to authenticated;

create or replace function public.pick_up_delivery(requested_delivery_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_driver public.drivers;
  selected_delivery public.deliveries;
begin
  select * into current_driver
  from public.drivers
  where user_id = auth.uid() and is_active
  order by created_at
  limit 1;

  if current_driver.id is null then raise exception 'Perfil de estafeta não encontrado'; end if;

  select * into selected_delivery
  from public.deliveries
  where id = requested_delivery_id
  for update;

  if selected_delivery.id is null then raise exception 'Entrega não encontrada'; end if;
  if selected_delivery.driver_id is distinct from current_driver.id then raise exception 'Esta entrega não pertence ao estafeta'; end if;
  if selected_delivery.status <> 'accepted' then raise exception 'A entrega ainda não pode ser recolhida'; end if;

  update public.deliveries
  set status = 'picked_up', picked_up_at = now()
  where id = selected_delivery.id;

  update public.orders
  set status = 'out_for_delivery'
  where id = selected_delivery.order_id;
end;
$$;

grant execute on function public.pick_up_delivery(uuid) to authenticated;
