import { redirect } from "next/navigation";
import { Building2, CheckCircle2, Store } from "lucide-react";

import { createRestaurantAction } from "@/features/restaurants/actions/onboarding-actions";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type OnboardingPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function OnboardingPage({
  searchParams,
}: OnboardingPageProps) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("restaurant_users")
    .select("restaurant_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (membership) {
    redirect("/restaurant/dashboard");
  }

  return (
    <main className="grid min-h-screen bg-zinc-50 lg:grid-cols-[1.1fr_1fr]">
      <section className="hidden bg-zinc-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-400 text-zinc-950">
            <Store className="size-5" />
          </div>

          <div>
            <p className="font-semibold">Trimos Food</p>
            <p className="text-sm text-zinc-400">
              Ativação comercial
            </p>
          </div>
        </div>

        <div className="max-w-xl">
          <p className="text-sm font-medium text-amber-400">
            O primeiro passo da operação
          </p>

          <h1 className="mt-4 text-5xl font-semibold leading-tight tracking-tight">
            Vamos preparar o seu restaurante.
          </h1>

          <p className="mt-6 max-w-lg leading-7 text-zinc-400">
            Primeiro criamos o espaço exclusivo do restaurante. Em seguida,
            confirma o plano e a configuração inicial antes da publicação.
          </p>

          <div className="mt-10 space-y-4">
            {[
              "Ambiente exclusivo e protegido",
              "Sem período gratuito com trabalho manual",
              "Publicação depois da ativação comercial",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <CheckCircle2 className="size-5 text-amber-400" />
                <span className="text-sm text-zinc-300">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-sm text-zinc-500">
          Trimos Food · Plataforma multi-restaurante
        </p>
      </section>

      <section className="flex items-center justify-center p-5 sm:p-10">
        <Card className="w-full max-w-lg border-zinc-200 shadow-xl shadow-zinc-200/50">
          <CardHeader>
            <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-amber-400 text-zinc-950">
              <Building2 className="size-5" />
            </div>

            <CardTitle className="text-2xl">
              Criar o restaurante
            </CardTitle>

            <CardDescription>
              Indique o nome que será apresentado aos clientes e à equipa.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {params.error && (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {params.error}
              </div>
            )}

            <form action={createRestaurantAction} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="restaurantName">
                  Nome do restaurante
                </Label>

                <Input
                  id="restaurantName"
                  name="restaurantName"
                  placeholder="Ex.: Nome do restaurante"
                  autoFocus
                  required
                />

                <p className="text-xs leading-5 text-zinc-500">
                  Poderá alterar o nome, logótipo, cores e restantes
                  informações nas configurações.
                </p>
              </div>

              <Button
                type="submit"
                className="h-11 w-full bg-zinc-950 hover:bg-zinc-800"
              >
                Criar restaurante e continuar
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
