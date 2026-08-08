-- Contactos comerciais públicos e permissões administrativas complementares.

do $$ begin
  create type public.commercial_lead_status as enum (
    'new',
    'contacted',
    'qualified',
    'won',
    'lost'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.commercial_leads (
  id uuid primary key default gen_random_uuid(),
  contact_name text not null,
  restaurant_name text not null,
  email text not null,
  phone text,
  city text,
  message text,
  status public.commercial_lead_status not null default 'new',
  internal_notes text,
  assigned_to uuid references public.profiles(id) on delete set null,
  contacted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commercial_leads_contact_name_length
    check (length(trim(contact_name)) between 2 and 100),
  constraint commercial_leads_restaurant_name_length
    check (length(trim(restaurant_name)) between 2 and 120),
  constraint commercial_leads_email_format
    check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

create index if not exists commercial_leads_status_idx
  on public.commercial_leads(status, created_at desc);
create index if not exists commercial_leads_email_idx
  on public.commercial_leads(lower(email), created_at desc);

create trigger commercial_leads_set_updated_at
before update on public.commercial_leads
for each row execute function public.set_updated_at();

create or replace function public.submit_commercial_lead(
  requested_contact_name text,
  requested_restaurant_name text,
  requested_email text,
  requested_phone text default null,
  requested_city text default null,
  requested_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text;
  inserted_id uuid;
begin
  normalized_email := lower(trim(coalesce(requested_email, '')));

  if length(trim(coalesce(requested_contact_name, ''))) not between 2 and 100 then
    raise exception 'Indique o seu nome.';
  end if;
  if length(trim(coalesce(requested_restaurant_name, ''))) not between 2 and 120 then
    raise exception 'Indique o nome do restaurante.';
  end if;
  if normalized_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Indique um e-mail válido.';
  end if;
  if exists (
    select 1 from public.commercial_leads
    where lower(email) = normalized_email
      and created_at > now() - interval '10 minutes'
  ) then
    raise exception 'Já recebemos este pedido. Aguarde alguns minutos.';
  end if;

  insert into public.commercial_leads (
    contact_name,
    restaurant_name,
    email,
    phone,
    city,
    message
  )
  values (
    trim(requested_contact_name),
    trim(requested_restaurant_name),
    normalized_email,
    nullif(trim(coalesce(requested_phone, '')), ''),
    nullif(trim(coalesce(requested_city, '')), ''),
    nullif(trim(coalesce(requested_message, '')), '')
  )
  returning id into inserted_id;

  return inserted_id;
end;
$$;

revoke all on function public.submit_commercial_lead(text, text, text, text, text, text)
from public;
grant execute on function public.submit_commercial_lead(text, text, text, text, text, text)
to anon, authenticated;

alter table public.commercial_leads enable row level security;

create policy commercial_leads_admin_read
on public.commercial_leads
for select
to authenticated
using (public.is_super_admin());

create policy commercial_leads_admin_update
on public.commercial_leads
for update
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy commercial_leads_admin_delete
on public.commercial_leads
for delete
to authenticated
using (public.is_super_admin());

create policy restaurant_subscriptions_admin_update
on public.restaurant_subscriptions
for update
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

