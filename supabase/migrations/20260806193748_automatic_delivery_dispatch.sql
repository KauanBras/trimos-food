-- =========================================================
-- TRIMOS FOOD
-- DISPATCH AUTOMÁTICO QUANDO O PEDIDO FICA PRONTO
-- =========================================================

-- Remove o trigger antigo, porque ele poderia reiniciar uma
-- entrega que já tivesse sido oferecida a um estafeta.
drop trigger if exists orders_ensure_delivery on public.orders;
drop function if exists public.ensure_delivery_for_order();

create or replace function public.dispatch_ready_delivery_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_delivery_id uuid;
begin
  if new.type <> 'delivery'
     or new.status <> 'ready'
     or old.status is not distinct from new.status
  then
    return new;
  end if;

  insert into public.deliveries (
    restaurant_id,
    order_id,
    status,
    delivery_address,
    delivery_fee,
    driver_id,
    offered_driver_id,
    offer_started_at,
    offer_expires_at,
    accepted_at,
    picked_up_at,
    delivered_at,
    cancelled_at
  )
  values (
    new.restaurant_id,
    new.id,
    'searching_driver',
    coalesce(new.delivery_address, 'Morada não informada'),
    new.delivery_fee,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null
  )
  on conflict (order_id)
  do update set
    status = 'searching_driver',
    delivery_address = excluded.delivery_address,
    delivery_fee = excluded.delivery_fee,
    driver_id = null,
    offered_driver_id = null,
    offer_started_at = null,
    offer_expires_at = null,
    accepted_at = null,
    picked_up_at = null,
    delivered_at = null,
    cancelled_at = null
  returning id into new_delivery_id;

  update public.orders
  set status = 'awaiting_driver'
  where id = new.id;

  perform public.dispatch_next_driver(new_delivery_id);

  return new;
end;
$$;

create trigger orders_dispatch_ready_delivery
after update of status on public.orders
for each row
execute function public.dispatch_ready_delivery_order();

-- =========================================================
-- APENAS O ESTAFETA ESCOLHIDO VÊ A OFERTA
-- =========================================================

drop policy if exists deliveries_restaurant_read
on public.deliveries;

create policy deliveries_restaurant_read
on public.deliveries
for select
to authenticated
using (
  public.is_restaurant_member(restaurant_id)

  or exists (
    select 1
    from public.drivers
    where drivers.user_id = auth.uid()
      and drivers.is_active = true
      and (
        deliveries.offered_driver_id = drivers.id
        or deliveries.driver_id = drivers.id
      )
  )

  or public.is_super_admin()
);
