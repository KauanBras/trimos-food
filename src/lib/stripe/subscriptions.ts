import "server-only";

import type Stripe from "stripe";

import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/server";
import type { Database } from "@/types/database";

type SubscriptionStatus = Database["public"]["Enums"]["subscription_status"];

function normalizeStatus(
  status: Stripe.Subscription.Status,
): SubscriptionStatus {
  const map: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
    active: "active",
    canceled: "canceled",
    incomplete: "incomplete",
    incomplete_expired: "canceled",
    past_due: "past_due",
    paused: "paused",
    trialing: "trialing",
    unpaid: "unpaid",
  };
  return map[status];
}

function asIso(value: number | null | undefined) {
  return value ? new Date(value * 1000).toISOString() : null;
}

export async function syncPlatformSubscription(
  subscription: Stripe.Subscription,
) {
  const admin = createAdminClient();
  const stripe = getStripe();
  const restaurantId = subscription.metadata.restaurant_id;
  let planId = subscription.metadata.plan_id;

  if (!planId) {
    const priceId = subscription.items.data[0]?.price.id;
    if (priceId) {
      const { data: plan } = await admin
        .from("subscription_plans")
        .select("id")
        .or(
          `stripe_monthly_price_id.eq.${priceId},stripe_yearly_price_id.eq.${priceId}`,
        )
        .maybeSingle();
      planId = plan?.id ?? "";
    }
  }

  if (!restaurantId || !planId) {
    throw new Error("A assinatura Stripe não possui os metadados da Trimos.");
  }

  const firstItem = subscription.items.data[0];
  const interval =
    firstItem?.price.recurring?.interval === "year" ? "year" : "month";
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const { error } = await admin
    .from("restaurant_subscriptions")
    .update({
      plan_id: planId,
      status: normalizeStatus(subscription.status),
      billing_interval: interval,
      billing_exempt: false,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      current_period_started_at: asIso(firstItem?.current_period_start),
      current_period_ends_at: asIso(firstItem?.current_period_end),
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: asIso(subscription.canceled_at),
      last_payment_error:
        subscription.status === "past_due" || subscription.status === "unpaid"
          ? "A Stripe não conseguiu cobrar a última fatura."
          : null,
    })
    .eq("restaurant_id", restaurantId);

  if (error) throw new Error(error.message);

  await admin.from("platform_audit_logs").insert({
    restaurant_id: restaurantId,
    action: "subscription.stripe_synced",
    entity_type: "stripe_subscription",
    entity_id: subscription.id,
    metadata: {
      status: subscription.status,
      planId,
      customerId,
    },
  });

  return stripe;
}

export async function syncPlatformCheckout(session: Stripe.Checkout.Session) {
  if (typeof session.subscription !== "string") {
    throw new Error("A sessão não contém uma assinatura Stripe.");
  }

  const subscription = await getStripe().subscriptions.retrieve(
    session.subscription,
  );
  await syncPlatformSubscription(subscription);
}
