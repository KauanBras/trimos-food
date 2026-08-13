import "server-only";

export type StripeWebhookKind = "platform" | "connect";

export function getStripeWebhookSecret(kind: StripeWebhookKind) {
  const dedicatedSecret =
    kind === "platform"
      ? process.env.STRIPE_PLATFORM_WEBHOOK_SECRET
      : process.env.STRIPE_CONNECT_WEBHOOK_SECRET;

  if (dedicatedSecret) return dedicatedSecret;

  // Mantém os testes já configurados a funcionar enquanto a conta está em
  // modo de teste. Em produção, cada destino Stripe precisa do seu segredo.
  const liveMode = process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_");
  if (liveMode) return null;

  return process.env.STRIPE_WEBHOOK_SECRET ?? null;
}

export function hasDedicatedStripeWebhookSecret(kind: StripeWebhookKind) {
  return Boolean(
    kind === "platform"
      ? process.env.STRIPE_PLATFORM_WEBHOOK_SECRET
      : process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
  );
}
