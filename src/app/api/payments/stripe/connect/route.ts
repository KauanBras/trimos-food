import { NextResponse } from "next/server";

import {
  getConnectedAccountState,
  getSiteUrl,
  getStripe,
  isStripeAccountAccessError,
} from "@/lib/stripe/server";
import { getSelectedRestaurantId } from "@/lib/restaurants/get-current-restaurant";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Inicie sessão novamente." }, { status: 401 });

    const restaurantId = await getSelectedRestaurantId(supabase, user.id);
    const { data: membership } = restaurantId
      ? await supabase.from("restaurant_users")
        .select("restaurant_id, role").eq("user_id", user.id)
        .eq("restaurant_id", restaurantId).eq("is_active", true).maybeSingle()
      : { data: null };
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Apenas o proprietário ou administrador pode ligar pagamentos." }, { status: 403 });
    }

    const [{ data: restaurant }, { data: settings }] = await Promise.all([
      supabase.from("restaurants").select("name, email, slug, is_demo, demo_locked").eq("id", membership.restaurant_id).single(),
      supabase.from("restaurant_settings").select("stripe_account_id").eq("restaurant_id", membership.restaurant_id).single(),
    ]);
    if (!restaurant || !settings) return NextResponse.json({ error: "Restaurante não encontrado." }, { status: 404 });
    if (restaurant.is_demo) {
      return NextResponse.json(
        { error: "A demonstração não pode ligar pagamentos reais." },
        { status: 409 },
      );
    }

    const stripe = getStripe();
    let accountId = settings.stripe_account_id;
    if (accountId) {
      try {
        await getConnectedAccountState(accountId);
      } catch (error) {
        if (!isStripeAccountAccessError(error)) throw error;

        const { error: resetError } = await supabase
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
          .eq("restaurant_id", membership.restaurant_id);
        if (resetError) throw new Error(resetError.message);
        accountId = null;
      }
    }

    if (!accountId) {
      const contactEmail = restaurant.email ?? user.email;
      if (!contactEmail) {
        return NextResponse.json(
          { error: "Indique um e-mail do restaurante antes de ligar a Stripe." },
          { status: 400 },
        );
      }

      const account = await stripe.v2.core.accounts.create({
        contact_email: contactEmail,
        display_name: restaurant.name,
        dashboard: "full",
        identity: { country: "PT" },
        configuration: {
          merchant: {
            capabilities: { card_payments: { requested: true } },
          },
        },
        defaults: {
          currency: "eur",
          locales: ["pt-PT"],
          profile: {
            doing_business_as: restaurant.name,
            product_description: "Pedidos de restauração e entregas",
            business_url: `${getSiteUrl()}/r/${restaurant.slug}`,
          },
          responsibilities: {
            fees_collector: "stripe",
            losses_collector: "stripe",
          },
        },
        metadata: { restaurant_id: membership.restaurant_id },
      });
      accountId = account.id;

      try {
        await stripe.accounts.update(accountId, {
          capabilities: { mb_way_payments: { requested: true } },
        });
      } catch {
        // Accounts v2 activates compatible local methods as the merchant completes onboarding.
      }

      const { error } = await supabase.from("restaurant_settings")
        .update({ stripe_account_id: accountId }).eq("restaurant_id", membership.restaurant_id);
      if (error) throw new Error(error.message);
    }

    const accountState = await getConnectedAccountState(accountId);
    const { error: syncError } = await supabase.from("restaurant_settings").update({
      stripe_charges_enabled: accountState.chargesEnabled,
      stripe_payouts_enabled: accountState.payoutsEnabled,
      stripe_details_submitted: accountState.detailsSubmitted,
      stripe_mb_way_enabled: accountState.mbWayEnabled,
      stripe_connected_at: accountState.detailsSubmitted ? new Date().toISOString() : null,
    }).eq("restaurant_id", membership.restaurant_id);
    if (syncError) throw new Error(syncError.message);

    const siteUrl = getSiteUrl();
    const link = await stripe.v2.core.accountLinks.create({
      account: accountId,
      use_case: {
        type: "account_onboarding",
        account_onboarding: {
          configurations: ["merchant"],
          refresh_url: `${siteUrl}/restaurant/settings?stripe=refresh`,
          return_url: `${siteUrl}/api/payments/stripe/connect/return`,
          collection_options: {
            fields: "eventually_due",
            future_requirements: "include",
          },
        },
      },
    });
    return NextResponse.json({ url: link.url });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível ligar a Stripe." }, { status: 500 });
  }
}
