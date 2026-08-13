-- Cria uma cópia de apresentação da Hirotatsu sem transportar dados reais.
-- A operação original permanece em /r/hirotatsu-sushi.

create temporary table trimos_demo_category_map (
  old_id uuid primary key,
  new_id uuid not null unique
) on commit drop;

create temporary table trimos_demo_product_map (
  old_id uuid primary key,
  new_id uuid not null unique
) on commit drop;

create temporary table trimos_demo_group_map (
  old_id uuid primary key,
  new_id uuid not null unique
) on commit drop;

do $$
declare
  source_restaurant public.restaurants%rowtype;
  demo_restaurant_id uuid := gen_random_uuid();
  source_subscription public.restaurant_subscriptions%rowtype;
begin
  if exists (
    select 1 from public.restaurants where slug = 'hirotatsu-sushi-demo'
  ) then
    return;
  end if;

  select * into source_restaurant
  from public.restaurants
  where slug = 'hirotatsu-sushi'
  limit 1;

  if source_restaurant.id is null then
    raise exception 'Restaurante Hirotatsu de origem não encontrado.';
  end if;

  insert into public.restaurants
  select (jsonb_populate_record(
    null::public.restaurants,
    to_jsonb(source_restaurant) || jsonb_build_object(
      'id', demo_restaurant_id,
      'name', 'Hirotatsu Sushi — Demonstração',
      'slug', 'hirotatsu-sushi-demo',
      'email', null,
      'tax_number', null,
      'is_demo', true,
      'demo_locked', false,
      'demo_last_reset_at', now(),
      'created_at', now(),
      'updated_at', now()
    )
  )).*;

  insert into public.restaurant_users (restaurant_id, user_id, role, is_active)
  select demo_restaurant_id, user_id, role, is_active
  from public.restaurant_users
  where restaurant_id = source_restaurant.id
  on conflict (restaurant_id, user_id) do nothing;

  delete from public.business_hours
  where restaurant_id = demo_restaurant_id;

  insert into public.restaurant_settings
  select (jsonb_populate_record(
    null::public.restaurant_settings,
    to_jsonb(source_settings) || jsonb_build_object(
      'restaurant_id', demo_restaurant_id,
      'accepts_mb_way', false,
      'stripe_account_id', null,
      'stripe_charges_enabled', false,
      'stripe_payouts_enabled', false,
      'stripe_details_submitted', false,
      'stripe_mb_way_enabled', false,
      'stripe_connected_at', null,
      'created_at', now(),
      'updated_at', now()
    )
  )).*
  from public.restaurant_settings as source_settings
  where source_settings.restaurant_id = source_restaurant.id
  on conflict (restaurant_id) do update set
    primary_color = excluded.primary_color,
    secondary_color = excluded.secondary_color,
    delivery_radius_km = excluded.delivery_radius_km,
    minimum_order_amount = excluded.minimum_order_amount,
    default_delivery_fee = excluded.default_delivery_fee,
    free_delivery_from = excluded.free_delivery_from,
    default_preparation_minutes = excluded.default_preparation_minutes,
    order_sound_enabled = excluded.order_sound_enabled,
    auto_accept_orders = excluded.auto_accept_orders,
    delivery_fee_per_km = excluded.delivery_fee_per_km,
    delivery_origin_latitude = excluded.delivery_origin_latitude,
    delivery_origin_longitude = excluded.delivery_origin_longitude,
    auto_confirm_reservations = excluded.auto_confirm_reservations,
    reservation_capacity = excluded.reservation_capacity,
    reservation_slot_minutes = excluded.reservation_slot_minutes,
    reservation_duration_minutes = excluded.reservation_duration_minutes,
    reservation_advance_days = excluded.reservation_advance_days,
    accepts_cash = excluded.accepts_cash,
    accepts_terminal = excluded.accepts_terminal,
    accepts_mb_way = false,
    driver_pool_mode = excluded.driver_pool_mode,
    driver_fee_base = excluded.driver_fee_base,
    driver_fee_per_km = excluded.driver_fee_per_km,
    reservation_discount_enabled = excluded.reservation_discount_enabled,
    reservation_discount_percent = excluded.reservation_discount_percent,
    reservation_discount_description = excluded.reservation_discount_description,
    reservation_discount_starts_on = excluded.reservation_discount_starts_on,
    reservation_discount_ends_on = excluded.reservation_discount_ends_on,
    reservation_discount_days = excluded.reservation_discount_days,
    reservation_discount_start_time = excluded.reservation_discount_start_time,
    reservation_discount_end_time = excluded.reservation_discount_end_time,
    stripe_account_id = null,
    stripe_charges_enabled = false,
    stripe_payouts_enabled = false,
    stripe_details_submitted = false,
    stripe_mb_way_enabled = false,
    stripe_connected_at = null,
    receipt_printer_enabled = excluded.receipt_printer_enabled,
    receipt_paper_width = excluded.receipt_paper_width,
    receipt_print_copies = excluded.receipt_print_copies,
    auto_print_orders = excluded.auto_print_orders,
    updated_at = now();

  insert into public.business_hours
  select (jsonb_populate_record(
    null::public.business_hours,
    to_jsonb(source_hours) || jsonb_build_object(
      'id', gen_random_uuid(),
      'restaurant_id', demo_restaurant_id,
      'created_at', now(),
      'updated_at', now()
    )
  )).*
  from public.business_hours as source_hours
  where source_hours.restaurant_id = source_restaurant.id;

  insert into trimos_demo_category_map (old_id, new_id)
  select id, gen_random_uuid()
  from public.categories
  where restaurant_id = source_restaurant.id;

  insert into public.categories
  select (jsonb_populate_record(
    null::public.categories,
    to_jsonb(source_category) || jsonb_build_object(
      'id', category_map.new_id,
      'restaurant_id', demo_restaurant_id,
      'created_at', now(),
      'updated_at', now()
    )
  )).*
  from public.categories as source_category
  join trimos_demo_category_map as category_map
    on category_map.old_id = source_category.id;

  insert into trimos_demo_product_map (old_id, new_id)
  select id, gen_random_uuid()
  from public.products
  where restaurant_id = source_restaurant.id;

  insert into public.products
  select (jsonb_populate_record(
    null::public.products,
    to_jsonb(source_product) || jsonb_build_object(
      'id', product_map.new_id,
      'restaurant_id', demo_restaurant_id,
      'category_id', category_map.new_id,
      'created_at', now(),
      'updated_at', now()
    )
  )).*
  from public.products as source_product
  join trimos_demo_product_map as product_map
    on product_map.old_id = source_product.id
  left join trimos_demo_category_map as category_map
    on category_map.old_id = source_product.category_id;

  insert into trimos_demo_group_map (old_id, new_id)
  select id, gen_random_uuid()
  from public.modifier_groups
  where restaurant_id = source_restaurant.id;

  insert into public.modifier_groups
  select (jsonb_populate_record(
    null::public.modifier_groups,
    to_jsonb(source_group) || jsonb_build_object(
      'id', group_map.new_id,
      'restaurant_id', demo_restaurant_id,
      'created_at', now(),
      'updated_at', now()
    )
  )).*
  from public.modifier_groups as source_group
  join trimos_demo_group_map as group_map
    on group_map.old_id = source_group.id;

  insert into public.modifier_options
  select (jsonb_populate_record(
    null::public.modifier_options,
    to_jsonb(source_option) || jsonb_build_object(
      'id', gen_random_uuid(),
      'modifier_group_id', group_map.new_id,
      'created_at', now(),
      'updated_at', now()
    )
  )).*
  from public.modifier_options as source_option
  join trimos_demo_group_map as group_map
    on group_map.old_id = source_option.modifier_group_id;

  insert into public.product_modifier_groups (
    product_id, modifier_group_id, sort_order
  )
  select product_map.new_id, group_map.new_id, source_link.sort_order
  from public.product_modifier_groups as source_link
  join trimos_demo_product_map as product_map
    on product_map.old_id = source_link.product_id
  join trimos_demo_group_map as group_map
    on group_map.old_id = source_link.modifier_group_id;

  insert into public.product_variants
  select (jsonb_populate_record(
    null::public.product_variants,
    to_jsonb(source_variant) || jsonb_build_object(
      'id', gen_random_uuid(),
      'product_id', product_map.new_id,
      'created_at', now(),
      'updated_at', now()
    )
  )).*
  from public.product_variants as source_variant
  join trimos_demo_product_map as product_map
    on product_map.old_id = source_variant.product_id;

  insert into public.restaurant_tables (
    restaurant_id, name, seats, sort_order, is_active
  )
  select demo_restaurant_id, name, seats, sort_order, is_active
  from public.restaurant_tables
  where restaurant_id = source_restaurant.id;

  select * into source_subscription
  from public.restaurant_subscriptions
  where restaurant_id = source_restaurant.id;

  if source_subscription.id is not null then
    update public.restaurant_subscriptions
    set plan_id = source_subscription.plan_id,
        status = 'active',
        billing_interval = source_subscription.billing_interval,
        billing_exempt = true,
        stripe_customer_id = null,
        stripe_subscription_id = null,
        trial_started_at = null,
        trial_ends_at = null,
        current_period_started_at = now(),
        current_period_ends_at = now() + interval '10 years',
        cancel_at_period_end = false,
        canceled_at = null,
        last_payment_error = null,
        setup_fee_paid_at = now(),
        updated_at = now()
    where restaurant_id = demo_restaurant_id;
  end if;

  update public.restaurant_onboarding
  set identity_completed = true,
      menu_completed = true,
      operations_completed = true,
      payments_completed = true,
      team_completed = true,
      first_order_completed = true,
      progress_percent = 100,
      completed_at = now(),
      updated_at = now()
  where restaurant_id = demo_restaurant_id;

  insert into public.platform_audit_logs (
    actor_id, restaurant_id, action, entity_type, entity_id, metadata
  ) values (
    source_restaurant.created_by, demo_restaurant_id,
    'demo.created_from_restaurant', 'restaurant',
    demo_restaurant_id::text,
    jsonb_build_object('source_restaurant_id', source_restaurant.id)
  );
end;
$$;
