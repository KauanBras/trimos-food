-- =========================================================
-- TRIMOS FOOD
-- CORRIGE ACEITAÇÃO E VISIBILIDADE DO PEDIDO PELO ESTAFETA
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

  if selected_delivery.offered_driver_id is distinct from current_driver.id then
    raise exception 'Esta oferta pertence a outro estafeta';
  end if;

  update public.deliveries
  set
    driver_id = current_driver.id,
    offered_driver_id = null,
    status = 'accepted',
    accepted_at = now(),
    offer_started_at = null,
    offer_expires_at = null
  where id = selected_delivery.id
    and status = 'offered'
    and offered_driver_id = current_driver.id;

  if not found then
    raise exception 'A oferta já foi aceite ou redistribuída';
  end if;

  update public.drivers
  set
    status = 'busy',
    updated_at = now()
  where id = current_driver.id;

  /*
   * O pedido permanece awaiting_driver enquanto o estafeta
   * ainda não o recolheu. A função pick_up_delivery será
   * responsável por mudar para out_for_delivery.
   */
  update public.orders
  set
    status = 'awaiting_driver',
    updated_at = now()
  where id = selected_delivery.order_id;
end;
$$;

grant execute on function public.accept_delivery(uuid)
to authenticated;

-- =========================================================
-- PERMITE AO ESTAFETA VER OS DADOS DO PEDIDO OFERECIDO
-- Sem esta policy, a relação deliveries -> orders retorna null.
-- =========================================================

drop policy if exists orders_driver_read_assigned
on public.orders;

create policy orders_driver_read_assigned
on public.orders
for select
to authenticated
using (
  exists (
    select 1
    from public.drivers
    join public.deliveries
      on deliveries.restaurant_id = drivers.restaurant_id
    where drivers.user_id = auth.uid()
      and drivers.is_active = true
      and deliveries.order_id = orders.id
      and (
        deliveries.offered_driver_id = drivers.id
        or deliveries.driver_id = drivers.id
      )
  )
);
