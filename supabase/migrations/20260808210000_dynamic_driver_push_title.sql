-- Remove o nome fixo do restaurante nas notificações já existentes dos estafetas.

create or replace function public.notify_driver_delivery_offer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_total numeric;
  customer_name text;
  restaurant_name text;
  currency_code text;
  request_id bigint;
begin
  if new.status <> 'offered' or new.offered_driver_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and old.status = 'offered'
    and old.offered_driver_id is not distinct from new.offered_driver_id then
    return new;
  end if;

  select
    orders.total,
    orders.customer_name,
    restaurants.name,
    restaurants.currency_code
  into
    order_total,
    customer_name,
    restaurant_name,
    currency_code
  from public.orders
  join public.restaurants on restaurants.id = orders.restaurant_id
  where orders.id = new.order_id;

  select net.http_post(
    url := 'https://idgjixysrjuoarwvxtmf.supabase.co/functions/v1/send-driver-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInJlZiI6ImlkZ2ppeHlzcmp1b2Fyd3Z4dG1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5NTczMzgsImV4cCI6MjEwMTUzMzMzOH0.BfFC2n7p32F7Az6oqyQJaznd8ZwBF5tpbboHgxg8xMc',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInJlZiI6ImlkZ2ppeHlzcmp1b2Fyd3Z4dG1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5NTczMzgsImV4cCI6MjEwMTUzMzMzOH0.BfFC2n7p32F7Az6oqyQJaznd8ZwBF5tpbboHgxg8xMc'
    ),
    body := jsonb_build_object(
      'driver_id', new.offered_driver_id,
      'title', 'Nova entrega · ' || coalesce(restaurant_name, 'Restaurante'),
      'body',
        coalesce(customer_name, 'Novo cliente') || ' · ' ||
        replace(
          to_char(coalesce(order_total, 0), 'FM999999990D00'),
          '.',
          ','
        ) || ' ' || coalesce(currency_code, 'EUR'),
      'url', '/driver/dashboard',
      'tag', 'delivery-' || new.id::text
    )
  ) into request_id;

  return new;
end;
$$;
