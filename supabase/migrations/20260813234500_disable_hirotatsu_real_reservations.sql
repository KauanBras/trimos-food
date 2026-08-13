-- A operação real da Hirotatsu trabalha apenas com delivery e takeaway.
-- A cópia de demonstração mantém reservas ativas para apresentações comerciais.
update public.restaurants
set accepts_reservations = false,
    updated_at = now()
where slug = 'hirotatsu-sushi'
  and is_demo = false;

update public.restaurants
set accepts_reservations = true,
    updated_at = now()
where slug = 'hirotatsu-sushi-demo'
  and is_demo = true;
