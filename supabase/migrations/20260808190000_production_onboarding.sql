-- Torna o onboarding seguro e reutilizável para vários restaurantes da cidade.

create or replace function public.create_restaurant_for_current_user(
  restaurant_name text,
  restaurant_slug text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_restaurant_id uuid;
  current_user_id uuid;
  final_slug text;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Utilizador não autenticado';
  end if;

  if length(trim(coalesce(restaurant_name, ''))) < 2
    or length(trim(restaurant_name)) > 100 then
    raise exception 'Indique um nome de restaurante válido.';
  end if;

  if restaurant_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Não foi possível gerar um endereço válido.';
  end if;

  if exists (
    select 1
    from public.restaurant_users
    where user_id = current_user_id
      and is_active = true
  ) then
    raise exception 'Este utilizador já pertence a um restaurante';
  end if;

  final_slug := restaurant_slug;
  if exists (select 1 from public.restaurants where slug = final_slug) then
    final_slug := final_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  end if;

  insert into public.restaurants (
    name,
    slug,
    status,
    accepts_delivery,
    accepts_pickup,
    accepts_dine_in,
    accepts_reservations,
    created_by
  )
  values (
    trim(restaurant_name),
    final_slug,
    'active',
    true,
    true,
    true,
    true,
    current_user_id
  )
  returning id into new_restaurant_id;

  insert into public.restaurant_users (
    restaurant_id,
    user_id,
    role,
    is_active
  )
  values (
    new_restaurant_id,
    current_user_id,
    'owner',
    true
  );

  return new_restaurant_id;
end;
$$;

revoke all on function public.create_restaurant_for_current_user(text, text)
from public, anon;
grant execute on function public.create_restaurant_for_current_user(text, text)
to authenticated;
