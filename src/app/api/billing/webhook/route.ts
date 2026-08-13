import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { getStripe } from "@/lib/stripe/server";
import {
  syncPlatformCheckout,
  syncPlatformSubscription,
} from "@/lib/stripe/subscriptions";
import { getStripeWebhookSecret } from "@/lib/stripe/webhook-secrets";
import {
  markStripeWebhookProcessed,
  stripeWebhookWasProcessed,
} from "@/lib/stripe/webhook-events";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = getStripeWebhookSecret("platform");

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: "Webhook de faturação da plataforma não configurado." },
      { status: 503 },
    );
  }

  try {
    const event = getStripe().webhooks.constructEvent(
      await request.text(),
      signature,
      webhookSecret,
    );

    if (event.account) {
      return NextResponse.json(
        { error: "Evento de conta conectada enviado ao destino incorreto." },
        { status: 400 },
      );
    }

    if (await stripeWebhookWasProcessed(event.id)) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.purpose === "restaurant_subscription") {
        await syncPlatformCheckout(session);
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
    }

    await markStripeWebhookProcessed({
      eventId: event.id,
      eventType: event.type,
      scope: "platform",
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Webhook de faturação inválido.",
      },
      { status: 400 },
    );
  }
}
