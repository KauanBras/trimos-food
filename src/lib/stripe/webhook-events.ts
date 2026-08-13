import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

type WebhookScope = "platform" | "connect";

export async function stripeWebhookWasProcessed(eventId: string) {
  const { data, error } = await createAdminClient()
    .from("stripe_webhook_events")
    .select("event_id")
    .eq("event_id", eventId)
    .maybeSingle();

  // Permite publicar o código imediatamente antes da migração sem interromper
  // os webhooks que já estão em modo de teste.
  if (error?.code === "42P01" || error?.code === "PGRST205") return false;
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function markStripeWebhookProcessed({
  eventId,
  eventType,
  scope,
  stripeAccountId,
}: {
  eventId: string;
  eventType: string;
  scope: WebhookScope;
  stripeAccountId?: string | null;
}) {
  const { error } = await createAdminClient()
    .from("stripe_webhook_events")
    .insert({
      event_id: eventId,
      event_type: eventType,
      scope,
      stripe_account_id: stripeAccountId ?? null,
    });

  if (
    error &&
    error.code !== "23505" &&
    error.code !== "42P01" &&
    error.code !== "PGRST205"
  ) {
    throw new Error(error.message);
  }
}
