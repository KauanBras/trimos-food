-- =========================================================
-- TRIMOS FOOD
-- HARDENING FINAL DE PAGAMENTOS E DISPATCH
-- =========================================================

-- ---------------------------------------------------------
-- 1. O motor de dispatch não deve ser chamado diretamente
--    pelo frontend/utilizador autenticado.
--    Continua disponível internamente para funções
--    SECURITY DEFINER que executam o fluxo autorizado.
-- ---------------------------------------------------------

revoke all on function
  public.dispatch_next_driver(uuid)
from public, anon, authenticated;

-- ---------------------------------------------------------
-- 2. As RPCs auxiliares Stripe são internas.
--
-- O cliente público continua a iniciar o pagamento através
-- de /api/payments/stripe/checkout.
--
-- Apenas o backend com service_role pode consultar os dados
-- internos do checkout ou associar uma sessão Stripe.
-- ---------------------------------------------------------

revoke all on function
  public.get_stripe_checkout_order(uuid, uuid)
from public, anon, authenticated;

grant execute on function
  public.get_stripe_checkout_order(uuid, uuid)
to service_role;

revoke all on function
  public.attach_stripe_checkout_session(uuid, uuid, text)
from public, anon, authenticated;

grant execute on function
  public.attach_stripe_checkout_session(uuid, uuid, text)
to service_role;

-- ---------------------------------------------------------
-- 3. record_stripe_payment permanece exclusivamente
--    acessível ao backend/service_role.
-- ---------------------------------------------------------

revoke all on function
  public.record_stripe_payment(text, text, text, boolean, text)
from public, anon, authenticated;

grant execute on function
  public.record_stripe_payment(text, text, text, boolean, text)
to service_role;
