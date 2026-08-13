import { NextResponse } from "next/server";

import {
  getConnectedAccountState,
  getSiteUrl,
} from "@/lib/stripe/server";
import { getSelectedRestaurantId } from "@/lib/restaurants/get-current-restaurant";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const destination = new URL("/restaurant/settings?stripe=connected", getSiteUrl());
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.redirect(new URL("/login", getSiteUrl()));
    const restaurantId = await getSelectedRestaurantId(supabase, user.id);
    const { data: membership } = restaurantId
      ? await supabase.from("restaurant_users")
        .select("restaurant_id, restaurants(is_demo, demo_locked)")
        .eq("user_id", user.id).eq("restaurant_id", restaurantId)
        .eq("is_active", true).maybeSingle()
      : { data: null };
    if (!membership) return NextResponse.redirect(new URL("/onboarding", getSiteUrl()));
    if (membership.restaurants?.is_demo) {
      throw new Error("A demonstração não pode ligar pagamentos reais.");
    }
    const { data: settings } = await supabase.from("restaurant_settings")
      .select("stripe_account_id").eq("restaurant_id", membership.restaurant_id).single();
    if (!settings?.stripe_account_id) throw new Error("Conta Stripe não encontrada.");

    const accountState = await getConnectedAccountState(settings.stripe_account_id);
    const { error } = await supabase.from("restaurant_settings").update({
      stripe_charges_enabled: accountState.chargesEnabled,
      stripe_payouts_enabled: accountState.payoutsEnabled,
      stripe_details_submitted: accountState.detailsSubmitted,
      stripe_mb_way_enabled: accountState.mbWayEnabled,
      stripe_connected_at: accountState.detailsSubmitted ? new Date().toISOString() : null,
      accepts_mb_way:
        accountState.chargesEnabled &&
        accountState.detailsSubmitted &&
        accountState.mbWayEnabled,
    }).eq("restaurant_id", membership.restaurant_id);
    if (error) throw new Error(error.message);
  } catch (error) {
    destination.searchParams.set("stripe_error", error instanceof Error ? error.message : "Não foi possível confirmar a ligação.");
  }
  return NextResponse.redirect(destination);
}
