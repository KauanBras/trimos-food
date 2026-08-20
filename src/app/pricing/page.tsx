import Link from "next/link";
import { Check, Eye, Settings2, ShieldCheck } from "lucide-react";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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
            Demonstração gratuita, sem instalação
          </Badge>
          <h1 className="mt-5 text-5xl font-semibold tracking-tight">
            Um plano para cada fase.
          </h1>
          <p className="mt-5 text-lg leading-8 text-zinc-500">
            Conheça o sistema numa demonstração pronta. A configuração do seu
            restaurante começa somente depois da contratação.
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
                  <p className="mt-2 text-sm font-medium text-amber-700">
                    + {formatMoneyFromCents(
                      plan.setup_fee_cents,
                      plan.currency_code,
                    )}{" "}
                    de configuração inicial
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
                  {index === 0 ? (
                    <Link
                      href="/r/hirotatsu-sushi-demo"
                      className={buttonVariants({
                        className: "mt-8 w-full",
                      })}
                    >
                      Ver demonstração
                    </Link>
                  ) : (
                    <Button
                      render={
                        <Link
                          href={`/contact?plan=${encodeURIComponent(plan.code)}`}
                        />
                      }
                      nativeButton={false}
                      className="mt-8 w-full"
                    >
                      {index === 1
                        ? "Solicitar configuração"
                        : "Falar com especialista"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
        <section className="mt-12 grid gap-4 md:grid-cols-3">
          <Card className="border-zinc-200 bg-white shadow-none">
            <CardContent className="p-5">
              <Eye className="size-5 text-amber-600" />
              <h2 className="mt-4 font-semibold">Demonstração gratuita</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Explore um restaurante pronto, com dados de exemplo, sem criar
                catálogo nem fazer instalações.
              </p>
            </CardContent>
          </Card>
          <Card className="border-zinc-200 bg-white shadow-none">
            <CardContent className="p-5">
              <Settings2 className="size-5 text-amber-600" />
              <h2 className="mt-4 font-semibold">Ativação profissional</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                A configuração inicial é paga uma única vez e começa depois da
                aprovação comercial.
              </p>
            </CardContent>
          </Card>
          <Card className="border-zinc-200 bg-white shadow-none">
            <CardContent className="p-5">
              <ShieldCheck className="size-5 text-amber-600" />
              <h2 className="mt-4 font-semibold">Garantia de 14 dias</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                A primeira mensalidade pode ser devolvida. A configuração
                inicial não é reembolsável depois de iniciada.
              </p>
            </CardContent>
          </Card>
        </section>
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
