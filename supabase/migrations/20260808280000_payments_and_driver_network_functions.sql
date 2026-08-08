-- Funções transacionais para pagamentos, rede partilhada e acertos.

create or replace function public.accept_driver_invite(requested_token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text;
  selected_invite public.driver_invites;
  selected_driver_id uuid;
begin
  if current_user_id is null then raise exception 'É necessário iniciar sessão'; end if;

  select email into current_email from auth.users where id = current_user_id;
  select * into selected_invite
  from public.driver_invites where token = requested_token for update;

  if selected_invite.id is null then raise exception 'Convite não encontrado'; end if;
  if selected_invite.accepted_at is not null then raise exception 'Este convite já foi utilizado'; end if;
  if selected_invite.expires_at <= now() then raise exception 'Este convite expirou'; end if;
  if lower(selected_invite.email) <> lower(current_email) then
    raise exception 'Este convite pertence a outro endereço de e-mail';
  end if;

  select id into selected_driver_id
  from public.drivers
  where user_id = current_user_id
  order by created_at
  limit 1;

  if selected_driver_id is null then
    insert into public.drivers (restaurant_id, user_id, status, is_active)
    values (selected_invite.restaurant_id, current_user_id, 'available', true)
    returning id into selected_driver_id;
  else
    update public.drivers
    set is_active = true,
        status = case when status = 'suspended' then 'offline' else status end,
        updated_at = now()
    where id = selected_driver_id;
  end if;

  insert into public.restaurant_drivers (
    restaurant_id, driver_id, is_active, is_preferred, added_by
  ) values (
    selected_invite.restaurant_id, selected_driver_id, true, true, selected_invite.created_by
  )
  on conflict (restaurant_id, driver_id)
  do update set is_active = true, is_preferred = true, updated_at = now();

  update public.driver_invites
  set accepted_at = now(), accepted_by = current_user_id
  where id = selected_invite.id;

  return selected_driver_id;
end;
$$;

grant execute on function public.accept_driver_invite(uuid) to authenticated;

create or replace function public.calculate_driver_fee(
  requested_restaurant_id uuid,
  requested_distance_km numeric,
  requested_delivery_fee numeric
)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select round(
    case
      when settings.driver_fee_base is null
        or settings.driver_fee_per_km is null
      then greatest(coalesce(requested_delivery_fee, 0), 0)
      else greatest(settings.driver_fee_base, 0)
        + greatest(coalesce(requested_distance_km, 0), 0)
        * greatest(settings.driver_fee_per_km, 0)
    end,
    2
  )
  from public.restaurant_settings as settings
  where settings.restaurant_id = requested_restaurant_id;
$$;

revoke all on function public.calculate_driver_fee(uuid, numeric, numeric) from public;

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
      case when private_link.driver_id is not null
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
      and private_link.is_active
    where driver.status = 'available'
      and driver.is_active
      and (
        (settings.driver_pool_mode in ('private', 'hybrid') and private_link.driver_id is not null)
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

drop function if exists public.create_public_order(
  uuid, text, text, text, public.order_type, text, numeric, numeric, text, jsonb
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
  requested_items jsonb,
  requested_payment_method public.payment_method,
  requested_cash_tendered_amount numeric
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
  cash_enabled boolean := true;
  terminal_enabled boolean := true;
  mb_way_enabled boolean := false;
  stripe_ready boolean := false;
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
  calculated_total numeric := 0;
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
    coalesce(settings.default_preparation_minutes, 30),
    settings.accepts_cash,
    settings.accepts_terminal,
    settings.accepts_mb_way,
    settings.stripe_charges_enabled and settings.stripe_details_submitted
      and settings.stripe_account_id is not null
  into
    minimum_amount, configured_delivery_fee, configured_fee_per_km,
    configured_radius, origin_latitude, origin_longitude,
    free_delivery_threshold, preparation_minutes,
    cash_enabled, terminal_enabled, mb_way_enabled, stripe_ready
  from public.restaurant_settings as settings
  where settings.restaurant_id = requested_restaurant_id;

  if requested_payment_method = 'cash' and not cash_enabled then raise exception 'O restaurante não aceita dinheiro.'; end if;
  if requested_payment_method = 'terminal' and not terminal_enabled then raise exception 'O restaurante não disponibiliza terminal.'; end if;
  if requested_payment_method = 'mb_way' and not (mb_way_enabled and stripe_ready) then raise exception 'O MB WAY ainda não está disponível.'; end if;

  if requested_type = 'delivery' and origin_latitude is not null and origin_longitude is not null then
    if requested_delivery_latitude is null or requested_delivery_longitude is null then raise exception 'Autorize a localização da entrega para calcular a distância.'; end if;
    if requested_delivery_latitude not between -90 and 90 or requested_delivery_longitude not between -180 and 180 then raise exception 'A localização da entrega é inválida.'; end if;
    delivery_distance := 6371 * 2 * asin(least(1, sqrt(
      power(sin(radians(requested_delivery_latitude - origin_latitude) / 2), 2)
      + cos(radians(origin_latitude)) * cos(radians(requested_delivery_latitude))
      * power(sin(radians(requested_delivery_longitude - origin_longitude) / 2), 2)
    )));
    if configured_radius > 0 and delivery_distance > configured_radius then raise exception 'A morada está fora do raio máximo de entrega de % km.', configured_radius; end if;
  elsif requested_type = 'delivery' and configured_fee_per_km > 0 then
    raise exception 'O restaurante ainda não configurou a localização de partida.';
  end if;

  insert into public.orders (
    restaurant_id, customer_name, customer_phone, customer_email, type,
    status, subtotal, delivery_fee, total, delivery_address,
    delivery_latitude, delivery_longitude, delivery_distance_km,
    notes, estimated_minutes, payment_method, payment_status,
    cash_tendered_amount, payment_provider
  ) values (
    requested_restaurant_id, trim(requested_customer_name), trim(requested_customer_phone),
    nullif(trim(coalesce(requested_customer_email, '')), ''), requested_type,
    case when requested_payment_method = 'mb_way'
      then 'pending_payment'::public.order_status else 'new'::public.order_status end,
    0, 0, 0,
    case when requested_type = 'delivery' then trim(requested_delivery_address) else null end,
    case when requested_type = 'delivery' then requested_delivery_latitude else null end,
    case when requested_type = 'delivery' then requested_delivery_longitude else null end,
    case when requested_type = 'delivery' then delivery_distance else null end,
    nullif(trim(coalesce(requested_notes, '')), ''), preparation_minutes,
    requested_payment_method,
    case when requested_payment_method = 'mb_way'
      then 'pending'::public.payment_status else 'awaiting_collection'::public.payment_status end,
    case when requested_payment_method = 'cash' then requested_cash_tendered_amount else null end,
    case when requested_payment_method = 'mb_way' then 'stripe' else null end
  ) returning id, public_token into created_order_id, created_order_token;

  for item_value in select value from jsonb_array_elements(requested_items)
  loop
    item_quantity := coalesce((item_value->>'quantity')::integer, 0);
    if item_quantity < 1 or item_quantity > 99 then raise exception 'Quantidade inválida no carrinho.'; end if;
    select p.id, p.name, p.price into target_product
    from public.products as p
    where p.id = (item_value->>'productId')::uuid
      and p.restaurant_id = requested_restaurant_id and p.is_active and p.is_available;
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
      where v.id = (item_value->>'variantId')::uuid and v.product_id = target_product.id
        and v.is_active and v.is_available;
      if target_variant.id is null then raise exception 'A variação escolhida já não está disponível.'; end if;
      item_unit_price := target_variant.price;
      variant_label := target_variant.name;
    elsif nullif(item_value->>'variantId', '') is not null then
      raise exception 'A variação escolhida não pertence ao produto.';
    end if;

    if jsonb_typeof(coalesce(item_value->'modifiers', '[]'::jsonb)) <> 'array' then raise exception 'Os complementos enviados são inválidos.'; end if;
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
        'group', modifier_group.name, 'option', option_value.name,
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
      if group_option_count < group_value.min_selections or group_option_count > group_value.max_selections then raise exception 'Revise as quantidades do grupo %.', group_value.name; end if;
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
  if requested_type = 'delivery' and (free_delivery_threshold is null or calculated_subtotal < free_delivery_threshold) then
    calculated_delivery_fee := round(configured_delivery_fee + coalesce(delivery_distance, 0) * configured_fee_per_km, 2);
  end if;
  calculated_total := calculated_subtotal + calculated_delivery_fee;
  if requested_payment_method = 'cash'
    and requested_cash_tendered_amount is not null
    and requested_cash_tendered_amount < calculated_total then
    raise exception 'O valor indicado para troco é inferior ao total do pedido.';
  end if;

  update public.orders
  set subtotal = calculated_subtotal, delivery_fee = calculated_delivery_fee,
      total = calculated_total
  where id = created_order_id;

  return query select created_order_id, created_order_token,
    calculated_subtotal, calculated_delivery_fee, calculated_total;
end;
$$;

revoke all on function public.create_public_order(
  uuid, text, text, text, public.order_type, text, numeric, numeric,
  text, jsonb, public.payment_method, numeric
) from public;
grant execute on function public.create_public_order(
  uuid, text, text, text, public.order_type, text, numeric, numeric,
  text, jsonb, public.payment_method, numeric
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
    'defaultPreparationMinutes', coalesce(settings.default_preparation_minutes, 30),
    'acceptsCash', settings.accepts_cash,
    'acceptsTerminal', settings.accepts_terminal,
    'acceptsMbWay', settings.accepts_mb_way
      and settings.stripe_charges_enabled
      and settings.stripe_details_submitted
      and settings.stripe_account_id is not null
  )
  from public.restaurants as restaurant
  left join public.restaurant_settings as settings on settings.restaurant_id = restaurant.id
  where restaurant.id = requested_restaurant_id and restaurant.status = 'active';
$$;

create or replace function public.get_public_order_status(
  requested_order_id uuid,
  requested_order_token uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', target_order.id,
    'customerName', target_order.customer_name,
    'status', target_order.status,
    'type', target_order.type,
    'subtotal', target_order.subtotal,
    'deliveryFee', target_order.delivery_fee,
    'total', target_order.total,
    'estimatedMinutes', target_order.estimated_minutes,
    'paymentMethod', target_order.payment_method,
    'paymentStatus', target_order.payment_status,
    'cashTenderedAmount', target_order.cash_tendered_amount,
    'createdAt', target_order.created_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'productName', item.product_name,
        'variantName', item.variant_name,
        'modifiers', item.selected_modifiers,
        'quantity', item.quantity,
        'unitPrice', item.unit_price,
        'notes', item.notes
      ) order by item.created_at)
      from public.order_items as item where item.order_id = target_order.id
    ), '[]'::jsonb)
  )
  from public.orders as target_order
  where target_order.id = requested_order_id
    and target_order.public_token = requested_order_token;
