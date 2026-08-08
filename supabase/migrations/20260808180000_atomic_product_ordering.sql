-- Guarda a ordem completa do menu numa única operação para evitar estados parciais.

create or replace function public.reorder_restaurant_products(
  requested_restaurant_id uuid,
  requested_product_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_count integer;
  provided_count integer;
begin
  if not (
    public.is_super_admin()
    or public.has_restaurant_role(
      requested_restaurant_id,
      array['owner','admin','manager']::public.restaurant_role[]
    )
  ) then
    raise exception 'Não tem permissão para ordenar este menu.';
  end if;

  select count(*) into expected_count
  from public.products
  where restaurant_id = requested_restaurant_id;

  select count(distinct product_id) into provided_count
  from unnest(requested_product_ids) as product_id;

  if cardinality(requested_product_ids) <> expected_count
    or provided_count <> expected_count
    or exists (
      select 1
      from unnest(requested_product_ids) as product_id
      where not exists (
        select 1 from public.products as product
        where product.id = product_id
          and product.restaurant_id = requested_restaurant_id
      )
    ) then
    raise exception 'A ordem enviada não corresponde aos produtos deste restaurante.';
  end if;

  update public.products as product
  set sort_order = ordered_product.position - 1,
      updated_at = now()
  from unnest(requested_product_ids) with ordinality
    as ordered_product(product_id, position)
  where product.id = ordered_product.product_id
    and product.restaurant_id = requested_restaurant_id;
end;
$$;

revoke all on function public.reorder_restaurant_products(uuid, uuid[])
from public, anon;
grant execute on function public.reorder_restaurant_products(uuid, uuid[])
to authenticated;
