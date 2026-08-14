import { NextResponse } from "next/server";

import {
  getSiteUrl,
  getStripe,
  isStripeAccountAccessError,
} from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

type CheckoutOrder = {
  orderId: string;
  restaurantId: string;
  restaurantName: string;
  restaurantSlug: string;
  currencyCode: string;
  total: number;
  stripeAccountId: string | null;
  stripeReady: boolean;
  paymentAttempts: number;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { orderId?: string; token?: string };
    if (!body.orderId || !body.token) return NextResponse.json({ error: "Pedido de pagamento inválido." }, { status: 400 });
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("get_stripe_checkout_order", {
      requested_order_id: body.orderId,
      requested_order_token: body.token,
    });
    if (error || !data) return NextResponse.json({ error: error?.message ?? "Pedido não encontrado." }, { status: 404 });

    const order = data as Json as CheckoutOrder;
    const { data: restaurant, error: restaurantError } = await supabase
      .from("restaurants")
      .select("is_demo, demo_locked")
      .eq("id", order.restaurantId)
      .single();
    if (restaurantError) throw new Error(restaurantError.message);
    if (restaurant.is_demo) {
      return NextResponse.json(
        { error: "A demonstração não realiza pagamentos reais." },
        { status: 409 },
      );
    }
    if (!order.stripeReady || !order.stripeAccountId) return NextResponse.json({ error: "O MB WAY ainda não está ativo neste restaurante." }, { status: 409 });
    if (order.currencyCode.toUpperCase() !== "EUR") return NextResponse.json({ error: "O MB WAY requer pagamentos em euros." }, { status: 409 });

    const siteUrl = getSiteUrl();
    const orderUrl = `${siteUrl}/r/${order.restaurantSlug}/pedido/${order.orderId}?token=${body.token}`;
    let session;
    try {
      session = await getStripe().checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["mb_way"],
        line_items: [{
          price_data: {
            currency: "eur",
            unit_amount: Math.round(Number(order.total) * 100),
            product_data: {
              name: `Pedido ${order.restaurantName}`,
              description: `Pedido #${order.orderId.slice(0, 6).toUpperCase()}`,
            },
          },
          quantity: 1,
        }],
        client_reference_id: order.orderId,
        metadata: { order_id: order.orderId, restaurant_id: order.restaurantId },
        payment_intent_data: { metadata: { order_id: order.orderId, restaurant_id: order.restaurantId } },
        success_url: `${orderUrl}&payment=success`,
        cancel_url: `${orderUrl}&payment=cancelled`,
        expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
      }, {
        stripeAccount: order.stripeAccountId,
        idempotencyKey: `trimos-mbway-${order.orderId}-${order.paymentAttempts}`,
      });
    } catch (error) {
      if (!isStripeAccountAccessError(error)) throw error;

      await supabase
        .from("restaurant_settings")
        .update({
          accepts_mb_way: false,
          stripe_account_id: null,
          stripe_charges_enabled: false,
          stripe_payouts_enabled: false,
          stripe_details_submitted: false,
          stripe_mb_way_enabled: false,
          stripe_connected_at: null,
        })
        .eq("restaurant_id", order.restaurantId);

      return NextResponse.json(
        {
          error:
            "A ligação deste restaurante à Stripe expirou. O proprietário precisa ligá-la novamente nas Configurações.",
        },
        { status: 409 },
      );
    }
    if (!session.url) throw new Error("A Stripe não devolveu o endereço de pagamento.");

    const { data: attached, error: attachError } = await supabase.rpc("attach_stripe_checkout_session", {
      requested_order_id: order.orderId,
      requested_order_token: body.token,
      requested_session_id: session.id,
    });
    if (attachError || !attached) throw new Error(attachError?.message ?? "Não foi possível associar o pagamento.");
    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível iniciar o MB WAY." }, { status: 500 });
  }
}
