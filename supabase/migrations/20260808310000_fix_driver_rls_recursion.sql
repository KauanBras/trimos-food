-- Evita recursao entre as politicas de orders, deliveries, drivers e
-- restaurant_drivers. As funcoes SECURITY DEFINER fazem apenas verificacoes
-- de pertença e impedem que uma politica volte a avaliar a mesma tabela.

create or replace function public.is_current_driver(
  requested_driver_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.drivers as driver
    where driver.id = requested_driver_id
      and driver.user_id = auth.uid()
      and driver.is_active
  );
$$;

create or replace function public.is_current_driver_for_order(
  requested_order_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.drivers as driver
    join public.deliveries as delivery
      on delivery.offered_driver_id = driver.id
      or delivery.driver_id = driver.id
    where driver.user_id = auth.uid()
      and driver.is_active
      and delivery.order_id = requested_order_id
  );
$$;

create or replace function public.can_restaurant_view_driver(
  requested_driver_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.restaurant_drivers as restaurant_driver
      where restaurant_driver.driver_id = requested_driver_id
        and restaurant_driver.is_active
        and public.is_restaurant_member(restaurant_driver.restaurant_id)
    )
    or exists (
      select 1
      from public.deliveries as delivery
      where (
        delivery.offered_driver_id = requested_driver_id
        or delivery.driver_id = requested_driver_id
      )
        and public.is_restaurant_member(delivery.restaurant_id)
    );
$$;

revoke all on function public.is_current_driver(uuid) from public;
revoke all on function public.is_current_driver_for_order(uuid) from public;
revoke all on function public.can_restaurant_view_driver(uuid) from public;

grant execute on function public.is_current_driver(uuid) to authenticated;
grant execute on function public.is_current_driver_for_order(uuid) to authenticated;
grant execute on function public.can_restaurant_view_driver(uuid) to authenticated;

drop policy if exists restaurant_drivers_read on public.restaurant_drivers;
create policy restaurant_drivers_read
on public.restaurant_drivers for select to authenticated
using (
  public.is_restaurant_member(restaurant_id)
  or public.is_current_driver(driver_id)
  or public.is_super_admin()
);

drop policy if exists driver_earnings_read on public.driver_earnings;
create policy driver_earnings_read
on public.driver_earnings for select to authenticated
using (
  public.is_restaurant_member(restaurant_id)
  or public.is_current_driver(driver_id)
  or public.is_super_admin()
);

drop policy if exists deliveries_restaurant_read on public.deliveries;
create policy deliveries_restaurant_read
on public.deliveries for select to authenticated
using (
  public.is_restaurant_member(restaurant_id)
  or public.is_current_driver(offered_driver_id)
  or public.is_current_driver(driver_id)
  or public.is_super_admin()
);

drop policy if exists orders_driver_read_assigned on public.orders;
create policy orders_driver_read_assigned
on public.orders for select to authenticated
using (public.is_current_driver_for_order(id));

drop policy if exists drivers_member_read on public.drivers;
create policy drivers_member_read
on public.drivers for select to authenticated
using (
  public.is_current_driver(id)
  or public.is_restaurant_member(restaurant_id)
  or public.can_restaurant_view_driver(id)
  or public.is_super_admin()
);
