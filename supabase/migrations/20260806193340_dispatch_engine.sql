-- =========================================================
-- TRIMOS FOOD
-- MOTOR DE DISTRIBUIÇÃO DE ESTAFETAS
-- =========================================================

alter table public.deliveries
  add column offered_driver_id uuid
    references public.drivers(id) on delete set null,
  add column offer_started_at timestamptz,
  add column offer_expires_at timestamptz,
  add column dispatch_attempts integer not null default 0;

alter table public.deliveries
  add constraint deliveries_dispatch_attempts_positive
  check (dispatch_attempts >= 0);

create index deliveries_offered_driver_idx
  on public.deliveries(
    offered_driver_id,
    status,
    offer_expires_at
  );

-- =========================================================
-- ESCOLHER O PRÓXIMO ESTAFETA
-- =========================================================

create or replace function public.dispatch_next_driver(
  requested_delivery_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_delivery public.deliveries;
  selected_driver_id uuid;
begin
  select *
  into selected_delivery
  from public.deliveries
  where id = requested_delivery_id
  for update;

  if selected_delivery.id is null then
    raise exception 'Entrega não encontrada';
  end if;

  if selected_delivery.status in (
    'accepted',
    'picked_up',
    'delivered',
    'cancelled'
  ) then
    return selected_delivery.offered_driver_id;
  end if;

  select drivers.id
  into selected_driver_id
  from public.drivers
  where drivers.restaurant_id =
        selected_delivery.restaurant_id
    and drivers.status = 'available'
    and drivers.is_active = true

    and not exists (
      select 1
      from public.delivery_rejections
      where delivery_rejections.delivery_id =
            selected_delivery.id
        and delivery_rejections.driver_id =
            drivers.id
    )

    and not exists (
      select 1
      from public.deliveries active_delivery
      where active_delivery.driver_id = drivers.id
        and active_delivery.status in (
          'accepted',
          'picked_up'
        )
    )

  order by
    drivers.location_updated_at desc nulls last,
    drivers.created_at asc

  limit 1;

  if selected_driver_id is null then
    update public.deliveries
    set
      status = 'searching_driver',
      offered_driver_id = null,
      offer_started_at = null,
      offer_expires_at = null
    where id = selected_delivery.id;

    return null;
  end if;

  update public.deliveries
  set
    status = 'offered',
    offered_driver_id = selected_driver_id,
    offer_started_at = now(),
    offer_expires_at = now() + interval '30 seconds',
    dispatch_attempts = dispatch_attempts + 1
  where id = selected_delivery.id;

  return selected_driver_id;
end;
$$;

grant execute on function public.dispatch_next_driver(uuid)
to authenticated;

-- =========================================================
-- CRIAR ENTREGA E INICIAR DISPATCH
-- =========================================================

create or replace function public.create_delivery_for_order(
  requested_order_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_order public.orders;
  new_delivery_id uuid;
begin
  select *
  into requested_order
  from public.orders
  where id = requested_order_id;

  if requested_order.id is null then
    raise exception 'Pedido não encontrado';
  end if;

  if not (
    public.is_restaurant_member(
      requested_order.restaurant_id
    )
    or public.is_super_admin()
  ) then
    raise exception 'Sem permissão para criar esta entrega';
  end if;

  if requested_order.type <> 'delivery' then
    raise exception 'Este pedido não é uma entrega';
  end if;

  if requested_order.status <> 'ready' then
    raise exception 'O pedido precisa estar pronto';
  end if;

  insert into public.deliveries (
    restaurant_id,
    order_id,
    status,
    delivery_address,
    delivery_fee
  )
  values (
    requested_order.restaurant_id,
    requested_order.id,
    'searching_driver',
    coalesce(
      requested_order.delivery_address,
      'Morada não informada'
    ),
    requested_order.delivery_fee
  )
  on conflict (order_id)
  do update set
    status = 'searching_driver',
    driver_id = null,
    offered_driver_id = null,
    offer_started_at = null,
    offer_expires_at = null,
    accepted_at = null,
    picked_up_at = null,
    delivered_at = null,
    cancelled_at = null
  returning id into new_delivery_id;

  update public.orders
  set status = 'awaiting_driver'
  where id = requested_order.id;

  perform public.dispatch_next_driver(new_delivery_id);

  return new_delivery_id;
end;
$$;

grant execute on function public.create_delivery_for_order(uuid)
to authenticated;

-- =========================================================
-- ACEITAR APENAS A OFERTA ATRIBUÍDA
-- =========================================================

create or replace function public.accept_delivery(
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

  if current_driver.status <> 'available' then
    raise exception 'O estafeta precisa estar disponível';
  end if;

  select *
  into selected_delivery
  from public.deliveries
  where id = requested_delivery_id
  for update;

  if selected_delivery.id is null then
    raise exception 'Entrega não encontrada';
  end if;

  if selected_delivery.status <> 'offered' then
    raise exception 'Esta oferta já não está disponível';
  end if;

  if selected_delivery.offered_driver_id <>
     current_driver.id then
    raise exception 'Esta oferta pertence a outro estafeta';
  end if;

  if selected_delivery.offer_expires_at <= now() then
    raise exception 'A oferta expirou';
  end if;

  update public.deliveries
  set
    driver_id = current_driver.id,
    offered_driver_id = null,
    status = 'accepted',
    accepted_at = now(),
    offer_expires_at = null
  where id = selected_delivery.id;

  update public.drivers
  set status = 'busy'
  where id = current_driver.id;
end;
$$;

grant execute on function public.accept_delivery(uuid)
to authenticated;

-- =========================================================
-- RECUSAR E CHAMAR AUTOMATICAMENTE O PRÓXIMO
-- =========================================================

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
  where id = requested_delivery_id
  for update;

  if selected_delivery.id is null then
    raise exception 'Entrega não encontrada';
  end if;

  if selected_delivery.status <> 'offered' then
    raise exception 'Esta oferta já não pode ser recusada';
  end if;

  if selected_delivery.offered_driver_id <>
     current_driver.id then
    raise exception 'Esta oferta pertence a outro estafeta';
  end if;

  insert into public.delivery_rejections (
    delivery_id,
    driver_id
  )
  values (
    selected_delivery.id,
    current_driver.id
  )
  on conflict (delivery_id, driver_id)
  do nothing;

  update public.deliveries
  set
    status = 'searching_driver',
    offered_driver_id = null,
    offer_started_at = null,
    offer_expires_at = null
  where id = selected_delivery.id;

  perform public.dispatch_next_driver(
    selected_delivery.id
  );
end;
$$;

grant execute on function public.reject_delivery(uuid)
to authenticated;

-- =========================================================
-- PROCESSAR OFERTAS EXPIRADAS
-- Será chamado pelo worker de timeout.
-- =========================================================

create or replace function public.process_expired_delivery_offers()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  expired_delivery record;
  processed_count integer := 0;
begin
  for expired_delivery in
    select
      deliveries.id,
      deliveries.offered_driver_id
    from public.deliveries
    where status = 'offered'
      and offer_expires_at <= now()
    for update skip locked
  loop
    if expired_delivery.offered_driver_id is not null then
      insert into public.delivery_rejections (
        delivery_id,
        driver_id
      )
      values (
        expired_delivery.id,
        expired_delivery.offered_driver_id
      )
      on conflict (delivery_id, driver_id)
      do nothing;
    end if;

    update public.deliveries
    set
      status = 'searching_driver',
      offered_driver_id = null,
      offer_started_at = null,
      offer_expires_at = null
    where id = expired_delivery.id;

    perform public.dispatch_next_driver(
      expired_delivery.id
    );

    processed_count := processed_count + 1;
  end loop;

  return processed_count;
end;
$$;

revoke all on function
  public.process_expired_delivery_offers()
from public;

grant execute on function
  public.process_expired_delivery_offers()
to service_role;
