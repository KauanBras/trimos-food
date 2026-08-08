import Link from "next/link";
import {
  ArrowRight,
  Check,
  Circle,
  CreditCard,
  Package,
  Settings,
  ShoppingBag,
  Store,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentRestaurant } from "@/lib/restaurants/get-current-restaurant";
import { createClient } from "@/lib/supabase/server";

export default async function RestaurantGettingStartedPage() {
  const { restaurantId, restaurant } = await getCurrentRestaurant();
  const supabase = await createClient();
  const { data: onboarding, error } = await supabase.rpc(
    "refresh_restaurant_onboarding",
    { requested_restaurant_id: restaurantId },
  );
  if (error || !onboarding) {
    throw new Error(
      error?.message ?? "Não foi possível atualizar os primeiros passos.",
    );
  }

  const steps = [
    {
      title: "Completar a identidade",
      description: "Nome, descrição, contacto, logótipo e capa.",
      completed: onboarding.identity_completed,
      href: "/restaurant/settings",
      icon: Store,
    },
    {
      title: "Publicar o menu",
      description: "Crie categorias e pelo menos um produto ativo.",
      completed: onboarding.menu_completed,
      href: "/restaurant/products",
      icon: Package,
    },
    {
      title: "Definir a operação",
      description: "Horários, entrega, recolha, reservas e preparação.",
      completed: onboarding.operations_completed,
      href: "/restaurant/settings",
      icon: Settings,
    },
    {
      title: "Escolher pagamentos",
      description: "Ative dinheiro, terminal ou ligue a Stripe para MB WAY.",
      completed: onboarding.payments_completed,
      href: "/restaurant/settings",
      icon: CreditCard,
    },
    {
      title: "Preparar a equipa",
      description:
        "O proprietário já conta; adicione estafetas quando necessário.",
      completed: onboarding.team_completed,
      href: "/restaurant/drivers",
      icon: Users,
    },
    {
      title: "Receber o primeiro pedido",
      description: "Partilhe o menu e acompanhe o fluxo completo.",
      completed: onboarding.first_order_completed,
      href: `/r/${restaurant.slug}`,
      icon: ShoppingBag,
      external: true,
    },
  ];

  return (
    <div className="space-y-7 p-4 sm:p-6 lg:p-8">
      <section className="overflow-hidden rounded-3xl bg-zinc-950 p-6 text-white lg:p-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <Badge className="bg-amber-400 text-zinc-950">
              Configuração assistida
            </Badge>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight">
              Prepare {restaurant.name} para vender.
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">
              Cada etapa atualiza automaticamente. Pode trabalhar ao seu ritmo
              sem perder o que já configurou.
            </p>
          </div>
          <div className="min-w-44 rounded-2xl bg-white/10 p-5 text-center">
            <p className="text-4xl font-semibold text-amber-400">
              {onboarding.progress_percent}%
            </p>
            <p className="mt-1 text-xs text-zinc-400">concluído</p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <Card
              key={step.title}
              className={`border-zinc-200 shadow-none ${step.completed ? "bg-emerald-50/40" : ""}`}
            >
              <CardContent className="flex items-start gap-4 p-5">
                <div
                  className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${step.completed ? "bg-emerald-600 text-white" : "bg-zinc-100 text-zinc-700"}`}
                >
                  {step.completed ? (
                    <Check className="size-5" />
                  ) : (
                    <Icon className="size-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-zinc-400">
                      PASSO {index + 1}
                    </span>
                    {step.completed ? (
                      <Badge className="bg-emerald-100 text-emerald-700">
                        Concluído
                      </Badge>
                    ) : null}
                  </div>
                  <h2 className="mt-2 font-semibold">{step.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-zinc-500">
                    {step.description}
                  </p>
                  <Button
                    render={
                      <Link
                        href={step.href}
                        target={step.external ? "_blank" : undefined}
                      />
                    }
                    nativeButton={false}
                    variant="ghost"
                    size="sm"
                    className="mt-3 -ml-2 gap-2"
                  >
                    {step.completed ? "Rever" : "Começar"}
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
                <Circle
                  className={`mt-1 size-3 ${step.completed ? "fill-emerald-500 text-emerald-500" : "text-zinc-300"}`}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
