-- =========================================================
-- TRIMOS FOOD
-- EXPIRA E REDISTRIBUI OFERTAS AO FIM DE 30 SEGUNDOS
-- =========================================================

create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.expire_my_delivery_offer(
  requested_delivery_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_driver_id uuid;
  selected_delivery public.deliveries;
begin
  select drivers.id
  into current_driver_id
  from public.drivers
  where drivers.user_id = auth.uid()
    and drivers.is_active = true
  limit 1;

  if current_driver_id is null then
    raise exception 'Perfil de estafeta não encontrado';
  end if;

  select *
  into selected_delivery
  from public.deliveries
  where deliveries.id = requested_delivery_id
  for update;

  if selected_delivery.id is null
  then
    return false;
  end if;

  if selected_delivery.status <> 'offered'
     or selected_delivery.offered_driver_id
       is distinct from current_driver_id
     or selected_delivery.offer_expires_at > now()
  then
    return false;
  end if;

  insert into public.delivery_rejections (
    delivery_id,
    driver_id
  )
  values (
    selected_delivery.id,
    current_driver_id
  )
  on conflict (delivery_id, driver_id) do nothing;

  update public.deliveries
  set
    status = 'searching_driver',
    offered_driver_id = null,
    offer_started_at = null,
    offer_expires_at = null
  where deliveries.id = selected_delivery.id;

  perform public.dispatch_next_driver(selected_delivery.id);

  return true;
end;
$$;

revoke all on function public.expire_my_delivery_offer(uuid)
from public;

grant execute on function public.expire_my_delivery_offer(uuid)
to authenticated;

select cron.schedule(
  'process-expired-delivery-offers',
  '10 seconds',
  $cron$select public.process_expired_delivery_offers();$cron$
);
