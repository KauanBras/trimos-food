-- Horários partidos por dia e cálculo privado de distância por coordenadas autorizadas.

alter table public.business_hours
  drop constraint if exists business_hours_unique_day;

alter table public.business_hours
  add column if not exists sort_order integer not null default 0;

alter table public.business_hours
  add constraint business_hours_unique_period
  unique (restaurant_id, day_of_week, sort_order);

alter table public.restaurant_settings
  add column delivery_fee_per_km numeric(10,2) not null default 0,
  add column delivery_origin_latitude numeric(10,7),
  add column delivery_origin_longitude numeric(10,7),
  add constraint restaurant_settings_delivery_fee_per_km_check
    check (delivery_fee_per_km >= 0),
  add constraint restaurant_settings_delivery_origin_latitude_check
    check (delivery_origin_latitude is null or delivery_origin_latitude between -90 and 90),
  add constraint restaurant_settings_delivery_origin_longitude_check
    check (delivery_origin_longitude is null or delivery_origin_longitude between -180 and 180),
  add constraint restaurant_settings_delivery_origin_pair_check
    check ((delivery_origin_latitude is null) = (delivery_origin_longitude is null));

alter table public.orders
  add column delivery_latitude numeric(10,7),
  add column delivery_longitude numeric(10,7),
  add column delivery_distance_km numeric(8,3),
  add constraint orders_delivery_latitude_check
    check (delivery_latitude is null or delivery_latitude between -90 and 90),
  add constraint orders_delivery_longitude_check
    check (delivery_longitude is null or delivery_longitude between -180 and 180),
  add constraint orders_delivery_distance_check
    check (delivery_distance_km is null or delivery_distance_km >= 0);

