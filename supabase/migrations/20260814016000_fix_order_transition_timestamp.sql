-- Fix the already-deployed transition function: CURRENT_TIME is a PostgreSQL
-- keyword and was resolved as timetz instead of the local timestamptz variable.
create or replace function public.transition_restaurant_order_status(
  requested_order_id uuid,
  requested_status public.order_status
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_order public.orders%rowtype;
  next_payment_status public.payment_status;
  transition_allowed boolean := false;
  transition_time timestamptz := now();
begin
  select * into target_order
  from public.orders
  where id = requested_order_id
  for update;

  if target_order.id is null then raise exception 'Pedido não encontrado.'; end if;
  if not (
    public.has_restaurant_role(
      target_order.restaurant_id,
      array['owner','admin','manager','staff','kitchen']::public.restaurant_role[]
    )
    or public.is_super_admin()
  ) then raise exception 'Sem permissão para atualizar este pedido.'; end if;

  transition_allowed :=
    (target_order.status in ('new','confirmed') and requested_status in ('preparing','cancelled'))
    or (target_order.status = 'preparing' and requested_status in ('ready','cancelled'))
    or (target_order.status = 'ready' and requested_status in ('completed','cancelled'));

  if not transition_allowed then raise exception 'Esta mudança de estado não é permitida.'; end if;
  if target_order.type = 'delivery'
    and target_order.status = 'ready'
    and requested_status = 'completed' then
    raise exception 'A entrega deve ser concluída pelo estafeta.';
  end if;
  if requested_status = 'cancelled'
    and target_order.payment_method = 'mb_way'
    and target_order.payment_status = 'paid' then
    raise exception 'O pagamento deve ser reembolsado antes do cancelamento.';
  end if;

  next_payment_status := target_order.payment_status;
  if requested_status = 'completed' and target_order.payment_status = 'awaiting_collection' then
    next_payment_status := 'paid';
  elsif requested_status = 'cancelled'
    and target_order.payment_status in ('pending','awaiting_collection','failed') then
    next_payment_status := 'cancelled';
  end if;

  update public.orders
  set
    status = requested_status,
    payment_status = next_payment_status,
    accepted_at = case when requested_status = 'preparing' then coalesce(accepted_at, transition_time) else accepted_at end,
    ready_at = case when requested_status = 'ready' then transition_time else ready_at end,
    completed_at = case when requested_status = 'completed' then transition_time else completed_at end,
    cancelled_at = case when requested_status = 'cancelled' then transition_time else cancelled_at end,
    paid_at = case when next_payment_status = 'paid' then coalesce(paid_at, transition_time) else paid_at end
  where id = target_order.id;

  return jsonb_build_object('status', requested_status, 'paymentStatus', next_payment_status);
end;
$$;

revoke all on function public.transition_restaurant_order_status(uuid, public.order_status) from public;
grant execute on function public.transition_restaurant_order_status(uuid, public.order_status) to authenticated;
