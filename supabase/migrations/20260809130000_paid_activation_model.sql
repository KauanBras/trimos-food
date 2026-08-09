-- Substitui o teste gratuito automático por ativação paga.
-- A taxa de configuração é cobrada apenas na primeira contratação.

alter table public.subscription_plans
  add column if not exists setup_fee_cents integer not null default 0;

alter table public.subscription_plans
  drop constraint if exists subscription_plans_setup_fee_positive;

alter table public.subscription_plans
  add constraint subscription_plans_setup_fee_positive
  check (setup_fee_cents >= 0);

alter table public.restaurant_subscriptions
  add column if not exists setup_fee_paid_at timestamptz;

update public.subscription_plans
set setup_fee_cents = case code
  when 'essencial' then 14900
  when 'profissional' then 19900
  when 'escala' then 29900
  else setup_fee_cents
end
where setup_fee_cents = 0;

create or replace function public.handle_new_restaurant_commercial()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  default_plan_id uuid;
begin
  select id into default_plan_id
  from public.subscription_plans
  where code = 'profissional'
  limit 1;

  insert into public.restaurant_onboarding (restaurant_id)
  values (new.id)
  on conflict (restaurant_id) do nothing;

  if default_plan_id is not null then
    insert into public.restaurant_subscriptions (
      restaurant_id,
      plan_id,
      status,
      trial_started_at,
      trial_ends_at
    )
    values (
      new.id,
      default_plan_id,
      'incomplete',
      null,
      null
    )
    on conflict (restaurant_id) do nothing;
  end if;

  return new;
end;
$$;

create or replace function public.create_restaurant_for_current_user(
  restaurant_name text,
  restaurant_slug text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_restaurant_id uuid;
  current_user_id uuid;
  final_slug text;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Utilizador não autenticado';
  end if;

  if length(trim(coalesce(restaurant_name, ''))) < 2
    or length(trim(restaurant_name)) > 100 then
    raise exception 'Indique um nome de restaurante válido.';
  end if;

  if restaurant_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Não foi possível gerar um endereço válido.';
  end if;

  if exists (
    select 1
    from public.restaurant_users
    where user_id = current_user_id
      and is_active = true
  ) then
    raise exception 'Este utilizador já pertence a um restaurante';
  end if;

  final_slug := restaurant_slug;
  if exists (select 1 from public.restaurants where slug = final_slug) then
    final_slug := final_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  end if;

  insert into public.restaurants (
    name,
    slug,
    status,
    accepts_delivery,
    accepts_pickup,
    accepts_dine_in,
    accepts_reservations,
    created_by
  )
  values (
    trim(restaurant_name),
    final_slug,
    'draft',
    true,
    true,
    true,
    true,
    current_user_id
  )
  returning id into new_restaurant_id;

  insert into public.restaurant_users (
    restaurant_id,
    user_id,
    role,
    is_active
  )
  values (
    new_restaurant_id,
    current_user_id,
    'owner',
    true
  );

  return new_restaurant_id;
end;
$$;

revoke all on function public.create_restaurant_for_current_user(text, text)
from public, anon;
grant execute on function public.create_restaurant_for_current_user(text, text)
to authenticated;
