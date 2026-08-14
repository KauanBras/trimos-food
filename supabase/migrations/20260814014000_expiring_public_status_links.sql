-- Public status links remain useful for active operations, but cease exposing
-- customer/order data after their operational purpose has ended.

create or replace function public.get_public_order_status(
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
    'id', target_order.id,
    'customerName', target_order.customer_name,
    'status', target_order.status,
    'type', target_order.type,
    'tableLabel', target_order.table_label,
    'subtotal', target_order.subtotal,
    'deliveryFee', target_order.delivery_fee,
    'total', target_order.total,
    'estimatedMinutes', target_order.estimated_minutes,
    'paymentMethod', target_order.payment_method,
    'paymentStatus', target_order.payment_status,
    'cashTenderedAmount', target_order.cash_tendered_amount,
    'createdAt', target_order.created_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'productName', item.product_name,
        'variantName', item.variant_name,
        'modifiers', item.selected_modifiers,
        'quantity', item.quantity,
        'unitPrice', item.unit_price,
        'notes', item.notes
      ) order by item.created_at)
      from public.order_items as item
      where item.order_id = target_order.id
    ), '[]'::jsonb)
  )
  from public.orders as target_order
  where target_order.id = requested_order_id
    and target_order.public_token = requested_order_token
    and target_order.created_at >= now() - interval '90 days'
    and (
      target_order.status not in ('completed','cancelled')
      or coalesce(target_order.completed_at, target_order.cancelled_at, target_order.created_at)
        >= now() - interval '30 days'
    );
$$;

revoke all on function public.get_public_order_status(uuid, uuid) from public;
grant execute on function public.get_public_order_status(uuid, uuid) to anon, authenticated;

create or replace function public.get_public_reservation_status(
  requested_reservation_id uuid,
  requested_reservation_token uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', reservation.id,
    'restaurantId', reservation.restaurant_id,
    'customerName', reservation.customer_name,
    'date', reservation.reservation_date,
    'time', reservation.reservation_time,
    'partySize', reservation.party_size,
    'status', reservation.status,
    'tableLabel', reservation.table_label,
    'discountPercent', reservation.discount_percent,
    'discountLabel', reservation.discount_label,
    'createdAt', reservation.created_at
  )
  from public.reservations as reservation
  where reservation.id = requested_reservation_id
    and reservation.public_token = requested_reservation_token
    and reservation.created_at >= now() - interval '1 year'
    and reservation.reservation_date >= current_date - 30;
$$;

revoke all on function public.get_public_reservation_status(uuid, uuid) from public;
grant execute on function public.get_public_reservation_status(uuid, uuid) to anon, authenticated;

create or replace function public.cancel_public_reservation(
  requested_reservation_id uuid,
  requested_reservation_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_rows integer;
begin
  update public.reservations
  set status = 'cancelled'
  where id = requested_reservation_id
    and public_token = requested_reservation_token
    and status in ('pending', 'confirmed')
    and reservation_date >= current_date;

  get diagnostics affected_rows = row_count;
  return affected_rows = 1;
end;
$$;

revoke all on function public.cancel_public_reservation(uuid, uuid) from public;
grant execute on function public.cancel_public_reservation(uuid, uuid) to anon, authenticated;

