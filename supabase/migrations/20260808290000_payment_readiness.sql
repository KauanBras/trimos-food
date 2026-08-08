-- Garante que o MB WAY só aparece depois da ativação real na Stripe
-- e permite novas tentativas seguras de pagamento.

alter table public.restaurant_settings
  add column if not exists stripe_mb_way_enabled boolean not null default false;

alter table public.orders
  add column if not exists payment_attempts integer not null default 0;

alter table public.orders
  drop constraint if exists orders_payment_attempts_valid,
  add constraint orders_payment_attempts_valid check (payment_attempts between 0 and 20);

create or replace function public.enforce_mb_way_readiness()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.accepts_mb_way and not (
    new.stripe_charges_enabled
    and new.stripe_details_submitted
    and new.stripe_mb_way_enabled
    and new.stripe_account_id is not null
  ) then
    raise exception 'Conclua a ativação do MB WAY na Stripe antes de disponibilizá-lo.';
  end if;
  return new;
end;
$$;

drop trigger if exists restaurant_settings_enforce_mb_way on public.restaurant_settings;
create trigger restaurant_settings_enforce_mb_way
before insert or update on public.restaurant_settings
for each row execute function public.enforce_mb_way_readiness();

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
      and settings.stripe_mb_way_enabled
      and settings.stripe_account_id is not null
  )
  from public.restaurants as restaurant
  left join public.restaurant_settings as settings on settings.restaurant_id = restaurant.id
  where restaurant.id = requested_restaurant_id and restaurant.status = 'active';
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
    'paymentAttempts', target_order.payment_attempts,
    'stripeAccountId', settings.stripe_account_id,
    'stripeReady', settings.accepts_mb_way
      and settings.stripe_charges_enabled
      and settings.stripe_details_submitted
      and settings.stripe_mb_way_enabled
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
      payment_failure_reason = null,
      payment_attempts = payment_attempts + 1
  where id = requested_order_id
    and public_token = requested_order_token
    and payment_method = 'mb_way'
    and status = 'pending_payment'
    and payment_status in ('pending', 'failed')
    and payment_attempts < 20;
  return found;
end;
$$;
