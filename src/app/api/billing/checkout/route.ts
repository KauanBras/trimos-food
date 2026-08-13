import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { createAdminClient } from "@/lib/supabase/admin";
import { getSelectedRestaurantId } from "@/lib/restaurants/get-current-restaurant";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl, getStripe } from "@/lib/stripe/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      planId?: string;
      interval?: "month" | "year";
    };
    if (!body.planId || !["month", "year"].includes(body.interval ?? "")) {
      return NextResponse.json(
        { error: "Plano ou periodicidade inválidos." },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });

    const restaurantId = await getSelectedRestaurantId(supabase, user.id);
    const { data: membership } = restaurantId
      ? await supabase
        .from("restaurant_users")
        .select("restaurant_id, role, restaurants(name, is_demo, demo_locked)")
        .eq("user_id", user.id)
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .maybeSingle()
      : { data: null };
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json(
        { error: "Sem permissão para gerir a assinatura." },
        { status: 403 },
      );
    }
    if (membership.restaurants?.is_demo) {
      return NextResponse.json(
        { error: "A demonstração não pode iniciar cobranças." },
        { status: 409 },
      );
    }

    const admin = createAdminClient();
    const [{ data: plan }, { data: subscription }] = await Promise.all([
      admin
        .from("subscription_plans")
        .select("*")
        .eq("id", body.planId)
        .eq("is_active", true)
        .single(),
      admin
        .from("restaurant_subscriptions")
        .select("*")
        .eq("restaurant_id", membership.restaurant_id)
        .single(),
    ]);
    if (!plan || !subscription) {
      return NextResponse.json(
        { error: "Plano ou assinatura não encontrados." },
        { status: 404 },
      );
    }
    if (subscription.billing_exempt) {
      return NextResponse.json(
        { error: "Este restaurante possui condição de piloto sem cobrança." },
        { status: 409 },
      );
    }
    if (
      subscription.stripe_subscription_id &&
      ["active", "trialing", "past_due"].includes(subscription.status)
    ) {
      return NextResponse.json(
        { error: "Utilize o portal para alterar uma assinatura existente." },
        { status: 409 },
      );
    }

    const priceId =
      body.interval === "year"
        ? plan.stripe_yearly_price_id
        : plan.stripe_monthly_price_id;
    if (!priceId) {
      return NextResponse.json(
        { error: "Este plano ainda não foi sincronizado com a Stripe." },
        { status: 409 },
      );
    }

    const stripe = getStripe();
    let customerId = subscription.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: membership.restaurants?.name ?? undefined,
        metadata: { restaurant_id: membership.restaurant_id },
      });
      customerId = customer.id;
      const { error } = await admin
        .from("restaurant_subscriptions")
        .update({ stripe_customer_id: customerId })
        .eq("restaurant_id", membership.restaurant_id);
      if (error) throw new Error(error.message);
    }

    const siteUrl = getSiteUrl();
    const shouldChargeSetup =
      !subscription.setup_fee_paid_at && plan.setup_fee_cents > 0;
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      { price: priceId, quantity: 1 },
    ];

    if (shouldChargeSetup) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: plan.currency_code.toLowerCase(),
          unit_amount: plan.setup_fee_cents,
          product_data: {
            name: `Configuração inicial — Trimos Food ${plan.name}`,
            description:
              "Ativação, identidade, configuração operacional e acompanhamento inicial.",
          },
        },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: lineItems,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      tax_id_collection: { enabled: true },
      locale: "pt",
      metadata: {
        purpose: "restaurant_subscription",
        restaurant_id: membership.restaurant_id,
        plan_id: plan.id,
        interval: body.interval!,
        setup_fee_cents: shouldChargeSetup
          ? String(plan.setup_fee_cents)
          : "0",
      },
      subscription_data: {
        metadata: {
          purpose: "restaurant_subscription",
          restaurant_id: membership.restaurant_id,
          plan_id: plan.id,
        },
      },
      success_url: `${siteUrl}/restaurant/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/restaurant/billing?checkout=cancelled`,
    });

    if (!session.url)
      throw new Error("A Stripe não devolveu o endereço de pagamento.");
    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível iniciar a assinatura.",
      },
      { status: 500 },
    );
  }
}
