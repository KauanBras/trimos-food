import { CheckCircle2, ExternalLink, MonitorPlay, Store } from "lucide-react";
import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { selectRestaurantAction } from "@/features/restaurants/actions/restaurant-selection-actions";
import { getCurrentRestaurant, getRestaurantMemberships } from "@/lib/restaurants/get-current-restaurant";

type SwitchRestaurantPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function SwitchRestaurantPage({
  searchParams,
}: SwitchRestaurantPageProps) {
  const [{ memberships }, current, params] = await Promise.all([
    getRestaurantMemberships(),
    getCurrentRestaurant(),
    searchParams,
  ]);

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <div className="text-center">
          <p className="text-sm font-semibold text-amber-600">Trimos Food</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
            Escolha o restaurante
          </h1>
          <p className="mt-2 text-zinc-500">
            A operação real e a demonstração permanecem totalmente separadas.
          </p>
        </div>

        {params.error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {params.error}
          </div>
        ) : null}

        <div className="mt-8 space-y-4">
          {memberships.map((membership) => {
            const restaurant = membership.restaurants;
            if (!restaurant) return null;
            const selected = current.restaurantId === membership.restaurant_id;

            return (
              <Card
                key={membership.restaurant_id}
                className={selected ? "border-amber-400 bg-amber-50" : "bg-white"}
              >
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                  <Avatar className="size-14 rounded-2xl border border-zinc-200">
                    <AvatarImage src={restaurant.logo_url ?? undefined} alt={restaurant.name} />
                    <AvatarFallback className="rounded-2xl bg-zinc-950 text-white">
                      {restaurant.is_demo ? <MonitorPlay className="size-5" /> : <Store className="size-5" />}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-zinc-950">{restaurant.name}</p>
                      <Badge variant={restaurant.is_demo ? "outline" : "default"}>
                        {restaurant.is_demo ? "Demonstração" : "Operação real"}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate text-sm text-zinc-500">
                      /r/{restaurant.slug}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" render={<Link href={`/r/${restaurant.slug}`} target="_blank" />} nativeButton={false}>
                      <ExternalLink className="size-4" /> Menu do cliente
                    </Button>
                    <form action={selectRestaurantAction}>
                      <input type="hidden" name="restaurantId" value={membership.restaurant_id} />
                      <input type="hidden" name="destination" value="/restaurant/dashboard" />
                      <Button type="submit" variant={selected ? "outline" : "default"}>
                        {selected ? (
                          <>
                            <CheckCircle2 className="size-4" /> Em utilização
                          </>
                        ) : (
                          "Entrar"
                        )}
                      </Button>
                    </form>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </main>
  );
}
