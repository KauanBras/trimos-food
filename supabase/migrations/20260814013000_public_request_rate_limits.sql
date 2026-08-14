-- Atomic, server-only counters used by public API routes.
create table if not exists public.public_request_rate_limits (
  key_hash text not null,
  action text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 1,
  primary key (key_hash, action, window_started_at)
);

alter table public.public_request_rate_limits enable row level security;
revoke all on public.public_request_rate_limits from public, anon, authenticated;

create or replace function public.consume_public_rate_limit(
  requested_key_hash text,
  requested_action text,
  requested_limit integer,
  requested_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  window_start timestamptz;
  current_count integer;
begin
  if auth.role() <> 'service_role' then raise exception 'Acesso negado.'; end if;
  if requested_limit < 1 or requested_window_seconds < 10 then raise exception 'Limite inválido.'; end if;

  window_start := to_timestamp(
    floor(extract(epoch from now()) / requested_window_seconds) * requested_window_seconds
  );

  insert into public.public_request_rate_limits (
    key_hash, action, window_started_at, request_count
  ) values (
    requested_key_hash, requested_action, window_start, 1
  )
  on conflict (key_hash, action, window_started_at)
  do update set request_count = public.public_request_rate_limits.request_count + 1
  returning request_count into current_count;

  delete from public.public_request_rate_limits
  where window_started_at < now() - interval '2 days';

  return current_count <= requested_limit;
end;
$$;

revoke all on function public.consume_public_rate_limit(text, text, integer, integer) from public;
grant execute on function public.consume_public_rate_limit(text, text, integer, integer) to service_role;
