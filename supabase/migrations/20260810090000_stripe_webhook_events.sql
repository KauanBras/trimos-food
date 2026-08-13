-- Registo de eventos processados para tornar os webhooks Stripe idempotentes.
create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  scope text not null check (scope in ('platform', 'connect')),
  event_type text not null,
  stripe_account_id text,
  processed_at timestamptz not null default now()
);

create index if not exists stripe_webhook_events_processed_idx
  on public.stripe_webhook_events(processed_at desc);

alter table public.stripe_webhook_events enable row level security;
revoke all on public.stripe_webhook_events from public, anon, authenticated;
