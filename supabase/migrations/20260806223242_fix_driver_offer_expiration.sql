-- =========================================================
-- TRIMOS FOOD
-- PERMITE ACEITAR A OFERTA ENQUANTO AINDA ESTIVER ATRIBUÍDA
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

  /*
   * Não rejeitamos apenas pelo horário de expiração.
   * Enquanto a oferta continuar atribuída a este estafeta,
   * ele ainda poderá aceitá-la.
   *
   * O worker de timeout será responsável por retirar e
   * redistribuir ofertas verdadeiramente expiradas.
   */
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

  update public.orders
  set
    status = 'awaiting_pickup',
    updated_at = now()
  where id = selected_delivery.order_id;
end;
$$;

grant execute on function public.accept_delivery(uuid)
to authenticated;
