-- =========================================================
-- TRIMOS FOOD
-- DISPARA PUSH QUANDO UMA ENTREGA É OFERECIDA
-- =========================================================

create extension if not exists pg_net
with schema extensions;

create or replace function public.notify_driver_delivery_offer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_url text;
  service_role_key text;
  order_total numeric;
  customer_name text;
begin
  if new.status <> 'offered'
     or new.offered_driver_id is null then
    return new;
  end if;

  if old.status = 'offered'
     and old.offered_driver_id is not distinct from new.offered_driver_id then
    return new;
  end if;

  select
    orders.total,
    orders.customer_name
  into
    order_total,
    customer_name
  from public.orders
  where orders.id = new.order_id;

  project_url :=
    'https://idgjixysrjuoarwvxtmf.supabase.co';

  service_role_key :=
    current_setting(
      'app.settings.service_role_key',
      true
    );

  if service_role_key is null
     or service_role_key = '' then
    raise warning
      'Service role key não configurada para Push';
    return new;
  end if;

  perform extensions.http_post(
    url :=
      project_url ||
      '/functions/v1/send-driver-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization',
      'Bearer ' || service_role_key
    ),
    body := jsonb_build_object(
      'driver_id', new.offered_driver_id,
      'title', 'Nova entrega no Hirotatsu 🍣',
      'body',
        coalesce(customer_name, 'Novo cliente') ||
        ' • ' ||
        to_char(coalesce(order_total, 0), 'FM999999990D00') ||
        ' €',
      'url', '/driver/dashboard',
      'tag', 'delivery-' || new.id::text
    )
  );

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
