import Link from "next/link";
import {
  ArrowRight,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Store,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireSuperAdmin } from "@/lib/platform/admin";
import { formatDateTime } from "@/lib/platform/format";

const subscriptionLabels: Record<string, string> = {
  incomplete: "Incompleta",
  trialing: "Promocional",
  active: "Ativa",
  past_due: "Pagamento pendente",
  paused: "Pausada",
  canceled: "Cancelada",
  unpaid: "Em dívida",
};

export default async function AdminDashboardPage() {
  const { supabase } = await requireSuperAdmin();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [restaurantsResult, subscriptionsResult, ordersResult] =
    await Promise.all([
      supabase
        .from("restaurants")
        .select("id, name, slug, status, is_demo, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("restaurant_subscriptions")
        .select(
          "restaurant_id, status, billing_exempt, trial_ends_at, subscription_plans(name)",
        ),
      supabase
        .from("orders")
        .select("restaurant_id, total, status")
        .gte("created_at", monthStart.toISOString()),
    ]);

  if (
    restaurantsResult.error ||
    subscriptionsResult.error ||
    ordersResult.error
  ) {
    throw new Error(
      restaurantsResult.error?.message ||
        subscriptionsResult.error?.message ||
        ordersResult.error?.message ||
        "Não foi possível carregar a administração.",
    );
  }

  const restaurants = restaurantsResult.data ?? [];
  const subscriptions = subscriptionsResult.data ?? [];
  const orders = ordersResult.data ?? [];
  const activeSubscriptions = subscriptions.filter(
    (item) => item.status === "active" || item.status === "trialing",
  ).length;
  const trials = subscriptions.filter(
    (item) => item.status === "trialing",
  ).length;
  const monthlyVolume = orders
    .filter((order) => order.status !== "cancelled")
    .reduce((total, order) => total + Number(order.total), 0);

  const metrics = [
    {
      label: "Restaurantes",
      value: restaurants.length,
      detail: `${restaurants.filter((item) => item.status === "active").length} ativos`,
      icon: Store,
    },
    {
      label: "Assinaturas operacionais",
      value: activeSubscriptions,
      detail: `${trials} em condição promocional`,
      icon: CreditCard,
    },
    {
      label: "Pedidos este mês",
      value: orders.length,
      detail: "em todos os restaurantes",
      icon: Clock3,
    },
    {
      label: "Volume processado",
      value: new Intl.NumberFormat("pt-PT", {
        style: "currency",
        currency: "EUR",
      }).format(monthlyVolume),
      detail: "não representa receita da Trimos",
      icon: CircleDollarSign,
    },
  ];

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-amber-600">
            Centro de controlo
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Plataforma Trimos
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Restaurantes, faturação, demonstrações e saúde operacional num só
            lugar.
          </p>
        </div>
        <Button
          render={<Link href="/admin/restaurants" />}
          nativeButton={false}
          className="gap-2"
        >
          Gerir restaurantes <ArrowRight className="size-4" />
        </Button>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.label} className="border-zinc-200 shadow-none">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-zinc-500">{metric.label}</p>
                    <p className="mt-3 text-3xl font-semibold tracking-tight">
                      {metric.value}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
                    <Icon className="size-5" />
                  </div>
                </div>
                <p className="mt-4 text-xs text-zinc-400">{metric.detail}</p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <Card className="border-zinc-200 shadow-none">
        <CardHeader className="flex-row items-center justify-between border-b border-zinc-100">
          <CardTitle>Restaurantes recentes</CardTitle>
          <Button
            render={<Link href="/admin/restaurants" />}
            nativeButton={false}
            variant="ghost"
            size="sm"
          >
            Ver todos
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-5">Restaurante</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Assinatura</TableHead>
                <TableHead>Entrada</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {restaurants.slice(0, 8).map((restaurant) => {
                const subscription = subscriptions.find(
                  (item) => item.restaurant_id === restaurant.id,
                );
                return (
                  <TableRow key={restaurant.id}>
                    <TableCell className="px-5 py-4">
                      <div className="font-medium">{restaurant.name}</div>
                      <div className="text-xs text-zinc-400">
                        /{restaurant.slug}
                      </div>
                    </TableCell>
                    <TableCell>
                      {subscription?.subscription_plans?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {subscription?.billing_exempt
                          ? "Piloto"
                          : subscription
                            ? subscriptionLabels[subscription.status]
                            : "Sem assinatura"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-zinc-500">
                      {formatDateTime(restaurant.created_at)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
