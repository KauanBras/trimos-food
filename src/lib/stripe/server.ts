import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error(
      "A integração Stripe ainda não está configurada pelo operador da Trimos.",
    );
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      appInfo: {
        name: "Trimos Food",
        version: "1.0.0",
      },
    });
  }

  return stripeClient;
}

export function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

export async function getConnectedAccountState(accountId: string) {
  const stripe = getStripe();
  const account = await stripe.v2.core.accounts.retrieve(accountId, {
    include: ["configuration.merchant", "requirements"],
  });
  const merchant = account.configuration?.merchant;
  const requirements = account.requirements?.entries ?? [];
  const hasOutstandingRequirements = requirements.some(
    (entry) =>
      entry.awaiting_action_from === "user" &&
      ["currently_due", "past_due"].includes(entry.minimum_deadline.status),
  );
  const chargesEnabled =
    merchant?.capabilities?.card_payments?.status === "active";
  const payoutsEnabled =
    merchant?.capabilities?.stripe_balance?.payouts?.status === "active";

  let mbWayEnabled = chargesEnabled;
  try {
    const legacyAccount = await stripe.accounts.retrieve(accountId);
    mbWayEnabled =
      legacyAccount.capabilities?.mb_way_payments === "active" ||
      chargesEnabled;
  } catch {
    // Accounts v2 can be fully usable even when a legacy v1 representation is unavailable.
  }

  return {
    chargesEnabled,
    payoutsEnabled,
    detailsSubmitted: Boolean(merchant?.applied) && !hasOutstandingRequirements,
    mbWayEnabled,
  };
}
