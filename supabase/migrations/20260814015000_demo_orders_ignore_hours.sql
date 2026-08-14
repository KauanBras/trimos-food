-- The isolated demonstration restaurant is intentionally usable during sales
-- presentations, even when the real restaurant is outside its opening hours.
create or replace function public.apply_order_operational_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_restaurant public.restaurants%rowtype;
  target_settings public.restaurant_settings%rowtype;
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

  if not public.is_restaurant_member(new.restaurant_id) then
    if not coalesce(target_restaurant.is_demo, false) then
      local_now := timezone(target_restaurant.timezone, now());

      if not public.is_restaurant_open_at(new.restaurant_id, local_now) then
        raise exception 'O restaurante está fechado neste momento.';
      end if;
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

  if coalesce(target_settings.auto_accept_orders, false) and new.status = 'new' then
    new.status := 'preparing';
    new.accepted_at := now();
  end if;

  return new;
end;
$$;
