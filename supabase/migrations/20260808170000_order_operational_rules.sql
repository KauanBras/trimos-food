-- Aplica as configurações operacionais também no fluxo público de pedidos.

create or replace function public.apply_order_operational_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_restaurant public.restaurants%rowtype;
  target_settings public.restaurant_settings%rowtype;
  target_hours public.business_hours%rowtype;
  local_now timestamp;
  normalized_phone text;
begin
  select * into target_restaurant
  from public.restaurants
  where id = new.restaurant_id;

  if target_restaurant.id is null or target_restaurant.status <> 'active' then
    raise exception 'Restaurante indisponível.';
  end if;

  select * into target_settings
  from public.restaurant_settings
  where restaurant_id = new.restaurant_id;

  -- Colaboradores podem registar pedidos manuais fora do horário; clientes não.
  if not public.is_restaurant_member(new.restaurant_id) then
    local_now := timezone(target_restaurant.timezone, now());

    select * into target_hours
    from public.business_hours
    where restaurant_id = new.restaurant_id
      and day_of_week = extract(dow from local_now)::smallint;

    if target_hours.id is null
      or target_hours.is_closed
      or target_hours.opens_at is null
      or target_hours.closes_at is null then
      raise exception 'O restaurante está fechado neste momento.';
    end if;

    if target_hours.closes_at > target_hours.opens_at then
      if local_now::time < target_hours.opens_at
        or local_now::time >= target_hours.closes_at then
        raise exception 'O restaurante está fechado neste momento.';
      end if;
    elsif local_now::time < target_hours.opens_at
      and local_now::time >= target_hours.closes_at then
      raise exception 'O restaurante está fechado neste momento.';
    end if;

    normalized_phone := nullif(
      regexp_replace(trim(coalesce(new.customer_phone, '')), '[^0-9+]', '', 'g'),
      ''
    );

    if normalized_phone is not null and exists (
      select 1
      from public.customers as customer
      where customer.restaurant_id = new.restaurant_id
        and customer.phone = normalized_phone
        and customer.is_blocked
    ) then
      raise exception 'Não foi possível aceitar este pedido. Contacte o restaurante.';
    end if;
  end if;

  if coalesce(target_settings.auto_accept_orders, false)
    and new.status = 'new' then
    new.status := 'preparing';
    new.accepted_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists orders_apply_operational_rules on public.orders;
create trigger orders_apply_operational_rules
before insert on public.orders
for each row execute function public.apply_order_operational_rules();

-- Em produção, um perfil de estafeta só nasce através de um convite válido.
revoke all on function public.activate_current_user_as_driver()
from public, anon, authenticated;
