import Link from "next/link";
import {
  ExternalLink,
  Mail,
  Plus,
  RefreshCcw,
  Save,
  ShieldCheck,
  Store,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createRestaurantFromAdminAction,
  resetDemoRestaurantAction,
  updateRestaurantCommercialAction,
} from "@/features/platform/actions/platform-actions";
import { requireSuperAdmin } from "@/lib/platform/admin";
import { formatDateTime } from "@/lib/platform/format";

export default async function AdminRestaurantsPage() {
  const { supabase } = await requireSuperAdmin();
  const [
    restaurantsResult,
    subscriptionsResult,
    plansResult,
    onboardingResult,
  ] = await Promise.all([
    supabase
      .from("restaurants")
      .select(
        "id, name, slug, status, is_demo, demo_locked, demo_last_reset_at, created_at",
      )
      .order("created_at", { ascending: false }),
    supabase.from("restaurant_subscriptions").select("*"),
    supabase
      .from("subscription_plans")
      .select("id, name, code, is_active")
      .order("sort_order"),
    supabase
      .from("restaurant_onboarding")
      .select("restaurant_id, progress_percent"),
  ]);

  const error =
    restaurantsResult.error ||
    subscriptionsResult.error ||
    plansResult.error ||
    onboardingResult.error;
  if (error) throw new Error(error.message);

  const restaurants = restaurantsResult.data ?? [];
  const subscriptions = subscriptionsResult.data ?? [];
  const plans = plansResult.data ?? [];
  const activePlans = plans.filter((plan) => plan.is_active);
  const onboarding = onboardingResult.data ?? [];

  return (
    <div className="space-y-7 p-4 sm:p-6 lg:p-8">
      <header>
        <p className="text-sm font-medium text-amber-600">
          Clientes da plataforma
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Restaurantes
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Controle acesso, plano, piloto comercial e ambientes de demonstração.
        </p>
      </header>

      <Card
        id="novo-restaurante"
        className="scroll-mt-6 border-amber-200 bg-amber-50/40 shadow-none"
      >
        <CardHeader className="border-b border-amber-100">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-zinc-950">
              <Plus className="size-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Cadastrar novo restaurante</CardTitle>
              <p className="mt-1 text-sm text-zinc-600">
                Crie o espaço do restaurante e envie o acesso ao proprietário.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          <form action={createRestaurantFromAdminAction} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Nome do restaurante</span>
                <input
                  name="name"
                  required
                  placeholder="Ex.: Casa da Brasa"
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-amber-500"
                />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Endereço do menu</span>
                <input
                  name="slug"
                  placeholder="Gerado automaticamente"
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-amber-500"
                />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Nome do proprietário</span>
                <input
                  name="ownerName"
                  placeholder="Nome completo"
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-amber-500"
                />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">E-mail do proprietário</span>
                <input
                  type="email"
                  name="ownerEmail"
                  required
                  placeholder="proprietario@restaurante.pt"
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-amber-500"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Plano</span>
                <select
                  name="planId"
                  required
                  defaultValue=""
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3"
                >
                  <option value="" disabled>
                    Selecione o plano
                  </option>
                  {activePlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Estado inicial</span>
                <select
                  name="status"
                  defaultValue="draft"
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3"
                >
                  <option value="draft">Rascunho</option>
                  <option value="active">Ativo</option>
                  <option value="suspended">Suspenso</option>
                  <option value="inactive">Inativo</option>
                </select>
              </label>
              <div className="space-y-1.5 text-sm md:col-span-2">
                <span className="font-medium">Canais disponíveis</span>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <label className="flex h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3">
                    <input type="checkbox" name="acceptsDelivery" defaultChecked />
                    Entrega
                  </label>
                  <label className="flex h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3">
                    <input type="checkbox" name="acceptsPickup" defaultChecked />
                    Levantamento
                  </label>
                  <label className="flex h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3">
                    <input type="checkbox" name="acceptsDineIn" />
                    No local
                  </label>
                  <label className="flex h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3">
                    <input type="checkbox" name="acceptsReservations" />
                    Reservas
                  </label>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                <label className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white p-3 text-sm">
                  <input type="checkbox" name="billingExempt" />
                  Piloto sem cobrança
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white p-3 text-sm">
                  <input type="checkbox" name="isDemo" />
                  Ambiente de demonstração
                </label>
              </div>
              <Button type="submit" className="gap-2">
                <Mail className="size-4" />
                Criar e enviar convite
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {restaurants.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-zinc-500">
            Ainda não há restaurantes.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {restaurants.map((restaurant) => {
            const subscription = subscriptions.find(
              (item) => item.restaurant_id === restaurant.id,
            );
            const progress =
              onboarding.find((item) => item.restaurant_id === restaurant.id)
                ?.progress_percent ?? 0;

            return (
              <Card key={restaurant.id} className="border-zinc-200 shadow-none">
                <CardHeader className="border-b border-zinc-100">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-zinc-950 text-white">
                        <Store className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="truncate text-lg">
                          {restaurant.name}
                        </CardTitle>
                        <p className="mt-1 truncate text-xs text-zinc-400">
                          /{restaurant.slug}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {restaurant.is_demo ? (
                        <Badge className="bg-violet-100 text-violet-700">
                          Demo
                        </Badge>
                      ) : null}
                      {subscription?.billing_exempt ? (
                        <Badge className="bg-amber-100 text-amber-800">
                          Piloto
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5 p-5">
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="rounded-xl bg-zinc-50 p-3">
                      <p className="text-xs text-zinc-400">Configuração</p>
                      <p className="mt-1 font-semibold">{progress}%</p>
                    </div>
                    <div className="rounded-xl bg-zinc-50 p-3">
                      <p className="text-xs text-zinc-400">Assinatura</p>
                      <p className="mt-1 truncate font-semibold">
                        {subscription?.status ?? "—"}
                      </p>
                    </div>
                    <div className="rounded-xl bg-zinc-50 p-3">
                      <p className="text-xs text-zinc-400">Entrada</p>
                      <p className="mt-1 truncate font-semibold">
                        {formatDateTime(restaurant.created_at).split(",")[0]}
                      </p>
                    </div>
                  </div>

                  <form
                    action={updateRestaurantCommercialAction}
                    className="space-y-4"
                  >
                    <input
                      type="hidden"
                      name="restaurantId"
                      value={restaurant.id}
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="space-y-1.5 text-sm">
                        <span className="font-medium">Estado</span>
                        <select
                          name="status"
                          defaultValue={restaurant.status}
                          className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3"
                        >
                          <option value="draft">Rascunho</option>
                          <option value="active">Ativo</option>
                          <option value="suspended">Suspenso</option>
                          <option value="inactive">Inativo</option>
                        </select>
                      </label>
                      <label className="space-y-1.5 text-sm">
                        <span className="font-medium">Plano</span>
                        <select
                          name="planId"
                          defaultValue={subscription?.plan_id}
                          className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3"
                          required
                        >
                          {plans.map((plan) => (
                            <option key={plan.id} value={plan.id}>
                              {plan.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <label className="flex items-center gap-2 rounded-xl border border-zinc-200 p-3 text-sm">
                        <input
                          type="checkbox"
                          name="billingExempt"
                          defaultChecked={subscription?.billing_exempt}
                        />
                        Sem cobrança
                      </label>
                      <label className="flex items-center gap-2 rounded-xl border border-zinc-200 p-3 text-sm">
                        <input
                          type="checkbox"
                          name="isDemo"
                          defaultChecked={restaurant.is_demo}
                        />
                        Demonstração
                      </label>
                      <label className="flex items-center gap-2 rounded-xl border border-zinc-200 p-3 text-sm">
                        <input
                          type="checkbox"
                          name="demoLocked"
                          defaultChecked={restaurant.demo_locked}
                        />
                        Demo protegida
                      </label>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex gap-2">
                        <Button
                          render={
                            <Link
                              href={`/r/${restaurant.slug}`}
                              target="_blank"
                            />
                          }
                          nativeButton={false}
                          variant="outline"
                          className="gap-2"
                        >
                          Menu <ExternalLink className="size-4" />
                        </Button>
                        {restaurant.status === "active" ? (
                          <Badge
                            variant="outline"
                            className="h-8 gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700"
                          >
                            <ShieldCheck className="size-3.5" />
                            Público
                          </Badge>
                        ) : null}
                      </div>
                      <Button type="submit" className="gap-2">
                        <Save className="size-4" />
                        Guardar
                      </Button>
                    </div>
                  </form>

                  {restaurant.is_demo ? (
                    <form
                      action={resetDemoRestaurantAction}
                      className="flex items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50 p-3"
                    >
                      <input
                        type="hidden"
                        name="restaurantId"
                        value={restaurant.id}
                      />
                      <div>
                        <p className="text-sm font-medium text-violet-950">
                          Limpar dados de teste
                        </p>
                        <p className="text-xs text-violet-700">
                          Última reposição:{" "}
                          {formatDateTime(restaurant.demo_last_reset_at)}
                        </p>
                      </div>
                      <Button
                        type="submit"
                        variant="outline"
                        className="gap-2 border-violet-200 bg-white"
                      >
                        <RefreshCcw className="size-4" />
                        Repor
                      </Button>
                    </form>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
