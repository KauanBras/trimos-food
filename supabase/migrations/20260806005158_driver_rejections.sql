create table public.delivery_rejections (
  id uuid primary key default gen_random_uuid(),

  delivery_id uuid not null
    references public.deliveries(id) on delete cascade,

  driver_id uuid not null
    references public.drivers(id) on delete cascade,

  created_at timestamptz not null default now(),

  unique (delivery_id, driver_id)
);

create index delivery_rejections_driver_idx
  on public.delivery_rejections(driver_id, created_at desc);

create index delivery_rejections_delivery_idx
  on public.delivery_rejections(delivery_id);

alter table public.delivery_rejections enable row level security;

create policy delivery_rejections_read_own
on public.delivery_rejections
for select
to authenticated
using (
  exists (
    select 1
    from public.drivers
    where drivers.id = delivery_rejections.driver_id
      and drivers.user_id = auth.uid()
  )
  or public.is_super_admin()
);

create or replace function public.reject_delivery(
  requested_delivery_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_driver public.drivers;
  selected_delivery public.deliveries;
begin
  select *
  into current_driver
  from public.drivers
  where user_id = auth.uid()
    and is_active = true
  limit 1;

  if current_driver.id is null then
    raise exception 'Perfil de estafeta não encontrado';
  end if;

  select *
  into selected_delivery
  from public.deliveries
  where id = requested_delivery_id;

  if selected_delivery.id is null then
    raise exception 'Entrega não encontrada';
  end if;

  if selected_delivery.restaurant_id <> current_driver.restaurant_id then
    raise exception 'Entrega pertence a outro restaurante';
  end if;

  if selected_delivery.status not in (
    'searching_driver',
    'offered'
  ) then
    raise exception 'Esta entrega já não pode ser recusada';
  end if;

  insert into public.delivery_rejections (
    delivery_id,
    driver_id
  )
  values (
    selected_delivery.id,
    current_driver.id
  )
  on conflict (delivery_id, driver_id) do nothing;
end;
$$;

grant execute on function public.reject_delivery(uuid)
to authenticated;
