import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/server";
import {
  syncPlatformCheckout,
  syncPlatformSubscription,
} from "@/lib/stripe/subscriptions";

export const runtime = "nodejs";

function paymentIntentId(session: Stripe.Checkout.Session) {
  if (typeof session.payment_intent === "string") return session.payment_intent;
  return session.payment_intent?.id ?? "";
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret)
    return NextResponse.json(
      { error: "Webhook não configurado." },
      { status: 503 },
    );

  try {
    const event = getStripe().webhooks.constructEvent(
      await request.text(),
      signature,
      webhookSecret,
    );
    const accountId = typeof event.account === "string" ? event.account : "";

    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.purpose === "restaurant_subscription") {
        await syncPlatformCheckout(session);
        return NextResponse.json({ received: true });
      }
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted" ||
      event.type === "customer.subscription.paused" ||
      event.type === "customer.subscription.resumed"
    ) {
      await syncPlatformSubscription(event.data.object as Stripe.Subscription);
      return NextResponse.json({ received: true });
    }

    if (
      [
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
        "checkout.session.async_payment_failed",
        "checkout.session.expired",
      ].includes(event.type)
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      const succeeded =
        event.type === "checkout.session.async_payment_succeeded" ||
        (event.type === "checkout.session.completed" &&
          session.payment_status === "paid");
      const failureReason = succeeded
        ? null
        : event.type === "checkout.session.expired"
          ? "O pedido de pagamento expirou."
          : "O pagamento não foi concluído.";
      const { error } = await createAdminClient().rpc("record_stripe_payment", {
        requested_session_id: session.id,
        requested_payment_id: paymentIntentId(session),
        requested_account_id: accountId,
        requested_succeeded: succeeded,
        requested_failure_reason: failureReason ?? undefined,
      });
      if (error) throw new Error(error.message);
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook inválido." },
      { status: 400 },
    );
  }
}
