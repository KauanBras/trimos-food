-- Restrict operational and personal data according to the user's job.

drop policy if exists restaurant_users_read on public.restaurant_users;
create policy restaurant_users_read
on public.restaurant_users for select to authenticated
using (
  user_id = auth.uid()
  or public.has_restaurant_role(
    restaurant_id,
    array['owner','admin','manager']::public.restaurant_role[]
  )
  or public.is_super_admin()
);

drop policy if exists profiles_select_restaurant_colleague on public.profiles;
create policy profiles_select_restaurant_colleague
on public.profiles for select to authenticated
using (
  exists (
    select 1
    from public.restaurant_users as colleague
    where colleague.user_id = profiles.id
      and colleague.is_active
      and public.has_restaurant_role(
        colleague.restaurant_id,
        array['owner','admin','manager']::public.restaurant_role[]
      )
  )
  or exists (
    select 1
    from public.drivers as colleague_driver
    where colleague_driver.user_id = profiles.id
      and colleague_driver.is_active
      and public.can_restaurant_view_driver(colleague_driver.id)
  )
);

drop policy if exists customers_member_read on public.customers;
create policy customers_member_read
on public.customers for select to authenticated
using (
  public.has_restaurant_role(
    restaurant_id,
    array['owner','admin','manager','staff']::public.restaurant_role[]
  )
  or public.is_super_admin()
);

drop policy if exists reservations_member_read on public.reservations;
create policy reservations_member_read
on public.reservations for select to authenticated
using (
  public.has_restaurant_role(
    restaurant_id,
    array['owner','admin','manager','staff']::public.restaurant_role[]
  )
  or public.is_super_admin()
);

drop policy if exists orders_member_read on public.orders;
create policy orders_member_read
on public.orders for select to authenticated
using (
  public.has_restaurant_role(
    restaurant_id,
    array['owner','admin','manager','staff','kitchen']::public.restaurant_role[]
  )
  or public.is_super_admin()
);

drop policy if exists order_items_member_read on public.order_items;
create policy order_items_member_read
on public.order_items for select to authenticated
using (
  exists (
    select 1
    from public.orders as target_order
    where target_order.id = order_items.order_id
      and (
        public.has_restaurant_role(
          target_order.restaurant_id,
          array['owner','admin','manager','staff','kitchen']::public.restaurant_role[]
        )
        or public.is_super_admin()
      )
  )
);

drop policy if exists order_status_history_member_read on public.order_status_history;
create policy order_status_history_member_read
on public.order_status_history for select to authenticated
using (
  exists (
    select 1
    from public.orders as target_order
    where target_order.id = order_status_history.order_id
      and (
        public.has_restaurant_role(
          target_order.restaurant_id,
          array['owner','admin','manager','staff','kitchen']::public.restaurant_role[]
        )
        or public.is_super_admin()
      )
  )
);

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
        and public.has_restaurant_role(
          restaurant_driver.restaurant_id,
          array['owner','admin','manager']::public.restaurant_role[]
        )
    )
    or exists (
      select 1
      from public.deliveries as delivery
      where (
        delivery.offered_driver_id = requested_driver_id
        or delivery.driver_id = requested_driver_id
      )
        and public.has_restaurant_role(
          delivery.restaurant_id,
          array['owner','admin','manager']::public.restaurant_role[]
        )
    );
$$;

drop policy if exists restaurant_drivers_read on public.restaurant_drivers;
create policy restaurant_drivers_read
on public.restaurant_drivers for select to authenticated
using (
  public.has_restaurant_role(
    restaurant_id,
    array['owner','admin','manager']::public.restaurant_role[]
  )
  or public.is_current_driver(driver_id)
  or public.is_super_admin()
);

drop policy if exists driver_earnings_read on public.driver_earnings;
create policy driver_earnings_read
on public.driver_earnings for select to authenticated
using (
  public.has_restaurant_role(
    restaurant_id,
    array['owner','admin','manager']::public.restaurant_role[]
  )
  or public.is_current_driver(driver_id)
  or public.is_super_admin()
);

drop policy if exists deliveries_restaurant_read on public.deliveries;
create policy deliveries_restaurant_read
on public.deliveries for select to authenticated
using (
  public.has_restaurant_role(
    restaurant_id,
    array['owner','admin','manager','staff']::public.restaurant_role[]
  )
  or public.is_current_driver(offered_driver_id)
  or public.is_current_driver(driver_id)
  or public.is_super_admin()
);

drop policy if exists drivers_member_read on public.drivers;
create policy drivers_member_read
on public.drivers for select to authenticated
using (
  public.is_current_driver(id)
  or public.can_restaurant_view_driver(id)
  or public.is_super_admin()
);

