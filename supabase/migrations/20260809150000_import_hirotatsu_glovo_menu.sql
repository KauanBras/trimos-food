-- Replace the active Hirotatsu catalogue with the public Glovo menu captured
-- from https://glovoapp.com/pt/pt/covilha/stores/hirotatsu-sushi-cov on 2026-08-09.
-- Existing catalogue rows are kept inactive as a recoverable logical backup.

do $$
declare
  target_restaurant_id uuid;
  category_record jsonb;
  product_record jsonb;
  target_category_id uuid;
  target_product_id uuid;
begin
  select restaurant.id
    into target_restaurant_id
  from public.restaurants as restaurant
  where restaurant.slug = 'hirotatsu-sushi'
  limit 1;

  if target_restaurant_id is null then
    raise exception 'Hirotatsu restaurant not found';
  end if;

  -- Keep the previous catalogue recoverable without showing it to customers.
  update public.products
  set is_active = false,
      is_available = false
  where restaurant_id = target_restaurant_id;

  update public.categories
  set is_active = false
  where restaurant_id = target_restaurant_id;

  for category_record in
    select value
    from jsonb_array_elements(
      jsonb_build_array(
        jsonb_build_object(
          'name', 'Entradas',
          'description', 'Entradas para começar a refeição.',
          'sort_order', 0,
          'products', jsonb_build_array(
            jsonb_build_object(
              'name', 'Gyoza 5 unidades',
              'description', 'Pastéis de massa fina, fritos ou cozidos a vapor, recheados com frango e/ou legumes. Acompanha molho criado especialmente para as gyozas.',
              'price', 5.90,
              'image_url', 'https://glovo.dhmedia.io/image/menus-glovo/products/e6da30b359bb7135944cfa892c4da6f34e3f13925c126eccb5bb53ebf4eb1231?t=W3sicmVzaXplIjp7Im1vZGUiOiJmaXQiLCJ3aWR0aCI6MzIwLCJoZWlnaHQiOjMyMH19LHsid2VicCI6e319XQ=='
            )
          )
        ),
        jsonb_build_object(
          'name', 'Sashimi',
          'description', 'Peixe fresco cuidadosamente fatiado.',
          'sort_order', 1,
          'products', jsonb_build_array(
            jsonb_build_object(
              'name', 'Salmão',
              'description', '6 unidades de sashimi de salmão.',
              'price', 6.00,
              'image_url', 'https://glovo.dhmedia.io/image/global-menu-service/GV_PT/vendor/609924/product/17832115083/e15fe6a8-1606-499a-92d1-a7b65b32e3bd.jpg?t=W3sicmVzaXplIjp7Im1vZGUiOiJmaXQiLCJ3aWR0aCI6MzIwLCJoZWlnaHQiOjMyMH19LHsid2VicCI6e319XQ=='
            )
          )
        ),
        jsonb_build_object(
          'name', 'Temaki',
          'description', 'Cones de alga nori preparados no momento.',
          'sort_order', 2,
          'products', jsonb_build_array(
            jsonb_build_object(
              'name', 'Temaki Hot Crock',
              'description', 'Temaki totalmente empanado e frito, queijo Philadelphia, cebolinho, teriyaki e sementes de sésamo.',
              'price', 9.50,
              'image_url', 'https://glovo.dhmedia.io/image/global-menu-service/GV_PT/vendor/609924/PRODUCT/17832038591/b46fb70b-8d83-4401-a4c5-bec05538815a.jpg?t=W3sicmVzaXplIjp7Im1vZGUiOiJmaXQiLCJ3aWR0aCI6MzIwLCJoZWlnaHQiOjMyMH19LHsid2VicCI6e319XQ=='
            ),
            jsonb_build_object(
              'name', 'Temaki Salmão Cheese',
              'description', 'Salmão, arroz japonês, queijo cremoso, cebolinho e sementes de sésamo.',
              'price', 8.90,
              'image_url', 'https://glovo.dhmedia.io/image/menus-glovo/products/72e84cef5abc118aae84aaa99b4c2c9f3dac21a8635bcdf05f2f9137d0e7f6ed?t=W3sicmVzaXplIjp7Im1vZGUiOiJmaXQiLCJ3aWR0aCI6MzIwLCJoZWlnaHQiOjMyMH19LHsid2VicCI6e319XQ=='
            ),
            jsonb_build_object(
              'name', 'Temaki Salmão Grelhado',
              'description', 'Salmão grelhado, Philadelphia, cebolinho, teriyaki e sésamo.',
              'price', 8.90,
              'image_url', 'https://glovo.dhmedia.io/image/global-menu-service/GV_PT/vendor/609924/PRODUCT/40860061878/cce19a32-0176-4257-9390-bc20336937fb.jpg?t=W3sicmVzaXplIjp7Im1vZGUiOiJmaXQiLCJ3aWR0aCI6MzIwLCJoZWlnaHQiOjMyMH19LHsid2VicCI6e319XQ=='
            ),
            jsonb_build_object(
              'name', 'Temaki Salmão',
              'description', 'Salmão, arroz japonês, cebolinho e sementes de sésamo.',
              'price', 7.90,
              'image_url', 'https://glovo.dhmedia.io/image/menus-glovo/products/9fcd013acf1eb89cccb20150052297908c5bf6c430bb0b8fb870fcec121c72a6?t=W3sicmVzaXplIjp7Im1vZGUiOiJmaXQiLCJ3aWR0aCI6MzIwLCJoZWlnaHQiOjMyMH19LHsid2VicCI6e319XQ=='
            )
          )
        ),
        jsonb_build_object(
          'name', 'Combo Mix',
          'description', 'Seleções variadas de sushi para partilhar.',
          'sort_order', 3,
          'products', jsonb_build_array(
            jsonb_build_object(
              'name', 'Super Hiro 44 peças',
              'description', '6 sashimis, 6 nigiris, 4 gunkans, 8 makis, 8 uramakis e 12 hot rolls.',
              'price', 35.90,
              'image_url', 'https://glovo.dhmedia.io/image/menus-glovo/products/641b2cf1d6ef9976610c2dd3331a7c7e26c4679e8874819a05a21b4114c7b554?t=W3sicmVzaXplIjp7Im1vZGUiOiJmaXQiLCJ3aWR0aCI6MzIwLCJoZWlnaHQiOjMyMH19LHsid2VicCI6e319XQ=='
            ),
            jsonb_build_object(
              'name', 'Sushi Mix Hiro 24',
              'description', '5 sashimis, 8 uramakis mix, 4 makis, 4 nigiris e 3 gunkans.',
              'price', 23.90,
              'image_url', 'https://glovo.dhmedia.io/image/menus-glovo/products/9b7fcd8021b9611117cc0436761251785613b9225766a12b9af3eb34cbcca902?t=W3sicmVzaXplIjp7Im1vZGUiOiJmaXQiLCJ3aWR0aCI6MzIwLCJoZWlnaHQiOjMyMH19LHsid2VicCI6e319XQ=='
            ),
            jsonb_build_object(
              'name', 'Combo Mix 1',
              'description', '1 temaki de salmão e 16 peças de sushi mix.',
              'price', 21.17,
              'image_url', 'https://glovo.dhmedia.io/image/global-menu-service/GV_PT/vendor/609924/PRODUCT/17832119248/7e61f3f0-51ee-4125-ba37-9ec48dc5e9b6.jpeg?t=W3sicmVzaXplIjp7Im1vZGUiOiJmaXQiLCJ3aWR0aCI6MzIwLCJoZWlnaHQiOjMyMH19LHsid2VicCI6e319XQ=='
            ),
            jsonb_build_object(
              'name', 'Sushi Box 20 Peças Veggie',
              'description', 'Seleção de 20 peças de sushi vegetariano.',
              'price', 19.90,
              'image_url', 'https://glovo.dhmedia.io/image/menus-glovo/products/df77ed277c0d7786f0618763e4fdb93e37908172e6ccdccd4a485bf9707aa48a?t=W3sicmVzaXplIjp7Im1vZGUiOiJmaXQiLCJ3aWR0aCI6MzIwLCJoZWlnaHQiOjMyMH19LHsid2VicCI6e319XQ=='
            ),
            jsonb_build_object(
              'name', 'Sushi Box 20 peças',
              'description', '4 nigiris, 4 makis, 8 uramakis e 4 hot rolls.',
              'price', 16.92,
              'image_url', 'https://glovo.dhmedia.io/image/menus-glovo/products/4dab314bfa02eff7ed63c35e5a75e0ba7185b1e0a2a6261f802fadae2f3deab1?t=W3sicmVzaXplIjp7Im1vZGUiOiJmaXQiLCJ3aWR0aCI6MzIwLCJoZWlnaHQiOjMyMH19LHsid2VicCI6e319XQ=='
            )
          )
        ),
        jsonb_build_object(
          'name', 'Sushi',
          'description', 'Peças de sushi preparadas ao estilo Hirotatsu.',
          'sort_order', 4,
          'products', jsonb_build_array(
            jsonb_build_object(
              'name', 'Sushi Hot (16 unidades)',
              'description', 'Sushi hot mix com 16 peças.',
              'price', 16.06,
              'image_url', 'https://glovo.dhmedia.io/image/menus-glovo/products/612093b194ea9aaa94499938fac198f9d69dd8f37301749248d41965ace4eb41?t=W3sicmVzaXplIjp7Im1vZGUiOiJmaXQiLCJ3aWR0aCI6MzIwLCJoZWlnaHQiOjMyMH19LHsid2VicCI6e319XQ=='
            ),
            jsonb_build_object(
              'name', 'Uramaki Grelhado (8 unidades)',
              'description', 'Salmão completamente grelhado por dentro e por fora.',
              'price', 7.90,
              'image_url', 'https://glovo.dhmedia.io/image/global-menu-service/GV_PT/vendor/609924/product/40267769577/3ded1816-a76d-43e1-8cf4-c39cdda2033a.jpg?t=W3sicmVzaXplIjp7Im1vZGUiOiJmaXQiLCJ3aWR0aCI6MzIwLCJoZWlnaHQiOjMyMH19LHsid2VicCI6e319XQ=='
            ),
            jsonb_build_object(
              'name', 'Uramaki Salmão Philadelphia',
              'description', 'Salmão e Philadelphia, sem frutas.',
              'price', 7.90,
              'image_url', 'https://glovo.dhmedia.io/image/global-menu-service/GV_PT/vendor/609924/PRODUCT/40766231941/b9fa326e-135a-4bf2-878c-f37d0fcf83c5.jpg?t=W3sicmVzaXplIjp7Im1vZGUiOiJmaXQiLCJ3aWR0aCI6MzIwLCJoZWlnaHQiOjMyMH19LHsid2VicCI6e319XQ=='
            ),
            jsonb_build_object(
              'name', 'Uramaki Ebi Furai',
              'description', 'Camarão panado com ikura black, maionese, abacate e molho teriyaki.',
              'price', 6.90,
              'image_url', 'https://glovo.dhmedia.io/image/global-menu-service/GV_PT/vendor/609924/PRODUCT/40268051490/120cabb8-c05a-41e2-997c-8c3e11cd4eeb.jpg?t=W3sicmVzaXplIjp7Im1vZGUiOiJmaXQiLCJ3aWR0aCI6MzIwLCJoZWlnaHQiOjMyMH19LHsid2VicCI6e319XQ=='
            ),
            jsonb_build_object(
              'name', 'Hossomaki Salmão',
              'description', 'Rolo de salmão e arroz.',
              'price', 5.90,
              'image_url', 'https://glovo.dhmedia.io/image/global-menu-service/GV_PT/vendor/609924/product/40766252426/0a668919-b468-43b3-96e1-6f942b4270d3.jpg?t=W3sicmVzaXplIjp7Im1vZGUiOiJmaXQiLCJ3aWR0aCI6MzIwLCJoZWlnaHQiOjMyMH19LHsid2VicCI6e319XQ=='
            )
          )
        ),
        jsonb_build_object(
          'name', 'Poke Bowl',
          'description', 'Bowls frescas, completas e preparadas no momento.',
          'sort_order', 5,
          'products', jsonb_build_array(
            jsonb_build_object(
              'name', 'Poke Bowl Salmão',
              'description', 'Poke bowl de salmão.',
              'price', 12.90,
              'image_url', 'https://glovo.dhmedia.io/image/global-menu-service/GV_PT/vendor/609924/product/40272889973/a913bf89-cbb1-4f33-a94b-ae90dc76a3d9.jpg?t=W3sicmVzaXplIjp7Im1vZGUiOiJmaXQiLCJ3aWR0aCI6MzIwLCJoZWlnaHQiOjMyMH19LHsid2VicCI6e319XQ=='
            ),
            jsonb_build_object(
              'name', 'Poke Bowl Tofu',
              'description', 'Poke bowl com tofu marinado.',
              'price', 11.90,
              'image_url', 'https://glovo.dhmedia.io/image/global-menu-service/GV_PT/vendor/609924/product/832cf214-84fc-443a-b62e-3b503d507bcb.jpg?t=W3sicmVzaXplIjp7Im1vZGUiOiJmaXQiLCJ3aWR0aCI6MzIwLCJoZWlnaHQiOjMyMH19LHsid2VicCI6e319XQ=='
            ),
            jsonb_build_object(
              'name', 'Poke Bowl Camarão Panado',
              'description', 'Poke bowl com camarão panado.',
              'price', 11.90,
              'image_url', 'https://glovo.dhmedia.io/image/menus-glovo/products/b95ae56db8a85928faaefa8981a297bb4cc7f9dd0dccd888de2d3b925a9cce6b?t=W3sicmVzaXplIjp7Im1vZGUiOiJmaXQiLCJ3aWR0aCI6MzIwLCJoZWlnaHQiOjMyMH19LHsid2VicCI6e319XQ=='
            ),
            jsonb_build_object(
              'name', 'Poke Bowl Frango Tonkatsu',
              'description', 'Poke bowl com frango tonkatsu.',
              'price', 11.90,
              'image_url', 'https://glovo.dhmedia.io/image/global-menu-service/GV_PT/vendor/609924/product/40272938186/9a862590-ff45-45c9-9841-52adfde39317.jpg?t=W3sicmVzaXplIjp7Im1vZGUiOiJmaXQiLCJ3aWR0aCI6MzIwLCJoZWlnaHQiOjMyMH19LHsid2VicCI6e319XQ=='
            )
          )
        ),
        jsonb_build_object(
          'name', 'Novidade',
          'description', 'Criações especiais da Hirotatsu.',
          'sort_order', 6,
          'products', jsonb_build_array(
            jsonb_build_object(
              'name', 'Sushi Burger',
              'description', 'Arroz panado e frito, salmão, Philadelphia, abacate, sunomono e molho teriyaki.',
              'price', 9.50,
              'image_url', 'https://glovo.dhmedia.io/image/menus-glovo/products/da9246fd2d865bf03d4855dda5993f5a6ca8e2b7167fecc9a7b71f0fabd0fbe4?t=W3sicmVzaXplIjp7Im1vZGUiOiJmaXQiLCJ3aWR0aCI6MzIwLCJoZWlnaHQiOjMyMH19LHsid2VicCI6e319XQ=='
            ),
            jsonb_build_object(
              'name', 'Hot Dog de Salmão',
              'description', 'Hot dog de salmão ao estilo Hirotatsu.',
              'price', 8.50,
              'image_url', 'https://glovo.dhmedia.io/image/menus-glovo/products/ace0287f0f7a15ea078507a14480c0cae7466f9ff901dfcf054d3823f44dc04a?t=W3sicmVzaXplIjp7Im1vZGUiOiJmaXQiLCJ3aWR0aCI6MzIwLCJoZWlnaHQiOjMyMH19LHsid2VicCI6e319XQ=='
            )
          )
        ),
        jsonb_build_object(
          'name', 'Extra opcional',
          'description', 'Molhos e acessórios adicionais.',
          'sort_order', 7,
          'products', jsonb_build_array(
            jsonb_build_object(
              'name', 'Teriyaki',
              'description', 'Molho teriyaki.',
              'price', 0.90,
              'image_url', 'https://glovo.dhmedia.io/image/menus-glovo/products/4102d7f556df6d01d6a99d83623beaff482b215cb1c2d024c9e7de6a55a6029e?t=W3sicmVzaXplIjp7Im1vZGUiOiJmaXQiLCJ3aWR0aCI6MzIwLCJoZWlnaHQiOjMyMH19LHsid2VicCI6e319XQ=='
            ),
            jsonb_build_object(
              'name', 'Sweet Chilli',
              'description', 'Molho sweet chilli.',
              'price', 0.80,
              'image_url', 'https://glovo.dhmedia.io/image/menus-glovo/products/e43864603b2924a79b6690867b9738f688ce89bddcc8b97fcbffe40b612688ff?t=W3sicmVzaXplIjp7Im1vZGUiOiJmaXQiLCJ3aWR0aCI6MzIwLCJoZWlnaHQiOjMyMH19LHsid2VicCI6e319XQ=='
            ),
            jsonb_build_object(
              'name', 'Soja',
              'description', 'Molho de soja.',
              'price', 0.80,
              'image_url', 'https://glovo.dhmedia.io/image/global-menu-service/GV_PT/vendor/609924/PRODUCT/17858395091/724ae9a8-e709-4333-ae23-7c03771cd7b0.jpg?t=W3sicmVzaXplIjp7Im1vZGUiOiJmaXQiLCJ3aWR0aCI6MzIwLCJoZWlnaHQiOjMyMH19LHsid2VicCI6e319XQ=='
            ),
            jsonb_build_object(
              'name', 'Gengibre',
              'description', 'Porção extra de gengibre.',
              'price', 0.80,
              'image_url', 'https://glovo.dhmedia.io/image/menus-glovo/products/f74756fc437ebc735e79825da6d7cd44d9687fcb560598b62397f57fd94d86a1?t=W3sicmVzaXplIjp7Im1vZGUiOiJmaXQiLCJ3aWR0aCI6MzIwLCJoZWlnaHQiOjMyMH19LHsid2VicCI6e319XQ=='
            ),
            jsonb_build_object(
              'name', 'Pauzinho',
              'description', 'Par de pauzinhos.',
              'price', 0.50,
              'image_url', 'https://glovo.dhmedia.io/image/menus-glovo/products/3d543625346f5cf1d2ae5901d2c7cd3765b6604531e504cfeef181df1dd59b0f?t=W3sicmVzaXplIjp7Im1vZGUiOiJmaXQiLCJ3aWR0aCI6MzIwLCJoZWlnaHQiOjMyMH19LHsid2VicCI6e319XQ=='
            )
          )
        )
      )
    )
  loop
    select category.id
      into target_category_id
    from public.categories as category
    where category.restaurant_id = target_restaurant_id
      and lower(trim(category.name)) = lower(trim(category_record->>'name'))
    order by category.created_at
    limit 1;

    if target_category_id is null then
      insert into public.categories (
        restaurant_id,
        name,
        description,
        sort_order,
        is_active
      ) values (
        target_restaurant_id,
        category_record->>'name',
        category_record->>'description',
        (category_record->>'sort_order')::integer,
        true
      )
      returning id into target_category_id;
    else
      update public.categories
      set name = category_record->>'name',
          description = category_record->>'description',
          sort_order = (category_record->>'sort_order')::integer,
          is_active = true
      where id = target_category_id;
    end if;

    for product_record in
      select value || jsonb_build_object('product_sort_order', ordinality - 1)
      from jsonb_array_elements(category_record->'products') with ordinality
    loop
      select product.id
        into target_product_id
      from public.products as product
      where product.restaurant_id = target_restaurant_id
        and lower(trim(product.name)) = lower(trim(product_record->>'name'))
      order by product.created_at
      limit 1;

      if target_product_id is null then
        insert into public.products (
          restaurant_id,
          category_id,
          name,
          description,
          price,
          image_url,
          is_active,
          is_available,
          sort_order
        ) values (
          target_restaurant_id,
          target_category_id,
          product_record->>'name',
          product_record->>'description',
          (product_record->>'price')::numeric,
          product_record->>'image_url',
          true,
          true,
          (product_record->>'product_sort_order')::integer
        );
      else
        update public.products
        set category_id = target_category_id,
            name = product_record->>'name',
            description = product_record->>'description',
            price = (product_record->>'price')::numeric,
            image_url = product_record->>'image_url',
            is_active = true,
            is_available = true,
            sort_order = (product_record->>'product_sort_order')::integer
        where id = target_product_id;
      end if;
    end loop;
  end loop;
end;
$$;
