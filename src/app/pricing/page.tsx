import Link from "next/link";
import { Check } from "lucide-react";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoneyFromCents } from "@/lib/platform/format";
import { createClient } from "@/lib/supabase/server";

export default async function PricingPage() {
  const supabase = await createClient();
  const { data: plans, error } = await supabase
    .from("subscription_plans")
    .select("*")
    .eq("is_active", true)
    .eq("is_public", true)
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (
    <div className="min-h-screen bg-zinc-50">
      <MarketingHeader />
      <main className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Badge className="bg-amber-100 text-amber-800">
            30 dias de teste
          </Badge>
          <h1 className="mt-5 text-5xl font-semibold tracking-tight">
            Um plano para cada fase.
          </h1>
          <p className="mt-5 text-lg leading-8 text-zinc-500">
            Os preços podem ser ajustados no painel da Trimos sem alterações no
            código. O processamento Stripe é contratado separadamente pelo
            restaurante.
          </p>
        </div>
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {(plans ?? []).map((plan, index) => {
            const features = Array.isArray(plan.features)
              ? plan.features.filter(
                  (item): item is string => typeof item === "string",
                )
              : [];
            return (
              <Card
                key={plan.id}
                className={`border-zinc-200 shadow-none ${index === 1 ? "ring-2 ring-amber-400" : ""}`}
              >
                <CardContent className="p-7">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-semibold">{plan.name}</h2>
                    {index === 1 ? <Badge>Recomendado</Badge> : null}
                  </div>
                  <p className="mt-3 min-h-12 text-sm leading-6 text-zinc-500">
                    {plan.description}
                  </p>
                  <p className="mt-6 text-4xl font-semibold">
                    {formatMoneyFromCents(
                      plan.monthly_price_cents,
                      plan.currency_code,
                    )}
                    <span className="text-sm font-normal text-zinc-400">
                      /mês
                    </span>
                  </p>
                  {plan.yearly_price_cents ? (
                    <p className="mt-1 text-xs text-zinc-400">
                      ou{" "}
                      {formatMoneyFromCents(
                        plan.yearly_price_cents,
                        plan.currency_code,
                      )}
                      /ano
                    </p>
                  ) : null}
                  <ul className="mt-7 space-y-3">
                    {features.map((feature) => (
                      <li
                        key={feature}
                        className="flex gap-2 text-sm text-zinc-600"
                      >
                        <Check className="size-4 shrink-0 text-emerald-600" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    render={<Link href="/register" />}
                    nativeButton={false}
                    className="mt-8 w-full"
                  >
                    Começar teste
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <div className="mt-10 text-center text-sm text-zinc-500">
          Precisa de ajuda para escolher?{" "}
          <Link href="/contact" className="font-medium text-zinc-950 underline">
            Fale com a Trimos.
          </Link>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
