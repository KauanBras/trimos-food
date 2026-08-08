import { NextResponse } from "next/server";

import { getSiteUrl, getStripe } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Inicie sessão novamente." }, { status: 401 });

    const { data: membership } = await supabase.from("restaurant_users")
      .select("restaurant_id, role").eq("user_id", user.id).eq("is_active", true).maybeSingle();
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Apenas o proprietário ou administrador pode ligar pagamentos." }, { status: 403 });
    }

    const [{ data: restaurant }, { data: settings }] = await Promise.all([
      supabase.from("restaurants").select("name, email").eq("id", membership.restaurant_id).single(),
      supabase.from("restaurant_settings").select("stripe_account_id").eq("restaurant_id", membership.restaurant_id).single(),
    ]);
    if (!restaurant || !settings) return NextResponse.json({ error: "Restaurante não encontrado." }, { status: 404 });

    const stripe = getStripe();
    let accountId = settings.stripe_account_id;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "standard",
        country: "PT",
        email: restaurant.email ?? user.email,
        business_profile: { name: restaurant.name, product_description: "Pedidos de restauração e entregas" },
        capabilities: { mb_way_payments: { requested: true } },
        metadata: { restaurant_id: membership.restaurant_id },
      });
      accountId = account.id;
      const { error } = await supabase.from("restaurant_settings")
        .update({ stripe_account_id: accountId }).eq("restaurant_id", membership.restaurant_id);
      if (error) throw new Error(error.message);
    }

    const account = await stripe.accounts.retrieve(accountId);
    const { error: syncError } = await supabase.from("restaurant_settings").update({
      stripe_charges_enabled: account.charges_enabled,
      stripe_payouts_enabled: account.payouts_enabled,
      stripe_details_submitted: account.details_submitted,
      stripe_mb_way_enabled: account.capabilities?.mb_way_payments === "active",
      stripe_connected_at: account.details_submitted ? new Date().toISOString() : null,
    }).eq("restaurant_id", membership.restaurant_id);
    if (syncError) throw new Error(syncError.message);

    const siteUrl = getSiteUrl();
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${siteUrl}/restaurant/settings?stripe=refresh`,
      return_url: `${siteUrl}/api/payments/stripe/connect/return`,
      type: "account_onboarding",
    });
    return NextResponse.json({ url: link.url });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível ligar a Stripe." }, { status: 500 });
  }
}
