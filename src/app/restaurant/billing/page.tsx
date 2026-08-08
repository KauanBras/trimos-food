import {
  Check,
  CircleAlert,
  CreditCard,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BillingActionButton } from "@/features/billing/components/billing-action-button";
import { formatDateTime, formatMoneyFromCents } from "@/lib/platform/format";
import { getCurrentRestaurant } from "@/lib/restaurants/get-current-restaurant";
import { getStripe } from "@/lib/stripe/server";
import {
  syncPlatformCheckout,
  syncPlatformSubscription,
} from "@/lib/stripe/subscriptions";
import { createClient } from "@/lib/supabase/server";

type BillingPageProps = {
  searchParams: Promise<{ checkout?: string; session_id?: string }>;
};

const statusLabels: Record<string, string> = {
  incomplete: "Configuração incompleta",
  trialing: "Período de teste",
  active: "Assinatura ativa",
  past_due: "Pagamento pendente",
  paused: "Assinatura pausada",
  canceled: "Assinatura cancelada",
  unpaid: "Pagamento em dívida",
};

export default async function RestaurantBillingPage({
  searchParams,
}: BillingPageProps) {
  const params = await searchParams;
  const { restaurantId, role } = await getCurrentRestaurant();
  const supabase = await createClient();

  if (params.checkout === "success" && params.session_id) {
    const checkoutSession = await getStripe().checkout.sessions.retrieve(
      params.session_id,
    );
    if (checkoutSession.metadata?.restaurant_id === restaurantId) {
      await syncPlatformCheckout(checkoutSession);
    }
  }

  let subscriptionResult = await supabase
    .from("restaurant_subscriptions")
    .select("*, subscription_plans(*)")
    .eq("restaurant_id", restaurantId)
    .single();

  if (subscriptionResult.data?.stripe_subscription_id) {
    try {
      const stripeSubscription = await getStripe().subscriptions.retrieve(
        subscriptionResult.data.stripe_subscription_id,
      );
      await syncPlatformSubscription(stripeSubscription);
      subscriptionResult = await supabase
        .from("restaurant_subscriptions")
        .select("*, subscription_plans(*)")
        .eq("restaurant_id", restaurantId)
        .single();
    } catch {
      // Mantém a página disponível se a Stripe estiver temporariamente indisponível.
    }
  }

  const [{ data: subscription, error }, { data: plans }] = await Promise.all([
    Promise.resolve(subscriptionResult),
    supabase
      .from("subscription_plans")
      .select("*")
      .eq("is_active", true)
      .eq("is_public", true)
      .order("sort_order"),
  ]);
  if (error || !subscription)
    throw new Error(error?.message ?? "Assinatura não encontrada.");
  const canManage = ["owner", "admin"].includes(role);
  const hasPortal = Boolean(subscription.stripe_customer_id);

  return (
    <div className="space-y-7 p-4 sm:p-6 lg:p-8">
      <header>
        <p className="text-sm font-medium text-amber-600">Conta comercial</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Plano e faturação
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Consulte a condição atual e faça alterações de forma segura pela
          Stripe.
        </p>
      </header>

      {params.checkout === "success" ? (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <ShieldCheck className="size-5" />
          Pagamento recebido. A assinatura será atualizada automaticamente em
          instantes.
        </div>
      ) : null}
      {params.checkout === "cancelled" ? (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <CircleAlert className="size-5" />A contratação foi cancelada e não
          houve alteração no plano.
        </div>
      ) : null}

      <Card className="overflow-hidden border-zinc-800 bg-zinc-950 text-white shadow-none">
        <CardContent className="grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-amber-400 text-zinc-950">
                {subscription.billing_exempt
                  ? "Piloto Trimos"
                  : statusLabels[subscription.status]}
              </Badge>
              <span className="text-sm text-zinc-400">
                Plano {subscription.subscription_plans.name}
              </span>
            </div>
            <h2 className="mt-4 text-3xl font-semibold">
              {subscription.billing_exempt
                ? "Sem cobrança durante o piloto"
                : formatMoneyFromCents(
                    subscription.billing_interval === "year"
                      ? subscription.subscription_plans.yearly_price_cents
                      : subscription.subscription_plans.monthly_price_cents,
                    subscription.subscription_plans.currency_code,
                  )}
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              {subscription.trial_ends_at && subscription.status === "trialing"
                ? `Teste disponível até ${formatDateTime(subscription.trial_ends_at)}.`
                : subscription.current_period_ends_at
                  ? `Período atual até ${formatDateTime(subscription.current_period_ends_at)}.`
                  : "Condição comercial administrada pela Trimos Food."}
            </p>
          </div>
          {hasPortal && canManage ? (
            <div className="w-full lg:w-56">
              <BillingActionButton
                endpoint="/api/billing/portal"
                label="Gerir na Stripe"
                variant="outline"
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <section className="grid gap-5 xl:grid-cols-3">
        {(plans ?? []).map((plan) => {
          const features = Array.isArray(plan.features)
            ? plan.features.filter(
                (item): item is string => typeof item === "string",
              )
            : [];
          const current = subscription.plan_id === plan.id;
          return (
            <Card
              key={plan.id}
              className={`border-zinc-200 shadow-none ${current ? "ring-2 ring-amber-400" : ""}`}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  {current ? (
                    <Badge className="bg-amber-100 text-amber-800">Atual</Badge>
                  ) : null}
                </div>
                <p className="mt-3 text-3xl font-semibold">
                  {formatMoneyFromCents(
                    plan.monthly_price_cents,
                    plan.currency_code,
                  )}
                  <span className="text-sm font-normal text-zinc-400">
                    /mês
                  </span>
                </p>
                <p className="text-sm leading-6 text-zinc-500">
                  {plan.description}
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                <ul className="space-y-2">
                  {features.map((feature) => (
                    <li
                      key={feature}
                      className="flex gap-2 text-sm text-zinc-600"
                    >
                      <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {subscription.billing_exempt ? (
                  <div className="rounded-xl bg-amber-50 p-3 text-center text-xs text-amber-800">
                    <Sparkles className="mr-1 inline size-3.5" />
                    Piloto sem cobrança
                  </div>
                ) : canManage ? (
                  <BillingActionButton
                    endpoint="/api/billing/checkout"
                    planId={plan.id}
                    interval="month"
                    label={current ? "Plano atual" : `Escolher ${plan.name}`}
                    disabled={current || !plan.stripe_monthly_price_id}
                  />
                ) : (
                  <div className="text-center text-xs text-zinc-400">
                    Apenas o proprietário pode alterar.
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </section>

      <div className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
        <CreditCard className="mt-0.5 size-5 shrink-0 text-zinc-900" />
        <p>
          Os dados do cartão e da faturação são tratados diretamente pela
          Stripe. A Trimos não guarda números de cartão.
        </p>
      </div>
    </div>
  );
}
