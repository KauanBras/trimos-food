-- Mantém a validação dos horários sem sombrear variáveis PL/pgSQL.

create or replace function public.replace_restaurant_business_hours(
  requested_restaurant_id uuid,
  requested_schedule jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  day_rows integer;
  closed_rows integer;
begin
  if not (
    public.is_super_admin()
    or public.has_restaurant_role(
      requested_restaurant_id,
      array['owner','admin','manager']::public.restaurant_role[]
    )
  ) then
    raise exception 'Não tem permissão para alterar os horários.';
  end if;

  if jsonb_typeof(requested_schedule) <> 'array'
    or jsonb_array_length(requested_schedule) < 7
    or jsonb_array_length(requested_schedule) > 35 then
    raise exception 'O horário semanal enviado é inválido.';
  end if;

  if (
    select count(distinct (entry->>'day_of_week')::integer)
    from jsonb_array_elements(requested_schedule) as item(entry)
  ) <> 7 then
    raise exception 'Configure todos os sete dias da semana.';
  end if;

  for current_day in 0..6 loop
    select count(*), count(*) filter (where (entry->>'is_closed')::boolean)
    into day_rows, closed_rows
    from jsonb_array_elements(requested_schedule) as item(entry)
    where (entry->>'day_of_week')::integer = current_day;

    if day_rows < 1 or day_rows > 4 then
      raise exception 'Cada dia deve ter entre um e quatro períodos.';
    end if;
    if closed_rows > 0 and (closed_rows <> 1 or day_rows <> 1) then
      raise exception 'Um dia fechado não pode ter períodos abertos.';
    end if;
  end loop;

  if exists (
    select 1
    from jsonb_array_elements(requested_schedule) as item(entry)
    where (entry->>'day_of_week')::integer not between 0 and 6
      or (entry->>'sort_order')::integer not between 0 and 3
      or (
        not (entry->>'is_closed')::boolean
        and (
          nullif(entry->>'opens_at', '') is null
          or nullif(entry->>'closes_at', '') is null
          or (entry->>'opens_at')::time = (entry->>'closes_at')::time
        )
      )
  ) then
    raise exception 'Existe um período de funcionamento inválido.';
  end if;

  delete from public.business_hours
  where restaurant_id = requested_restaurant_id;

  insert into public.business_hours (
    restaurant_id,
    day_of_week,
    opens_at,
    closes_at,
    is_closed,
    sort_order
  )
  select
    requested_restaurant_id,
    (entry->>'day_of_week')::smallint,
    case when (entry->>'is_closed')::boolean then null else (entry->>'opens_at')::time end,
    case when (entry->>'is_closed')::boolean then null else (entry->>'closes_at')::time end,
    (entry->>'is_closed')::boolean,
    (entry->>'sort_order')::integer
  from jsonb_array_elements(requested_schedule) as item(entry);
end;
$$;

revoke all on function public.replace_restaurant_business_hours(uuid, jsonb)
from public, anon;
grant execute on function public.replace_restaurant_business_hours(uuid, jsonb)
to authenticated;
