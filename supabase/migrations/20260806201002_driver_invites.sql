-- =========================================================
-- TRIMOS FOOD
-- CONVITES SEGUROS PARA ESTAFETAS
-- =========================================================

create table public.driver_invites (
  id uuid primary key default gen_random_uuid(),

  restaurant_id uuid not null
    references public.restaurants(id) on delete cascade,

  email text not null,
  token uuid not null default gen_random_uuid() unique,

  created_by uuid not null
    references public.profiles(id) on delete cascade,

  expires_at timestamptz not null
    default (now() + interval '7 days'),

  accepted_at timestamptz,
  accepted_by uuid
    references public.profiles(id) on delete set null,

  created_at timestamptz not null default now(),

  unique (restaurant_id, email)
);

create index driver_invites_token_idx
  on public.driver_invites(token);

create index driver_invites_email_idx
  on public.driver_invites(lower(email));

alter table public.driver_invites enable row level security;

create policy driver_invites_restaurant_read
on public.driver_invites
for select
to authenticated
using (
  public.is_restaurant_member(restaurant_id)
  or public.is_super_admin()
);

create policy driver_invites_restaurant_insert
on public.driver_invites
for insert
to authenticated
with check (
  public.is_restaurant_member(restaurant_id)
  or public.is_super_admin()
);

create policy driver_invites_restaurant_update
on public.driver_invites
for update
to authenticated
using (
  public.is_restaurant_member(restaurant_id)
  or public.is_super_admin()
)
with check (
  public.is_restaurant_member(restaurant_id)
  or public.is_super_admin()
);

-- =========================================================
-- ACEITAR CONVITE APÓS O LOGIN/CONFIRMAÇÃO
-- =========================================================

create or replace function public.accept_driver_invite(
  requested_token uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid;
  current_email text;
  selected_invite public.driver_invites;
  created_driver_id uuid;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'É necessário iniciar sessão';
  end if;

  select email
  into current_email
  from auth.users
  where id = current_user_id;

  select *
  into selected_invite
  from public.driver_invites
  where token = requested_token
  for update;

  if selected_invite.id is null then
    raise exception 'Convite não encontrado';
  end if;

  if selected_invite.accepted_at is not null then
    raise exception 'Este convite já foi utilizado';
  end if;

  if selected_invite.expires_at <= now() then
    raise exception 'Este convite expirou';
  end if;

  if lower(selected_invite.email) <> lower(current_email) then
    raise exception 'Este convite pertence a outro endereço de e-mail';
  end if;

  insert into public.drivers (
    restaurant_id,
    user_id,
    status,
    is_active
  )
  values (
    selected_invite.restaurant_id,
    current_user_id,
    'available',
    true
  )
  on conflict (restaurant_id, user_id)
  do update set
    status = 'available',
    is_active = true
  returning id into created_driver_id;

  update public.driver_invites
  set
    accepted_at = now(),
    accepted_by = current_user_id
  where id = selected_invite.id;

  return created_driver_id;
end;
$$;

grant execute on function public.accept_driver_invite(uuid)
to authenticated;
