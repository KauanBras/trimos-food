import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/server";
import {
  markStripeWebhookProcessed,
  stripeWebhookWasProcessed,
} from "@/lib/stripe/webhook-events";
import { getStripeWebhookSecret } from "@/lib/stripe/webhook-secrets";

export const runtime = "nodejs";

function paymentIntentId(session: Stripe.Checkout.Session) {
  if (typeof session.payment_intent === "string") return session.payment_intent;
  return session.payment_intent?.id ?? "";
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = getStripeWebhookSecret("connect");
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
    const accountId = typeof event.account === "string" ? event.account : null;
    if (!accountId) {
      return NextResponse.json(
        { error: "Evento sem conta Stripe conectada." },
        { status: 400 },
      );
    }

    if (await stripeWebhookWasProcessed(event.id)) {
      return NextResponse.json({ received: true, duplicate: true });
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

      /*
       * Métodos assíncronos como MB WAY podem emitir
       * checkout.session.completed antes da confirmação final.
       *
       * Neste estado NÃO devemos marcar o pagamento como falhado.
       * A confirmação definitiva virá através de:
       *
       * - checkout.session.async_payment_succeeded
       * - checkout.session.async_payment_failed
       *
       * Se completed já vier com payment_status=paid,
       * podemos confirmar imediatamente.
       */
      const completedAndPaid =
        event.type === "checkout.session.completed" &&
        session.payment_status === "paid";

      const asyncSucceeded =
        event.type === "checkout.session.async_payment_succeeded";

      const asyncFailed =
        event.type === "checkout.session.async_payment_failed";

      const expired =
        event.type === "checkout.session.expired";

      if (completedAndPaid || asyncSucceeded || asyncFailed || expired) {
        const succeeded = completedAndPaid || asyncSucceeded;

        const failureReason = succeeded
          ? null
          : expired
            ? "O pedido de pagamento expirou."
            : "O pagamento não foi concluído.";

        const { error } = await createAdminClient().rpc(
          "record_stripe_payment",
          {
            requested_session_id: session.id,
            requested_payment_id: paymentIntentId(session),
            requested_account_id: accountId,
            requested_succeeded: succeeded,
            requested_failure_reason: failureReason ?? undefined,
          },
        );

        if (error) {
          throw new Error(error.message);
        }
      }
    }

    await markStripeWebhookProcessed({
      eventId: event.id,
      eventType: event.type,
      scope: "connect",
      stripeAccountId: accountId,
    });
    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook inválido." },
      { status: 400 },
    );
  }
}
