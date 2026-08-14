-- Final public API lockdown.
-- Public pages read only the curated projection, while customer writes go
-- through the rate-limited server routes that use the service role.

drop policy if exists restaurants_read on public.restaurants;
create policy restaurants_read
on public.restaurants for select to authenticated
using (
  public.is_restaurant_member(id)
  or public.is_super_admin()
);

revoke select on public.restaurants from anon;

revoke all on function public.create_public_order(
  uuid, text, text, text, public.order_type, text, numeric, numeric,
  text, jsonb, public.payment_method, numeric
) from public, anon, authenticated;
grant execute on function public.create_public_order(
  uuid, text, text, text, public.order_type, text, numeric, numeric,
  text, jsonb, public.payment_method, numeric
) to service_role;

revoke all on function public.create_public_reservation(
  uuid, text, text, text, date, time, integer, text
) from public, anon, authenticated;
grant execute on function public.create_public_reservation(
  uuid, text, text, text, date, time, integer, text
) to service_role;

drop policy if exists orders_member_update on public.orders;
revoke update on public.orders from authenticated;