$$;

create or replace function public.get_stripe_checkout_order(
  requested_order_id uuid,
  requested_order_token uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'orderId', target_order.id,
    'restaurantId', target_order.restaurant_id,
    'restaurantName', restaurant.name,
    'restaurantSlug', restaurant.slug,
    'currencyCode', restaurant.currency_code,
    'total', target_order.total,
    'status', target_order.status,
    'paymentStatus', target_order.payment_status,
    'paymentMethod', target_order.payment_method,
    'stripeAccountId', settings.stripe_account_id,
    'stripeReady', settings.accepts_mb_way
      and settings.stripe_charges_enabled
      and settings.stripe_details_submitted
      and settings.stripe_account_id is not null
  )
  from public.orders as target_order
  join public.restaurants as restaurant on restaurant.id = target_order.restaurant_id
  join public.restaurant_settings as settings on settings.restaurant_id = target_order.restaurant_id
  where target_order.id = requested_order_id
    and target_order.public_token = requested_order_token
    and target_order.payment_method = 'mb_way'
    and target_order.status = 'pending_payment'
    and target_order.payment_status in ('pending', 'failed');
$$;

create or replace function public.attach_stripe_checkout_session(
  requested_order_id uuid,
  requested_order_token uuid,
  requested_session_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.orders
  set provider_checkout_session_id = requested_session_id,
      payment_status = 'pending',
      payment_failure_reason = null
  where id = requested_order_id
    and public_token = requested_order_token
    and payment_method = 'mb_way'
    and status = 'pending_payment'
    and payment_status in ('pending', 'failed');
  return found;
end;
$$;

revoke all on function public.get_stripe_checkout_order(uuid, uuid) from public;
grant execute on function public.get_stripe_checkout_order(uuid, uuid) to anon, authenticated;
revoke all on function public.attach_stripe_checkout_session(uuid, uuid, text) from public;
grant execute on function public.attach_stripe_checkout_session(uuid, uuid, text) to anon, authenticated;

create or replace function public.record_stripe_payment(
  requested_session_id text,
  requested_payment_id text,
  requested_account_id text,
  requested_succeeded boolean,
  requested_failure_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_order_id uuid;
begin
  select target_order.id into selected_order_id
  from public.orders as target_order
  join public.restaurant_settings as settings
    on settings.restaurant_id = target_order.restaurant_id
  where target_order.provider_checkout_session_id = requested_session_id
    and settings.stripe_account_id = requested_account_id
    and target_order.payment_method = 'mb_way'
  for update of target_order;

  if selected_order_id is null then raise exception 'Pagamento não corresponde a um pedido.'; end if;

  update public.orders
  set payment_status = case when requested_succeeded then 'paid'::public.payment_status else 'failed'::public.payment_status end,
      status = case when requested_succeeded then 'new'::public.order_status else status end,
      provider_payment_id = nullif(requested_payment_id, ''),
      payment_failure_reason = case when requested_succeeded then null else nullif(requested_failure_reason, '') end,
      paid_at = case when requested_succeeded then coalesce(paid_at, now()) else paid_at end
  where id = selected_order_id;

  return selected_order_id;
end;
$$;

revoke all on function public.record_stripe_payment(text, text, text, boolean, text) from public, anon, authenticated;
grant execute on function public.record_stripe_payment(text, text, text, boolean, text) to service_role;

create or replace function public.dispatch_ready_delivery_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_delivery_id uuid;
  calculated_driver_fee numeric;
begin
  if new.type <> 'delivery' or new.status <> 'ready' or old.status is not distinct from new.status then return new; end if;
  calculated_driver_fee := coalesce(public.calculate_driver_fee(new.restaurant_id, new.delivery_distance_km, new.delivery_fee), new.delivery_fee);

  insert into public.deliveries (
    restaurant_id, order_id, status, delivery_address, delivery_fee,
    distance_km, driver_fee, driver_id, offered_driver_id, offer_started_at,
    offer_expires_at, accepted_at, picked_up_at, delivered_at, cancelled_at
  ) values (
    new.restaurant_id, new.id, 'searching_driver',
    coalesce(new.delivery_address, 'Morada não informada'), new.delivery_fee,
    new.delivery_distance_km, calculated_driver_fee,
    null, null, null, null, null, null, null, null
  )
  on conflict (order_id)
  do update set
    status = 'searching_driver', delivery_address = excluded.delivery_address,
    delivery_fee = excluded.delivery_fee, distance_km = excluded.distance_km,
    driver_fee = excluded.driver_fee, driver_id = null, offered_driver_id = null,
    assignment_source = null, offer_started_at = null, offer_expires_at = null,
    accepted_at = null, picked_up_at = null, delivered_at = null, cancelled_at = null
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
  calculated_driver_fee numeric;
begin
  select * into requested_order from public.orders where id = requested_order_id;
  if requested_order.id is null then raise exception 'Pedido não encontrado'; end if;
  if not (public.is_restaurant_member(requested_order.restaurant_id) or public.is_super_admin()) then raise exception 'Sem permissão para criar esta entrega'; end if;
  if requested_order.type <> 'delivery' then raise exception 'Este pedido não é uma entrega'; end if;
  if requested_order.status <> 'ready' then raise exception 'O pedido precisa estar pronto'; end if;
  calculated_driver_fee := coalesce(public.calculate_driver_fee(requested_order.restaurant_id, requested_order.delivery_distance_km, requested_order.delivery_fee), requested_order.delivery_fee);

  insert into public.deliveries (
    restaurant_id, order_id, status, delivery_address, delivery_fee, distance_km, driver_fee
  ) values (
    requested_order.restaurant_id, requested_order.id, 'searching_driver',
    coalesce(requested_order.delivery_address, 'Morada não informada'),
    requested_order.delivery_fee, requested_order.delivery_distance_km, calculated_driver_fee
  )
  on conflict (order_id)
  do update set
    status = 'searching_driver', delivery_address = excluded.delivery_address,
    delivery_fee = excluded.delivery_fee, distance_km = excluded.distance_km,
    driver_fee = excluded.driver_fee, driver_id = null, offered_driver_id = null,
    assignment_source = null, offer_started_at = null, offer_expires_at = null,
    accepted_at = null, picked_up_at = null, delivered_at = null, cancelled_at = null
  returning id into new_delivery_id;

  update public.orders set status = 'awaiting_driver' where id = requested_order.id;
  perform public.dispatch_next_driver(new_delivery_id);
  return new_delivery_id;
end;
$$;

create or replace function public.confirm_delivery_payment(requested_delivery_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_driver public.drivers;
  selected_delivery public.deliveries;
  selected_order public.orders;
begin
  select * into current_driver from public.drivers
  where user_id = auth.uid() and is_active order by created_at limit 1;
  select * into selected_delivery from public.deliveries where id = requested_delivery_id for update;
  if current_driver.id is null or selected_delivery.driver_id is distinct from current_driver.id then raise exception 'Esta entrega não pertence ao estafeta'; end if;
  select * into selected_order from public.orders where id = selected_delivery.order_id for update;
  if selected_order.payment_method = 'mb_way' then
    if selected_order.payment_status <> 'paid' then raise exception 'O pagamento MB WAY ainda não foi confirmado'; end if;
    return;
  end if;
  if selected_order.payment_method not in ('cash', 'terminal') then raise exception 'Método de pagamento inválido'; end if;
  update public.orders set payment_status = 'paid', paid_at = coalesce(paid_at, now()) where id = selected_order.id;
end;
$$;

grant execute on function public.confirm_delivery_payment(uuid) to authenticated;

create or replace function public.complete_delivery(requested_delivery_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_driver public.drivers;
  selected_delivery public.deliveries;
  selected_order public.orders;
begin
  select * into current_driver from public.drivers
  where user_id = auth.uid() and is_active order by created_at limit 1;
  select * into selected_delivery from public.deliveries where id = requested_delivery_id for update;
  if selected_delivery.driver_id is distinct from current_driver.id then raise exception 'Esta entrega não pertence ao estafeta'; end if;
  if selected_delivery.status <> 'picked_up' then raise exception 'A entrega ainda não foi recolhida'; end if;
  select * into selected_order from public.orders where id = selected_delivery.order_id for update;
  if selected_order.payment_status <> 'paid' then raise exception 'Confirme o recebimento antes de concluir a entrega'; end if;

  update public.deliveries set status = 'delivered', delivered_at = now() where id = selected_delivery.id;
  update public.orders set status = 'completed', completed_at = now() where id = selected_order.id;
  update public.drivers set status = 'available' where id = current_driver.id;
end;
$$;

grant execute on function public.complete_delivery(uuid) to authenticated;

create or replace function public.create_driver_earning_on_delivery()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_order public.orders;
  collected numeric := 0;
begin
  if new.status <> 'delivered' or new.driver_id is null
    or (tg_op = 'UPDATE' and old.status = 'delivered') then return new; end if;
  select * into target_order from public.orders where id = new.order_id;
  if target_order.payment_method = 'cash' then collected := target_order.total; end if;

  insert into public.driver_earnings (
    restaurant_id, driver_id, delivery_id, order_id, payment_method,
    order_total, driver_fee, cash_collected, net_balance
  ) values (
    new.restaurant_id, new.driver_id, new.id, new.order_id, target_order.payment_method,
    target_order.total, new.driver_fee, collected, new.driver_fee - collected
  )
  on conflict (delivery_id) do nothing;
  return new;
end;
$$;

drop trigger if exists deliveries_create_driver_earning on public.deliveries;
create trigger deliveries_create_driver_earning
after insert or update of status on public.deliveries
for each row execute function public.create_driver_earning_on_delivery();

create or replace function public.settle_driver_earnings(
  requested_restaurant_id uuid,
  requested_earning_ids uuid[],
  requested_reference text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_count integer;
begin
  if not (
    public.has_restaurant_role(requested_restaurant_id, array['owner','admin','manager']::public.restaurant_role[])
    or public.is_super_admin()
  ) then raise exception 'Sem permissão para liquidar estes valores'; end if;
  if cardinality(requested_earning_ids) = 0 then raise exception 'Selecione pelo menos um valor'; end if;

  update public.driver_earnings
  set status = 'settled', settled_at = now(), settled_by = auth.uid(),
      settlement_reference = nullif(trim(coalesce(requested_reference, '')), '')
  where restaurant_id = requested_restaurant_id
    and id = any(requested_earning_ids)
    and status = 'pending';
  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

grant execute on function public.settle_driver_earnings(uuid, uuid[], text) to authenticated;

drop policy if exists deliveries_restaurant_read on public.deliveries;
create policy deliveries_restaurant_read
on public.deliveries for select to authenticated
using (
  public.is_restaurant_member(restaurant_id)
  or exists (
    select 1 from public.drivers
    where drivers.user_id = auth.uid() and drivers.is_active
      and (deliveries.offered_driver_id = drivers.id or deliveries.driver_id = drivers.id)
  )
  or public.is_super_admin()
);

drop policy if exists orders_driver_read_assigned on public.orders;
create policy orders_driver_read_assigned
on public.orders for select to authenticated
using (
  exists (
    select 1
    from public.drivers
    join public.deliveries
      on deliveries.offered_driver_id = drivers.id or deliveries.driver_id = drivers.id
    where drivers.user_id = auth.uid()
      and drivers.is_active
      and deliveries.order_id = orders.id
  )
);

drop policy if exists drivers_member_read on public.drivers;
create policy drivers_member_read
on public.drivers for select to authenticated
using (
  user_id = auth.uid()
  or public.is_restaurant_member(restaurant_id)
  or exists (
    select 1 from public.restaurant_drivers
    where restaurant_drivers.driver_id = drivers.id
      and public.is_restaurant_member(restaurant_drivers.restaurant_id)
  )
  or exists (
    select 1 from public.deliveries
    where deliveries.restaurant_id in (
      select restaurant_users.restaurant_id from public.restaurant_users
      where restaurant_users.user_id = auth.uid() and restaurant_users.is_active
    )
      and (deliveries.offered_driver_id = drivers.id or deliveries.driver_id = drivers.id)
  )
  or public.is_super_admin()
);
