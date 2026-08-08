-- O endpoint de push passa a receber apenas o ID da entrega. A Edge Function
-- valida e reivindica atomicamente a oferta antes de montar a mensagem.

alter table public.deliveries
  add column if not exists push_notified_at timestamptz;

create or replace function public.reset_delivery_push_claim()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.offered_driver_id is distinct from new.offered_driver_id then
    new.push_notified_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists deliveries_reset_push_claim on public.deliveries;
create trigger deliveries_reset_push_claim
before update of offered_driver_id on public.deliveries
for each row execute function public.reset_delivery_push_claim();

create or replace function public.notify_driver_delivery_offer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_id bigint;
begin
  if new.status <> 'offered' or new.offered_driver_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and old.status = 'offered'
    and old.offered_driver_id is not distinct from new.offered_driver_id then
    return new;
  end if;

  select net.http_post(
    url := 'https://idgjixysrjuoarwvxtmf.supabase.co/functions/v1/send-driver-push',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('delivery_id', new.id)
  ) into request_id;

  return new;
end;
$$;

drop trigger if exists deliveries_send_push_on_offer on public.deliveries;
create trigger deliveries_send_push_on_offer
after insert or update of status, offered_driver_id
on public.deliveries
for each row execute function public.notify_driver_delivery_offer();
