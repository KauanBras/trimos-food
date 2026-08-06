create or replace function public.ensure_delivery_for_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.type = 'delivery'
     and new.status = 'awaiting_driver'
     and (
       tg_op = 'INSERT'
       or old.status is distinct from new.status
     )
  then
    insert into public.deliveries (
      restaurant_id,
      order_id,
      status,
      delivery_address,
      delivery_fee,
      offered_at
    )
    values (
      new.restaurant_id,
      new.id,
      'searching_driver',
      coalesce(new.delivery_address, 'Morada não informada'),
      new.delivery_fee,
      now()
    )
    on conflict (order_id)
    do update set
      status = 'searching_driver',
      delivery_address = excluded.delivery_address,
      delivery_fee = excluded.delivery_fee,
      offered_at = now(),
      driver_id = null,
      accepted_at = null,
      picked_up_at = null,
      delivered_at = null,
      cancelled_at = null;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_ensure_delivery on public.orders;

create trigger orders_ensure_delivery
after insert or update of status on public.orders
for each row
execute function public.ensure_delivery_for_order();

insert into public.deliveries (
  restaurant_id,
  order_id,
  status,
  delivery_address,
  delivery_fee,
  offered_at
)
select
  orders.restaurant_id,
  orders.id,
  'searching_driver',
  coalesce(orders.delivery_address, 'Morada não informada'),
  orders.delivery_fee,
  now()
from public.orders
where orders.type = 'delivery'
  and orders.status = 'awaiting_driver'
on conflict (order_id)
do update set
  status = 'searching_driver',
  delivery_address = excluded.delivery_address,
  delivery_fee = excluded.delivery_fee,
  offered_at = now(),
  driver_id = null,
  accepted_at = null,
  picked_up_at = null,
  delivered_at = null,
  cancelled_at = null;
