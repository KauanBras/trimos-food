-- Limpeza única dos registos gerados pela automação de testes e aplicação
-- da configuração de entrega confirmada pelo proprietário da Hirotatsu.

do $$
declare
  hirotatsu_restaurant_id uuid;
begin
  select id
  into hirotatsu_restaurant_id
  from public.restaurants
  where slug = 'hirotatsu-sushi';

  if hirotatsu_restaurant_id is not null then
    delete from public.orders
    where restaurant_id = hirotatsu_restaurant_id
      and customer_name ilike 'Cliente Teste%';

    delete from public.customers as customer
    where customer.restaurant_id = hirotatsu_restaurant_id
      and customer.name ilike 'Cliente Teste%'
      and not exists (
        select 1
        from public.orders as customer_order
        where customer_order.customer_id = customer.id
      )
      and not exists (
        select 1
        from public.reservations as customer_reservation
        where customer_reservation.customer_id = customer.id
      );

    update public.restaurant_settings
    set
      default_delivery_fee = 4.90,
      delivery_fee_per_km = 2.45,
      delivery_radius_km = 3,
      free_delivery_from = null,
      updated_at = now()
    where restaurant_id = hirotatsu_restaurant_id;
  end if;
end;
$$;
