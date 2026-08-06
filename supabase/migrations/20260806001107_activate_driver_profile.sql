create or replace function public.activate_current_user_as_driver()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid;
  current_restaurant_id uuid;
  current_driver_id uuid;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Utilizador não autenticado';
  end if;

  select restaurant_id
  into current_restaurant_id
  from public.restaurant_users
  where user_id = current_user_id
    and is_active = true
  limit 1;

  if current_restaurant_id is null then
    raise exception 'Utilizador não pertence a nenhum restaurante';
  end if;

  insert into public.drivers (
    restaurant_id,
    user_id,
    status,
    is_active
  )
  values (
    current_restaurant_id,
    current_user_id,
    'available',
    true
  )
  on conflict (restaurant_id, user_id)
  do update set
    status = 'available',
    is_active = true,
    updated_at = now()
  returning id into current_driver_id;

  return current_driver_id;
end;
$$;

grant execute on function public.activate_current_user_as_driver()
to authenticated;
