-- =========================================================
-- TRIMOS FOOD
-- CORRIGE AUTENTICAÇÃO DO PUSH AUTOMÁTICO
-- =========================================================

create extension if not exists pg_net;

create or replace function public.notify_driver_delivery_offer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_total numeric;
  customer_name text;
  request_id bigint;
begin
  if new.status <> 'offered'
     or new.offered_driver_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.status = 'offered'
     and old.offered_driver_id
       is not distinct from new.offered_driver_id then
    return new;
  end if;

  select
    o.total,
    o.customer_name
  into
    order_total,
    customer_name
  from public.orders o
  where o.id = new.order_id;

  select net.http_post(
    url := 'https://idgjixysrjuoarwvxtmf.supabase.co/functions/v1/send-driver-push',

    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkZ2ppeHlzcmp1b2Fyd3Z4dG1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5NTczMzgsImV4cCI6MjEwMTUzMzMzOH0.BfFC2n7p32F7Az6oqyQJaznd8ZwBF5tpbboHgxg8xMc',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkZ2ppeHlzcmp1b2Fyd3Z4dG1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5NTczMzgsImV4cCI6MjEwMTUzMzMzOH0.BfFC2n7p32F7Az6oqyQJaznd8ZwBF5tpbboHgxg8xMc'
    ),

    body := jsonb_build_object(
      'driver_id', new.offered_driver_id,
      'title', 'Nova entrega no Hirotatsu 🍣',
      'body',
        coalesce(customer_name, 'Novo cliente') ||
        ' • ' ||
        replace(
          to_char(
            coalesce(order_total, 0),
            'FM999999990D00'
          ),
          '.',
          ','
        ) ||
        ' €',
      'url', '/driver/dashboard',
      'tag', 'delivery-' || new.id::text
    )
  )
  into request_id;

  return new;
end;
$$;

drop trigger if exists deliveries_send_push_on_offer
on public.deliveries;

create trigger deliveries_send_push_on_offer
after insert or update of status, offered_driver_id
on public.deliveries
for each row
execute function public.notify_driver_delivery_offer();
