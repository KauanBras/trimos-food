import { NextResponse } from "next/server";

import { getSiteUrl, getStripe } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const destination = new URL("/restaurant/settings?stripe=connected", getSiteUrl());
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.redirect(new URL("/login", getSiteUrl()));
    const { data: membership } = await supabase.from("restaurant_users")
      .select("restaurant_id").eq("user_id", user.id).eq("is_active", true).maybeSingle();
    if (!membership) return NextResponse.redirect(new URL("/onboarding", getSiteUrl()));
    const { data: settings } = await supabase.from("restaurant_settings")
      .select("stripe_account_id").eq("restaurant_id", membership.restaurant_id).single();
    if (!settings?.stripe_account_id) throw new Error("Conta Stripe não encontrada.");

    const account = await getStripe().accounts.retrieve(settings.stripe_account_id);
    const mbWayEnabled = account.capabilities?.mb_way_payments === "active";
    const { error } = await supabase.from("restaurant_settings").update({
      stripe_charges_enabled: account.charges_enabled,
      stripe_payouts_enabled: account.payouts_enabled,
      stripe_details_submitted: account.details_submitted,
      stripe_mb_way_enabled: mbWayEnabled,
      stripe_connected_at: account.details_submitted ? new Date().toISOString() : null,
      accepts_mb_way: account.charges_enabled && account.details_submitted && mbWayEnabled,
    }).eq("restaurant_id", membership.restaurant_id);
    if (error) throw new Error(error.message);
  } catch (error) {
    destination.searchParams.set("stripe_error", error instanceof Error ? error.message : "Não foi possível confirmar a ligação.");
  }
  return NextResponse.redirect(destination);
}