create or replace function public.replace_restaurant_business_hours(
  requested_restaurant_id uuid,
  requested_schedule jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  day_number integer;
  day_rows integer;
  closed_rows integer;
begin
  if not (
    public.is_super_admin()
    or public.has_restaurant_role(
      requested_restaurant_id,
      array['owner','admin','manager']::public.restaurant_role[]
    )
  ) then
    raise exception 'Não tem permissão para alterar os horários.';
  end if;

  if jsonb_typeof(requested_schedule) <> 'array'
    or jsonb_array_length(requested_schedule) < 7
    or jsonb_array_length(requested_schedule) > 35 then
    raise exception 'O horário semanal enviado é inválido.';
  end if;

  if (
    select count(distinct (entry->>'day_of_week')::integer)
    from jsonb_array_elements(requested_schedule) as item(entry)
  ) <> 7 then
    raise exception 'Configure todos os sete dias da semana.';
  end if;

  for day_number in 0..6 loop
    select count(*), count(*) filter (where (entry->>'is_closed')::boolean)
    into day_rows, closed_rows
    from jsonb_array_elements(requested_schedule) as item(entry)
    where (entry->>'day_of_week')::integer = day_number;

    if day_rows < 1 or day_rows > 4 then
      raise exception 'Cada dia deve ter entre um e quatro períodos.';
    end if;
    if closed_rows > 0 and (closed_rows <> 1 or day_rows <> 1) then
      raise exception 'Um dia fechado não pode ter períodos abertos.';
    end if;
  end loop;

  if exists (
    select 1
    from jsonb_array_elements(requested_schedule) as item(entry)
    where (entry->>'day_of_week')::integer not between 0 and 6
      or (entry->>'sort_order')::integer not between 0 and 3
      or (
        not (entry->>'is_closed')::boolean
        and (
          nullif(entry->>'opens_at', '') is null
          or nullif(entry->>'closes_at', '') is null
          or (entry->>'opens_at')::time = (entry->>'closes_at')::time
        )
      )
  ) then
    raise exception 'Existe um período de funcionamento inválido.';
  end if;

  delete from public.business_hours
  where restaurant_id = requested_restaurant_id;

  insert into public.business_hours (
    restaurant_id,
    day_of_week,
    opens_at,
    closes_at,
    is_closed,
    sort_order
  )
  select
    requested_restaurant_id,
    (entry->>'day_of_week')::smallint,
    case when (entry->>'is_closed')::boolean then null else (entry->>'opens_at')::time end,
    case when (entry->>'is_closed')::boolean then null else (entry->>'closes_at')::time end,
    (entry->>'is_closed')::boolean,
    (entry->>'sort_order')::integer
  from jsonb_array_elements(requested_schedule) as item(entry);
end;
$$;

revoke all on function public.replace_restaurant_business_hours(uuid, jsonb)
from public, anon;
grant execute on function public.replace_restaurant_business_hours(uuid, jsonb)
to authenticated;

create or replace function public.is_restaurant_open_at(
  requested_restaurant_id uuid,
  requested_local_timestamp timestamp
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.business_hours as period
      where period.restaurant_id = requested_restaurant_id
        and not period.is_closed
        and period.opens_at is not null
        and period.closes_at is not null
        and period.day_of_week = extract(dow from requested_local_timestamp)::smallint
        and (
          (period.closes_at > period.opens_at
            and requested_local_timestamp::time >= period.opens_at
            and requested_local_timestamp::time < period.closes_at)
          or
          (period.closes_at < period.opens_at
            and requested_local_timestamp::time >= period.opens_at)
        )
    )
    or exists (
      select 1
      from public.business_hours as previous_period
      where previous_period.restaurant_id = requested_restaurant_id
        and not previous_period.is_closed
        and previous_period.opens_at is not null
        and previous_period.closes_at < previous_period.opens_at
        and previous_period.day_of_week = ((extract(dow from requested_local_timestamp)::integer + 6) % 7)::smallint
        and requested_local_timestamp::time < previous_period.closes_at
    );
$$;

revoke all on function public.is_restaurant_open_at(uuid, timestamp)
from public, anon, authenticated;

create or replace function public.is_restaurant_reservation_slot(
  requested_restaurant_id uuid,
  requested_date date,
  requested_time time,
  requested_slot_minutes integer
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_hours as period
    where period.restaurant_id = requested_restaurant_id
      and not period.is_closed
      and period.opens_at is not null
      and period.closes_at is not null
      and (
        (
          period.day_of_week = extract(dow from requested_date)::smallint
          and requested_time >= period.opens_at
          and (
            period.closes_at < period.opens_at
            or requested_time < period.closes_at
          )
          and mod(
            extract(hour from requested_time)::integer * 60
              + extract(minute from requested_time)::integer
              - extract(hour from period.opens_at)::integer * 60
              - extract(minute from period.opens_at)::integer,
            requested_slot_minutes
          ) = 0
        )
        or
        (
          period.day_of_week = ((extract(dow from requested_date)::integer + 6) % 7)::smallint
          and period.closes_at < period.opens_at
          and requested_time < period.closes_at
          and mod(
            extract(hour from requested_time)::integer * 60
              + extract(minute from requested_time)::integer
              + 1440
              - extract(hour from period.opens_at)::integer * 60
              - extract(minute from period.opens_at)::integer,
            requested_slot_minutes
          ) = 0
        )
      )
  );
$$;

revoke all on function public.is_restaurant_reservation_slot(uuid, date, time, integer)
from public, anon, authenticated;

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
    local_now := timezone(target_restaurant.timezone, now());

    if not public.is_restaurant_open_at(new.restaurant_id, local_now) then
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

  if coalesce(target_settings.auto_accept_orders, false) and new.status = 'new' then
    new.status := 'preparing';
    new.accepted_at := now();
  end if;

  return new;
end;
$$;

create or replace function public.create_public_reservation(
  requested_restaurant_id uuid,
  requested_customer_name text,
  requested_customer_phone text,
  requested_customer_email text,
  requested_date date,
  requested_time time,
  requested_party_size integer,
  requested_special_requests text
)
returns table (
  reservation_id uuid,
  reservation_token uuid,
  reservation_state public.reservation_status
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_restaurant public.restaurants%rowtype;
  target_settings public.restaurant_settings%rowtype;
  local_now timestamp;
  selected_status public.reservation_status;
  created_reservation_id uuid;
  created_reservation_token uuid;
begin
  select * into target_restaurant
  from public.restaurants
  where id = requested_restaurant_id
    and status = 'active'
    and accepts_reservations = true;

  if target_restaurant.id is null then
    raise exception 'Este restaurante não está a aceitar reservas.';
  end if;

  select * into target_settings
  from public.restaurant_settings
  where restaurant_id = requested_restaurant_id;

  local_now := timezone(target_restaurant.timezone, now());

  if requested_date < local_now::date
    or requested_date > local_now::date + target_settings.reservation_advance_days then
    raise exception 'A data escolhida não está disponível para reserva.';
  end if;
  if requested_date = local_now::date and requested_time <= local_now::time then
    raise exception 'Escolha um horário futuro.';
  end if;
  if requested_party_size < 1 or requested_party_size > 50 then
    raise exception 'O número de pessoas é inválido.';
  end if;
  if length(trim(coalesce(requested_customer_name, ''))) < 2 then
    raise exception 'Informe o nome da reserva.';
  end if;
  if length(regexp_replace(coalesce(requested_customer_phone, ''), '[^0-9+]', '', 'g')) < 6 then
    raise exception 'Informe um telefone válido.';
  end if;
  if not public.is_restaurant_reservation_slot(
    requested_restaurant_id,
    requested_date,
    requested_time,
    target_settings.reservation_slot_minutes
  ) then
    raise exception 'Escolha um dos horários disponíveis.';
  end if;

  selected_status := case
    when target_settings.auto_confirm_reservations then 'confirmed'::public.reservation_status
    else 'pending'::public.reservation_status
  end;

  insert into public.reservations (
    restaurant_id, customer_name, customer_phone, customer_email,
    reservation_date, reservation_time, party_size, duration_minutes,
    status, source, special_requests
  ) values (
    requested_restaurant_id, trim(requested_customer_name), trim(requested_customer_phone),
    nullif(trim(coalesce(requested_customer_email, '')), ''), requested_date,
    requested_time, requested_party_size, target_settings.reservation_duration_minutes,
    selected_status, 'public', nullif(trim(coalesce(requested_special_requests, '')), '')
  ) returning id, public_token into created_reservation_id, created_reservation_token;

  return query select created_reservation_id, created_reservation_token, selected_status;
end;
$$;

drop function if exists public.create_public_order(
  uuid, text, text, text, public.order_type, text, text, jsonb
);

create or replace function public.create_public_order(
  requested_restaurant_id uuid,
  requested_customer_name text,
  requested_customer_phone text,
  requested_customer_email text,
  requested_type public.order_type,
  requested_delivery_address text,
  requested_delivery_latitude numeric,
  requested_delivery_longitude numeric,
  requested_notes text,
  requested_items jsonb
)
returns table (
  order_id uuid,
  order_token uuid,
  order_subtotal numeric,
  order_delivery_fee numeric,
  order_total numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_restaurant public.restaurants%rowtype;
  minimum_amount numeric := 0;
  configured_delivery_fee numeric := 0;
  configured_fee_per_km numeric := 0;
  configured_radius numeric := 0;
  origin_latitude numeric;
  origin_longitude numeric;
  free_delivery_threshold numeric;
  preparation_minutes integer := 30;
  delivery_distance numeric;
  created_order_id uuid;
  created_order_token uuid;
  item_value jsonb;
  target_product record;
  target_variant record;
  group_value record;
  item_quantity integer;
  item_unit_price numeric;
  modifier_price numeric;
  selected_option_ids uuid[];
  modifier_entry_count integer;
  valid_option_count integer;
  group_option_count integer;
  has_variants boolean;
  variant_label text;
  modifiers_snapshot jsonb;
  calculated_subtotal numeric := 0;
  calculated_delivery_fee numeric := 0;
begin
  select * into target_restaurant
  from public.restaurants
  where id = requested_restaurant_id and status = 'active';

  if target_restaurant.id is null then raise exception 'Restaurante indisponível.'; end if;
  if requested_type = 'delivery' and not target_restaurant.accepts_delivery then raise exception 'Este restaurante não aceita entregas.'; end if;
  if requested_type = 'pickup' and not target_restaurant.accepts_pickup then raise exception 'Este restaurante não aceita levantamento.'; end if;
  if requested_type not in ('delivery', 'pickup') then raise exception 'Tipo de pedido inválido.'; end if;
  if length(trim(coalesce(requested_customer_name, ''))) < 2 then raise exception 'Informe o nome do cliente.'; end if;
  if length(trim(coalesce(requested_customer_phone, ''))) < 6 then raise exception 'Informe um telefone válido.'; end if;
  if requested_type = 'delivery' and length(trim(coalesce(requested_delivery_address, ''))) < 8 then raise exception 'Informe a morada de entrega.'; end if;
  if jsonb_typeof(requested_items) <> 'array' or jsonb_array_length(requested_items) = 0 or jsonb_array_length(requested_items) > 50 then raise exception 'O carrinho está vazio ou é inválido.'; end if;

  select
    coalesce(settings.minimum_order_amount, 0),
    coalesce(settings.default_delivery_fee, 0),
    coalesce(settings.delivery_fee_per_km, 0),
    coalesce(settings.delivery_radius_km, 0),
    settings.delivery_origin_latitude,
    settings.delivery_origin_longitude,
    settings.free_delivery_from,
    coalesce(settings.default_preparation_minutes, 30)
  into
    minimum_amount, configured_delivery_fee, configured_fee_per_km,
    configured_radius, origin_latitude, origin_longitude,
    free_delivery_threshold, preparation_minutes
  from public.restaurant_settings as settings
  where settings.restaurant_id = requested_restaurant_id;

  if requested_type = 'delivery' and origin_latitude is not null and origin_longitude is not null then
    if requested_delivery_latitude is null or requested_delivery_longitude is null then
      raise exception 'Autorize a localização da entrega para calcular a distância.';
    end if;
    if requested_delivery_latitude not between -90 and 90
      or requested_delivery_longitude not between -180 and 180 then
      raise exception 'A localização da entrega é inválida.';
    end if;

    delivery_distance := 6371 * 2 * asin(least(1, sqrt(
      power(sin(radians(requested_delivery_latitude - origin_latitude) / 2), 2)
      + cos(radians(origin_latitude)) * cos(radians(requested_delivery_latitude))
      * power(sin(radians(requested_delivery_longitude - origin_longitude) / 2), 2)
    )));

    if configured_radius > 0 and delivery_distance > configured_radius then
      raise exception 'A morada está fora do raio máximo de entrega de % km.', configured_radius;
    end if;
  elsif requested_type = 'delivery' and configured_fee_per_km > 0 then
    raise exception 'O restaurante ainda não configurou a localização de partida.';
  end if;

  insert into public.orders (
    restaurant_id, customer_name, customer_phone, customer_email, type,
    status, subtotal, delivery_fee, total, delivery_address,
    delivery_latitude, delivery_longitude, delivery_distance_km,
    notes, estimated_minutes
  ) values (
    requested_restaurant_id, trim(requested_customer_name), trim(requested_customer_phone),
    nullif(trim(coalesce(requested_customer_email, '')), ''), requested_type,
    'new', 0, 0, 0,
    case when requested_type = 'delivery' then trim(requested_delivery_address) else null end,
    case when requested_type = 'delivery' then requested_delivery_latitude else null end,
    case when requested_type = 'delivery' then requested_delivery_longitude else null end,
    case when requested_type = 'delivery' then delivery_distance else null end,
    nullif(trim(coalesce(requested_notes, '')), ''), preparation_minutes
  ) returning id, public_token into created_order_id, created_order_token;

  for item_value in select value from jsonb_array_elements(requested_items)
  loop
    item_quantity := coalesce((item_value->>'quantity')::integer, 0);
    if item_quantity < 1 or item_quantity > 99 then raise exception 'Quantidade inválida no carrinho.'; end if;

    select p.id, p.name, p.price into target_product
    from public.products as p
    where p.id = (item_value->>'productId')::uuid
      and p.restaurant_id = requested_restaurant_id
      and p.is_active and p.is_available;
    if target_product.id is null then raise exception 'Um produto do carrinho já não está disponível.'; end if;

    item_unit_price := target_product.price;
    variant_label := null;
    select exists (
      select 1 from public.product_variants as available_variant
      where available_variant.product_id = target_product.id
        and available_variant.is_active and available_variant.is_available
    ) into has_variants;

    if has_variants then
      if nullif(item_value->>'variantId', '') is null then raise exception 'Escolha uma variação para %.', target_product.name; end if;
      select v.id, v.name, v.price into target_variant
      from public.product_variants as v
      where v.id = (item_value->>'variantId')::uuid
        and v.product_id = target_product.id
        and v.is_active and v.is_available;
      if target_variant.id is null then raise exception 'A variação escolhida já não está disponível.'; end if;
      item_unit_price := target_variant.price;
      variant_label := target_variant.name;
    elsif nullif(item_value->>'variantId', '') is not null then
      raise exception 'A variação escolhida não pertence ao produto.';
    end if;

    if jsonb_typeof(coalesce(item_value->'modifiers', '[]'::jsonb)) <> 'array' then
      raise exception 'Os complementos enviados são inválidos.';
    end if;

    select coalesce(array_agg(distinct (modifier_entry.value->>'optionId')::uuid), '{}'::uuid[]), count(*)
    into selected_option_ids, modifier_entry_count
    from jsonb_array_elements(coalesce(item_value->'modifiers', '[]'::jsonb)) as modifier_entry(value);
    if modifier_entry_count <> cardinality(selected_option_ids) then raise exception 'Existem complementos duplicados no carrinho.'; end if;

    if exists (
      select 1 from jsonb_array_elements(coalesce(item_value->'modifiers', '[]'::jsonb)) as modifier_entry(value)
      where (modifier_entry.value->>'quantity')::integer < 1 or (modifier_entry.value->>'quantity')::integer > 99
    ) then raise exception 'A quantidade de um complemento é inválida.'; end if;

    select count(*), coalesce(sum(option_value.price_delta * (modifier_entry.value->>'quantity')::integer), 0),
      coalesce(jsonb_agg(jsonb_build_object(
        'group', modifier_group.name,
        'option', option_value.name,
        'priceDelta', option_value.price_delta,
        'quantity', (modifier_entry.value->>'quantity')::integer
      ) order by product_group.sort_order, option_value.sort_order), '[]'::jsonb)
    into valid_option_count, modifier_price, modifiers_snapshot
    from jsonb_array_elements(coalesce(item_value->'modifiers', '[]'::jsonb)) as modifier_entry(value)
    join public.modifier_options as option_value
      on option_value.id = (modifier_entry.value->>'optionId')::uuid
      and option_value.is_active
      and (modifier_entry.value->>'quantity')::integer <= option_value.max_quantity
    join public.modifier_groups as modifier_group
      on modifier_group.id = option_value.modifier_group_id and modifier_group.is_active
    join public.product_modifier_groups as product_group
      on product_group.modifier_group_id = modifier_group.id and product_group.product_id = target_product.id;

    if valid_option_count <> modifier_entry_count then raise exception 'Um complemento ou a sua quantidade já não está disponível.'; end if;
    item_unit_price := item_unit_price + coalesce(modifier_price, 0);

    for group_value in
      select modifier_group.id, modifier_group.name, modifier_group.min_selections, modifier_group.max_selections
      from public.product_modifier_groups as product_group
      join public.modifier_groups as modifier_group on modifier_group.id = product_group.modifier_group_id
      where product_group.product_id = target_product.id and modifier_group.is_active
    loop
      select coalesce(sum((modifier_entry.value->>'quantity')::integer), 0) into group_option_count
      from jsonb_array_elements(coalesce(item_value->'modifiers', '[]'::jsonb)) as modifier_entry(value)
      join public.modifier_options as option_value on option_value.id = (modifier_entry.value->>'optionId')::uuid
      where option_value.modifier_group_id = group_value.id and option_value.is_active;
      if group_option_count < group_value.min_selections or group_option_count > group_value.max_selections then
        raise exception 'Revise as quantidades do grupo %.', group_value.name;
      end if;
    end loop;

    insert into public.order_items (
      order_id, product_id, product_name, variant_name, selected_modifiers,
      quantity, unit_price, notes
    ) values (
      created_order_id, target_product.id, target_product.name, variant_label,
      modifiers_snapshot, item_quantity, item_unit_price,
      nullif(trim(coalesce(item_value->>'notes', '')), '')
    );
    calculated_subtotal := calculated_subtotal + (item_unit_price * item_quantity);
  end loop;

  if calculated_subtotal < minimum_amount then raise exception 'O pedido mínimo é de %.', minimum_amount; end if;
  if requested_type = 'delivery'
    and (free_delivery_threshold is null or calculated_subtotal < free_delivery_threshold) then
    calculated_delivery_fee := round(
      configured_delivery_fee + coalesce(delivery_distance, 0) * configured_fee_per_km,
      2
    );
  end if;

  update public.orders
  set subtotal = calculated_subtotal,
      delivery_fee = calculated_delivery_fee,
      total = calculated_subtotal + calculated_delivery_fee
  where id = created_order_id;

  return query select created_order_id, created_order_token, calculated_subtotal,
    calculated_delivery_fee, calculated_subtotal + calculated_delivery_fee;
end;
$$;

revoke all on function public.create_public_order(
  uuid, text, text, text, public.order_type, text, numeric, numeric, text, jsonb
) from public;
grant execute on function public.create_public_order(
  uuid, text, text, text, public.order_type, text, numeric, numeric, text, jsonb
) to anon, authenticated;

create or replace function public.get_public_checkout_settings(requested_restaurant_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'minimumOrderAmount', coalesce(settings.minimum_order_amount, 0),
    'defaultDeliveryFee', coalesce(settings.default_delivery_fee, 0),
    'deliveryFeePerKm', coalesce(settings.delivery_fee_per_km, 0),
    'deliveryRadiusKm', coalesce(settings.delivery_radius_km, 0),
    'deliveryOriginLatitude', settings.delivery_origin_latitude,
    'deliveryOriginLongitude', settings.delivery_origin_longitude,
    'freeDeliveryFrom', settings.free_delivery_from,
    'defaultPreparationMinutes', coalesce(settings.default_preparation_minutes, 30)
  )
  from public.restaurants as restaurant
  left join public.restaurant_settings as settings on settings.restaurant_id = restaurant.id
  where restaurant.id = requested_restaurant_id and restaurant.status = 'active';
$$;

-- Leva a distância já validada pelo checkout para a entrega oferecida ao estafeta.
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
    restaurant_id, order_id, status, delivery_address, delivery_fee,
    distance_km, driver_id, offered_driver_id, offer_started_at,
    offer_expires_at, accepted_at, picked_up_at, delivered_at, cancelled_at
  ) values (
    new.restaurant_id, new.id, 'searching_driver',
    coalesce(new.delivery_address, 'Morada não informada'), new.delivery_fee,
    new.delivery_distance_km, null, null, null, null, null, null, null, null
  )
  on conflict (order_id)
  do update set
    status = 'searching_driver',
    delivery_address = excluded.delivery_address,
    delivery_fee = excluded.delivery_fee,
    distance_km = excluded.distance_km,
    driver_id = null,
    offered_driver_id = null,
    offer_started_at = null,
    offer_expires_at = null,
    accepted_at = null,
    picked_up_at = null,
    delivered_at = null,
    cancelled_at = null
  returning id into new_delivery_id;

  update public.orders set status = 'awaiting_driver' where id = new.id;
  perform public.dispatch_next_driver(new_delivery_id);
  return new;
end;
$$;

create or replace function public.create_delivery_for_order(requested_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_order public.orders;
  new_delivery_id uuid;
begin
  select * into requested_order from public.orders where id = requested_order_id;
  if requested_order.id is null then raise exception 'Pedido não encontrado'; end if;
  if not (public.is_restaurant_member(requested_order.restaurant_id) or public.is_super_admin()) then
    raise exception 'Sem permissão para criar esta entrega';
  end if;
  if requested_order.type <> 'delivery' then raise exception 'Este pedido não é uma entrega'; end if;
  if requested_order.status <> 'ready' then raise exception 'O pedido precisa estar pronto'; end if;

  insert into public.deliveries (
    restaurant_id, order_id, status, delivery_address, delivery_fee, distance_km
  ) values (
    requested_order.restaurant_id, requested_order.id, 'searching_driver',
    coalesce(requested_order.delivery_address, 'Morada não informada'),
    requested_order.delivery_fee, requested_order.delivery_distance_km
  )
  on conflict (order_id)
  do update set
    status = 'searching_driver',
    delivery_address = excluded.delivery_address,
    delivery_fee = excluded.delivery_fee,
    distance_km = excluded.distance_km,
    driver_id = null,
    offered_driver_id = null,
    offer_started_at = null,
    offer_expires_at = null,
    accepted_at = null,
    picked_up_at = null,
    delivered_at = null,
    cancelled_at = null
  returning id into new_delivery_id;

  update public.orders set status = 'awaiting_driver' where id = requested_order.id;
  perform public.dispatch_next_driver(new_delivery_id);
  return new_delivery_id;
end;
$$;
