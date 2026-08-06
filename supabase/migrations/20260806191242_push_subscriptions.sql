create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references public.profiles(id) on delete cascade,

  restaurant_id uuid not null
    references public.restaurants(id) on delete cascade,

  driver_id uuid
    references public.drivers(id) on delete cascade,

  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,

  user_agent text,
  device_name text,

  is_active boolean not null default true,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_subscriptions_user_idx
  on public.push_subscriptions(user_id, is_active);

create index push_subscriptions_driver_idx
  on public.push_subscriptions(driver_id, is_active);

create index push_subscriptions_restaurant_idx
  on public.push_subscriptions(restaurant_id, is_active);

create trigger push_subscriptions_set_updated_at
before update on public.push_subscriptions
for each row execute function public.set_updated_at();

alter table public.push_subscriptions enable row level security;

create policy push_subscriptions_read_own
on public.push_subscriptions
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_super_admin()
);

create policy push_subscriptions_insert_own
on public.push_subscriptions
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_restaurant_member(restaurant_id)
);

create policy push_subscriptions_update_own
on public.push_subscriptions
for update
to authenticated
using (
  user_id = auth.uid()
  or public.is_super_admin()
)
with check (
  user_id = auth.uid()
  or public.is_super_admin()
);

create policy push_subscriptions_delete_own
on public.push_subscriptions
for delete
to authenticated
using (
  user_id = auth.uid()
  or public.is_super_admin()
);
