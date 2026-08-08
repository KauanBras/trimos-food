alter table public.modifier_options
  add column max_quantity integer not null default 1
  check (max_quantity between 1 and 99);

update public.modifier_options as option_value
set max_quantity = least(modifier_group.max_selections, 99)
from public.modifier_groups as modifier_group
where modifier_group.id = option_value.modifier_group_id
  and modifier_group.max_selections > 1;

create or replace function public.create_public_order(
  requested_restaurant_id uuid,
  requested_customer_name text,
  requested_customer_phone text,
  requested_customer_email text,
  requested_type public.order_type,
  requested_delivery_address text,
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
  free_delivery_threshold numeric;
  preparation_minutes integer := 30;
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

  select coalesce(settings.minimum_order_amount, 0), coalesce(settings.default_delivery_fee, 0),
    settings.free_delivery_from, coalesce(settings.default_preparation_minutes, 30)
  into minimum_amount, configured_delivery_fee, free_delivery_threshold, preparation_minutes
  from (select 1) as seed
  left join public.restaurant_settings as settings on settings.restaurant_id = requested_restaurant_id;

  insert into public.orders (
    restaurant_id, customer_name, customer_phone, customer_email, type,
    status, subtotal, delivery_fee, total, delivery_address, notes, estimated_minutes
  ) values (
    requested_restaurant_id, trim(requested_customer_name), trim(requested_customer_phone),
    nullif(trim(coalesce(requested_customer_email, '')), ''), requested_type,
    'new', 0, 0, 0,
    case when requested_type = 'delivery' then trim(requested_delivery_address) else null end,
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
  if requested_type = 'delivery' and (free_delivery_threshold is null or calculated_subtotal < free_delivery_threshold) then calculated_delivery_fee := configured_delivery_fee; end if;

  update public.orders set subtotal = calculated_subtotal, delivery_fee = calculated_delivery_fee,
    total = calculated_subtotal + calculated_delivery_fee
  where id = created_order_id;

  return query select created_order_id, created_order_token, calculated_subtotal,
    calculated_delivery_fee, calculated_subtotal + calculated_delivery_fee;
end;
$$;
