-- Liga o catálogo comercial do Trimos Food aos produtos e preços Stripe
-- em modo de produção. Os valores e limites dos planos não são alterados.

update public.subscription_plans
set
  stripe_product_id = 'prod_V2NptUy2mIAkxt',
  stripe_monthly_price_id = 'price_1U45sFE3M2iDzBGhEciapzJ9',
  stripe_yearly_price_id = 'price_1U45sFE3M2iDzBGhiIuYR7p0'
where code = 'essencial';

update public.subscription_plans
set
  stripe_product_id = 'prod_V2NqQTYO6p6ElZ',
  stripe_monthly_price_id = 'price_1U45sEE3M2iDzBGh5OS9HBhP',
  stripe_yearly_price_id = 'price_1U45sEE3M2iDzBGhd2L0b5RB'
where code = 'profissional';

update public.subscription_plans
set
  stripe_product_id = 'prod_V2NqfmpWkY0Jzm',
  stripe_monthly_price_id = 'price_1U45sEE3M2iDzBGhshHvQnf9',
  stripe_yearly_price_id = 'price_1U45sDE3M2iDzBGhkvZQt9bV'
where code = 'escala';
