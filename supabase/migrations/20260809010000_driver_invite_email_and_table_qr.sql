-- Convites automáticos de estafetas e menus QR identificados por mesa.

create table public.restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  code text not null default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
  seats integer not null default 2 check (seats between 1 and 100),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurant_tables_name_length check (length(trim(name)) between 1 and 60),
  constraint restaurant_tables_code_format check (code ~ '^[A-Z0-9]{8,40}$'),
  unique (restaurant_id, name),
  unique (code)
);

create index restaurant_tables_restaurant_sort_idx
on public.restaurant_tables (restaurant_id, sort_order, name);

alter table public.restaurant_tables enable row level security;

create policy restaurant_tables_member_read
on public.restaurant_tables for select to authenticated
using (public.is_restaurant_member(restaurant_id) or public.is_super_admin());

create policy restaurant_tables_manager_insert
on public.restaurant_tables for insert to authenticated
with check (
  public.is_super_admin()
  or public.has_restaurant_role(
    restaurant_id,
    array['owner', 'admin', 'manager']::public.restaurant_role[]
  )
);

create policy restaurant_tables_manager_update
on public.restaurant_tables for update to authenticated
using (
  public.is_super_admin()
  or public.has_restaurant_role(
    restaurant_id,
    array['owner', 'admin', 'manager']::public.restaurant_role[]
  )
)
with check (
  public.is_super_admin()
  or public.has_restaurant_role(
    restaurant_id,
    array['owner', 'admin', 'manager']::public.restaurant_role[]
  )
);

create policy restaurant_tables_manager_delete
on public.restaurant_tables for delete to authenticated
using (
  public.is_super_admin()
  or public.has_restaurant_role(
    restaurant_id,
    array['owner', 'admin', 'manager']::public.restaurant_role[]
  )
);

create trigger restaurant_tables_set_updated_at
before update on public.restaurant_tables
for each row execute function public.set_updated_at();

alter table public.orders
  add column restaurant_table_id uuid references public.restaurant_tables(id) on delete set null,
  add column table_label text;

create index orders_restaurant_table_idx
on public.orders (restaurant_id, restaurant_table_id, created_at desc)
where restaurant_table_id is not null;

create or replace function public.resolve_public_table(
  requested_restaurant_slug text,
  requested_table_code text
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', target_table.id,
    'name', target_table.name,
    'code', target_table.code,
    'seats', target_table.seats,
    'restaurantId', restaurant.id,
    'restaurantSlug', restaurant.slug,
    'restaurantName', restaurant.name
  )
  from public.restaurant_tables as target_table
  join public.restaurants as restaurant on restaurant.id = target_table.restaurant_id
  where restaurant.slug = trim(requested_restaurant_slug)
    and restaurant.status = 'active'
    and target_table.code = upper(trim(requested_table_code))
    and target_table.is_active;
$$;

revoke all on function public.resolve_public_table(text, text) from public;
grant execute on function public.resolve_public_table(text, text) to anon, authenticated;

-- Mantém a assinatura pública já utilizada, mas passa a aceitar dine_in.
-- A identificação da mesa é transportada num marcador interno removido pelo trigger.
do $$
declare
  current_definition text;
  updated_definition text;
  previous_fragment text := $fragment$
  if requested_type = 'pickup' and not target_restaurant.accepts_pickup then raise exception 'Este restaurante não aceita levantamento.'; end if;
  if requested_type not in ('delivery', 'pickup') then raise exception 'Tipo de pedido inválido.'; end if;
$fragment$;
  next_fragment text := $fragment$
  if requested_type = 'pickup' and not target_restaurant.accepts_pickup then raise exception 'Este restaurante não aceita levantamento.'; end if;
  if requested_type = 'dine_in' and not target_restaurant.accepts_dine_in then raise exception 'Este restaurante não aceita pedidos na mesa.'; end if;
  if requested_type not in ('delivery', 'pickup', 'dine_in') then raise exception 'Tipo de pedido inválido.'; end if;
$fragment$;
begin
  select pg_get_functiondef(
    'public.create_public_order(uuid,text,text,text,public.order_type,text,numeric,numeric,text,jsonb,public.payment_method,numeric)'::regprocedure
  ) into current_definition;

  updated_definition := replace(current_definition, previous_fragment, next_fragment);
  if updated_definition = current_definition then
    raise exception 'Não foi possível atualizar create_public_order para pedidos na mesa.';
  end if;
  execute updated_definition;
end;
$$;

create or replace function public.apply_dine_in_table_context()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_code text;
  selected_table public.restaurant_tables%rowtype;
begin
  if new.type <> 'dine_in' then
    return new;
  end if;

  requested_code := substring(
    coalesce(new.notes, '')
    from '^\[\[TRIMOS_TABLE:([A-Z0-9]{8,40})\]\]'
  );

  if requested_code is null then
    raise exception 'Abra o menu através do QR Code válido da mesa.';
  end if;

  select * into selected_table
  from public.restaurant_tables
  where restaurant_id = new.restaurant_id
    and code = requested_code
    and is_active;

  if selected_table.id is null then
    raise exception 'A mesa indicada já não está disponível.';
  end if;

  new.restaurant_table_id := selected_table.id;
  new.table_label := selected_table.name;
  new.notes := nullif(trim(regexp_replace(
    coalesce(new.notes, ''),
    '^\[\[TRIMOS_TABLE:[A-Z0-9]{8,40}\]\]\s*',
    ''
  )), '');
  return new;
end;
$$;

create trigger orders_apply_dine_in_table_context
before insert on public.orders
for each row execute function public.apply_dine_in_table_context();

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
      from public.order_items as item where item.order_id = target_order.id
    ), '[]'::jsonb)
  )
  from public.orders as target_order
  where target_order.id = requested_order_id
    and target_order.public_token = requested_order_token;
$$;

revoke all on function public.get_public_order_status(uuid, uuid) from public;
grant execute on function public.get_public_order_status(uuid, uuid) to anon, authenticated;
