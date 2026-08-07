-- =========================================================
-- TRIMOS FOOD
-- PERMITE AO ESTAFETA REGISTAR A PRÓPRIA SUBSCRIÇÃO PUSH
-- =========================================================

drop policy if exists push_subscriptions_insert_own
on public.push_subscriptions;

create policy push_subscriptions_insert_own
on public.push_subscriptions
for insert
to authenticated
with check (
  user_id = auth.uid()
  and (
    public.is_restaurant_member(restaurant_id)
    or exists (
      select 1
      from public.drivers d
      where d.id = driver_id
        and d.user_id = auth.uid()
        and d.restaurant_id = restaurant_id
        and d.is_active = true
    )
    or public.is_super_admin()
  )
);

drop policy if exists push_subscriptions_update_own
on public.push_subscriptions;

create policy push_subscriptions_update_own
on public.push_subscriptions
for update
to authenticated
using (
  user_id = auth.uid()
  or public.is_super_admin()
)
with check (
  (
    user_id = auth.uid()
    and (
      public.is_restaurant_member(restaurant_id)
      or exists (
        select 1
        from public.drivers d
        where d.id = driver_id
          and d.user_id = auth.uid()
          and d.restaurant_id = restaurant_id
          and d.is_active = true
      )
    )
  )
  or public.is_super_admin()
);
