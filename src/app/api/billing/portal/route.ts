import { NextResponse } from "next/server";

import { getSelectedRestaurantId } from "@/lib/restaurants/get-current-restaurant";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl, getStripe } from "@/lib/stripe/server";

export const runtime = "nodejs";

export async function POST() {
  try {
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
        .select("restaurant_id, role")
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

    const { data: subscription } = await supabase
      .from("restaurant_subscriptions")
      .select("stripe_customer_id")
      .eq("restaurant_id", membership.restaurant_id)
      .single();
    if (!subscription?.stripe_customer_id) {
      return NextResponse.json(
        { error: "Este restaurante ainda não possui faturação Stripe." },
        { status: 409 },
      );
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${getSiteUrl()}/restaurant/billing`,
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível abrir o portal.",
      },
      { status: 500 },
    );
  }
}
