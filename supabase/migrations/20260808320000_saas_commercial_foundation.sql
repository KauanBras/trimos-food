-- Fundação comercial multi-restaurante da Trimos Food.
-- Adiciona planos, assinaturas, onboarding, auditoria e controlo de demonstrações.

do $$ begin
  create type public.subscription_status as enum (
    'incomplete',
    'trialing',
    'active',
    'past_due',
    'paused',
    'canceled',
    'unpaid'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.subscription_interval as enum ('month', 'year');
exception when duplicate_object then null; end $$;

alter table public.restaurants
  add column if not exists is_demo boolean not null default false,
  add column if not exists demo_locked boolean not null default false,
  add column if not exists demo_last_reset_at timestamptz;

create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  monthly_price_cents integer not null default 0,
  yearly_price_cents integer,
  currency_code char(3) not null default 'EUR',
  stripe_product_id text unique,
  stripe_monthly_price_id text unique,
  stripe_yearly_price_id text unique,
  features jsonb not null default '[]'::jsonb,
  limits jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  is_public boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_plans_code_format
    check (code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint subscription_plans_monthly_price_positive
    check (monthly_price_cents >= 0),
  constraint subscription_plans_yearly_price_positive
    check (yearly_price_cents is null or yearly_price_cents >= 0),
  constraint subscription_plans_features_array
    check (jsonb_typeof(features) = 'array'),
  constraint subscription_plans_limits_object
    check (jsonb_typeof(limits) = 'object')
);

create table if not exists public.restaurant_subscriptions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null unique
    references public.restaurants(id) on delete cascade,
  plan_id uuid not null
    references public.subscription_plans(id) on delete restrict,
  status public.subscription_status not null default 'trialing',
  billing_interval public.subscription_interval not null default 'month',
  billing_exempt boolean not null default false,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_started_at timestamptz,
  current_period_ends_at timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  last_payment_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists restaurant_subscriptions_status_idx
  on public.restaurant_subscriptions(status, current_period_ends_at);

create table if not exists public.restaurant_onboarding (
  restaurant_id uuid primary key
    references public.restaurants(id) on delete cascade,
  identity_completed boolean not null default false,
  menu_completed boolean not null default false,
  operations_completed boolean not null default false,
  payments_completed boolean not null default false,
  team_completed boolean not null default false,
  first_order_completed boolean not null default false,
  progress_percent integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurant_onboarding_progress_range
    check (progress_percent between 0 and 100)
);

create table if not exists public.platform_audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  restaurant_id uuid references public.restaurants(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint platform_audit_action_not_empty
    check (length(trim(action)) between 2 and 120),
  constraint platform_audit_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

create index if not exists platform_audit_logs_restaurant_idx
  on public.platform_audit_logs(restaurant_id, created_at desc);
create index if not exists platform_audit_logs_actor_idx
  on public.platform_audit_logs(actor_id, created_at desc);
create index if not exists platform_audit_logs_action_idx
  on public.platform_audit_logs(action, created_at desc);

create trigger subscription_plans_set_updated_at
before update on public.subscription_plans
for each row execute function public.set_updated_at();

create trigger restaurant_subscriptions_set_updated_at
before update on public.restaurant_subscriptions
for each row execute function public.set_updated_at();

create trigger restaurant_onboarding_set_updated_at
before update on public.restaurant_onboarding
for each row execute function public.set_updated_at();

insert into public.subscription_plans (
  code,
  name,
  description,
  monthly_price_cents,
  yearly_price_cents,
  features,
  limits,
  sort_order
)
values
  (
    'essencial',
    'Essencial',
    'Menu digital, pedidos, cozinha, clientes e reservas.',
    4900,
    49000,
    '["Menu e pedidos online", "Gestão de cozinha", "Clientes e reservas", "Suporte por e-mail"]'::jsonb,
    '{"products": 150, "team_members": 5, "monthly_orders": 1000}'::jsonb,
    10
  ),
  (
    'profissional',
    'Profissional',
    'Operação completa com pagamentos, estafetas e relatórios.',
    7900,
    79000,
    '["Tudo do Essencial", "MB WAY e pagamentos", "Rede de estafetas", "Relatórios avançados", "Suporte prioritário"]'::jsonb,
    '{"products": 500, "team_members": 15, "monthly_orders": 5000}'::jsonb,
    20
  ),
  (
    'escala',
    'Escala',
    'Plano para operações com maior volume e acompanhamento dedicado.',
    12900,
    129000,
    '["Tudo do Profissional", "Utilização sem limite prático", "Acompanhamento dedicado", "Configuração assistida"]'::jsonb,
    '{"products": null, "team_members": null, "monthly_orders": null}'::jsonb,
    30
  )
on conflict (code) do nothing;

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
      'trialing',
      now(),
      now() + interval '30 days'
    )
    on conflict (restaurant_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_restaurant_created_commercial on public.restaurants;
create trigger on_restaurant_created_commercial
after insert on public.restaurants
for each row execute function public.handle_new_restaurant_commercial();

insert into public.restaurant_onboarding (restaurant_id)
select id from public.restaurants
on conflict (restaurant_id) do nothing;

insert into public.restaurant_subscriptions (
  restaurant_id,
  plan_id,
  status,
  billing_exempt,
  current_period_started_at
)
select
  restaurant.id,
  plan.id,
  'active',
  true,
  now()
from public.restaurants as restaurant
cross join lateral (
  select id
  from public.subscription_plans
  where code = 'profissional'
  limit 1
) as plan
on conflict (restaurant_id) do nothing;

-- O proprietário do piloto existente é o operador inicial da plataforma.
update public.profiles
set platform_role = 'super_admin', updated_at = now()
where id = (
  select created_by
  from public.restaurants
  where slug = 'hirotatsu-sushi'
  limit 1
);

create or replace function public.refresh_restaurant_onboarding(
  requested_restaurant_id uuid
)
returns public.restaurant_onboarding
language plpgsql
security definer
set search_path = ''
as $$
declare
  identity_ready boolean;
  menu_ready boolean;
  operations_ready boolean;
  payments_ready boolean;
  team_ready boolean;
  first_order_ready boolean;
  progress_value integer;
  result_row public.restaurant_onboarding;
begin
  if not (
    public.is_super_admin()
    or public.is_restaurant_member(requested_restaurant_id)
  ) then
    raise exception 'Sem permissão para atualizar este onboarding';
  end if;

  select
    length(trim(coalesce(name, ''))) >= 2
      and nullif(trim(coalesce(description, '')), '') is not null
      and nullif(trim(coalesce(email, '')), '') is not null,
    exists (
      select 1 from public.products
      where restaurant_id = requested_restaurant_id
        and is_active = true
    ),
    exists (
      select 1 from public.business_hours
      where restaurant_id = requested_restaurant_id
        and is_closed = false
        and opens_at is not null
        and closes_at is not null
    ),
    exists (
      select 1 from public.restaurant_settings
      where restaurant_id = requested_restaurant_id
        and (accepts_cash or accepts_terminal or accepts_mb_way)
    ),
    exists (
      select 1 from public.restaurant_users
      where restaurant_id = requested_restaurant_id
        and is_active = true
    ),
    exists (
      select 1 from public.orders
      where restaurant_id = requested_restaurant_id
    )
  into
    identity_ready,
    menu_ready,
    operations_ready,
    payments_ready,
    team_ready,
    first_order_ready
  from public.restaurants
  where id = requested_restaurant_id;

  if not found then
    raise exception 'Restaurante não encontrado';
  end if;

  progress_value := (
    (identity_ready::integer)
    + (menu_ready::integer)
    + (operations_ready::integer)
    + (payments_ready::integer)
    + (team_ready::integer)
    + (first_order_ready::integer)
  ) * 100 / 6;

  insert into public.restaurant_onboarding (
    restaurant_id,
    identity_completed,
    menu_completed,
    operations_completed,
    payments_completed,
    team_completed,
    first_order_completed,
    progress_percent,
    completed_at
  )
  values (
    requested_restaurant_id,
    identity_ready,
    menu_ready,
    operations_ready,
    payments_ready,
    team_ready,
    first_order_ready,
    progress_value,
    case when progress_value = 100 then now() else null end
  )
  on conflict (restaurant_id) do update set
    identity_completed = excluded.identity_completed,
    menu_completed = excluded.menu_completed,
    operations_completed = excluded.operations_completed,
    payments_completed = excluded.payments_completed,
    team_completed = excluded.team_completed,
    first_order_completed = excluded.first_order_completed,
    progress_percent = excluded.progress_percent,
    completed_at = case
      when excluded.progress_percent = 100
        then coalesce(public.restaurant_onboarding.completed_at, now())
      else null
    end,
    updated_at = now()
  returning * into result_row;

  return result_row;
end;
$$;

create or replace function public.record_platform_audit(
  requested_restaurant_id uuid,
  requested_action text,
  requested_entity_type text default null,
  requested_entity_id text default null,
  requested_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_id bigint;
begin
  if auth.uid() is null then
    raise exception 'Utilizador não autenticado';
  end if;

  if length(trim(coalesce(requested_action, ''))) < 2 then
    raise exception 'Ação de auditoria inválida';
  end if;

  if requested_restaurant_id is not null
    and not (
      public.is_super_admin()
      or public.is_restaurant_member(requested_restaurant_id)
    ) then
    raise exception 'Sem permissão para registar esta ação';
  end if;

  if requested_restaurant_id is null and not public.is_super_admin() then
    raise exception 'Apenas a administração pode registar ações globais';
  end if;

  insert into public.platform_audit_logs (
    actor_id,
    restaurant_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    auth.uid(),
    requested_restaurant_id,
    trim(requested_action),
    nullif(trim(coalesce(requested_entity_type, '')), ''),
    nullif(trim(coalesce(requested_entity_id, '')), ''),
    coalesce(requested_metadata, '{}'::jsonb)
  )
  returning id into inserted_id;

  return inserted_id;
end;
$$;

create or replace function public.reset_demo_restaurant(
  requested_restaurant_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Apenas a administração pode repor demonstrações';
  end if;

  if not exists (
    select 1 from public.restaurants
    where id = requested_restaurant_id
      and is_demo = true
  ) then
    raise exception 'O restaurante indicado não é uma demonstração';
  end if;

  delete from public.orders
  where restaurant_id = requested_restaurant_id;

  delete from public.reservations
  where restaurant_id = requested_restaurant_id;

  delete from public.customers
  where restaurant_id = requested_restaurant_id;

  update public.restaurants
  set demo_last_reset_at = now(), updated_at = now()
  where id = requested_restaurant_id;

  insert into public.platform_audit_logs (
    actor_id,
    restaurant_id,
    action,
    entity_type,
    entity_id
  )
  values (
    auth.uid(),
    requested_restaurant_id,
    'demo.reset',
    'restaurant',
    requested_restaurant_id::text
  );
end;
$$;

revoke all on function public.refresh_restaurant_onboarding(uuid)
from public, anon;
grant execute on function public.refresh_restaurant_onboarding(uuid)
to authenticated;

revoke all on function public.record_platform_audit(uuid, text, text, text, jsonb)
from public, anon;
grant execute on function public.record_platform_audit(uuid, text, text, text, jsonb)
to authenticated;

revoke all on function public.reset_demo_restaurant(uuid)
from public, anon, authenticated;
grant execute on function public.reset_demo_restaurant(uuid)
to authenticated;

alter table public.subscription_plans enable row level security;
alter table public.restaurant_subscriptions enable row level security;
alter table public.restaurant_onboarding enable row level security;
alter table public.platform_audit_logs enable row level security;

create policy subscription_plans_public_read
on public.subscription_plans
for select
to anon, authenticated
using (is_active and is_public or public.is_super_admin());

create policy subscription_plans_admin_manage
on public.subscription_plans
for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy restaurant_subscriptions_read
on public.restaurant_subscriptions
for select
to authenticated
using (
  public.is_super_admin()
  or public.is_restaurant_member(restaurant_id)
);

create policy restaurant_onboarding_read
on public.restaurant_onboarding
for select
to authenticated
using (
  public.is_super_admin()
  or public.is_restaurant_member(restaurant_id)
);

create policy platform_audit_logs_read
on public.platform_audit_logs
for select
to authenticated
using (
  public.is_super_admin()
  or (
    restaurant_id is not null
    and public.has_restaurant_role(
      restaurant_id,
      array['owner', 'admin']::public.restaurant_role[]
    )
  )
);

-- Impede que um utilizador comum se promova a administrador da plataforma.
revoke update on table public.profiles from authenticated;
grant update (full_name, phone, avatar_url, updated_at)
on table public.profiles to authenticated;

-- Restaurantes devem ser criados exclusivamente pela função segura de onboarding.
revoke insert on table public.restaurants from authenticated;

