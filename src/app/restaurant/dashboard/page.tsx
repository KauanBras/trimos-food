import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bike,
  CalendarDays,
  CheckCircle2,
  ChefHat,
  ChevronRight,
  Clock3,
  Euro,
  ShoppingBag,
  Sparkles,
  Timer,
  UtensilsCrossed,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { pt } from "date-fns/locale";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getCurrentRestaurant } from "@/lib/restaurants/get-current-restaurant";
import { getRestaurantOperatingStatus } from "@/lib/restaurants/operating-status";
import { createClient } from "@/lib/supabase/server";

const statusLabels: Record<string, string> = {
  new: "Novo pedido",
  confirmed: "Confirmado",
  preparing: "Em preparação",
  ready: "Pronto",
  awaiting_driver: "À espera de estafeta",
  out_for_delivery: "Em entrega",
  completed: "Concluído",
  cancelled: "Cancelado",
};

const statusClasses: Record<string, string> = {
  new: "border-red-200 bg-red-50 text-red-700",
  confirmed: "border-blue-200 bg-blue-50 text-blue-700",
  preparing: "border-amber-200 bg-amber-50 text-amber-700",
  ready: "border-emerald-200 bg-emerald-50 text-emerald-700",
  awaiting_driver: "border-violet-200 bg-violet-50 text-violet-700",
  out_for_delivery: "border-sky-200 bg-sky-50 text-sky-700",
  completed: "border-zinc-200 bg-zinc-100 text-zinc-700",
  cancelled: "border-zinc-200 bg-zinc-50 text-zinc-500",
};

function formatCurrency(value: number, currency = "EUR") {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency,
  }).format(value);
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function percentChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export default async function RestaurantDashboardPage() {
  const { restaurantId, restaurant, user } = await getCurrentRestaurant();
  const supabase = await createClient();
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const todayDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: restaurant.timezone,
  }).format(now);

  const [
    ordersResult,
    reservationsResult,
    driversResult,
    profileResult,
    hoursResult,
  ] = await Promise.all([
    supabase
      .from("orders")
      .select(`
        id,
        customer_name,
        type,
        status,
        total,
        estimated_minutes,
        accepted_at,
        ready_at,
        created_at,
        order_items(product_name, quantity)
      `)
      .eq("restaurant_id", restaurantId)
      .gte("created_at", yesterdayStart.toISOString())
      .order("created_at", { ascending: false }),
    supabase
      .from("reservations")
      .select("id, customer_name, reservation_date, reservation_time, party_size, status, table_label")
      .eq("restaurant_id", restaurantId)
      .gte("reservation_date", todayDate)
      .in("status", ["pending", "confirmed", "seated"])
      .order("reservation_date")
      .order("reservation_time"),
    supabase
      .from("drivers")
      .select("id, status, is_active")
      .eq("restaurant_id", restaurantId),
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("business_hours")
      .select("day_of_week, opens_at, closes_at, is_closed")
      .eq("restaurant_id", restaurantId),
  ]);

  if (ordersResult.error) {
    throw new Error(`Não foi possível carregar o painel: ${ordersResult.error.message}`);
  }

  const orders = ordersResult.data ?? [];
  const reservations = reservationsResult.data ?? [];
  const drivers = driversResult.data ?? [];
  const todayOrders = orders.filter(
    (order) => new Date(order.created_at) >= todayStart,
  );
  const yesterdayOrders = orders.filter((order) => {
    const createdAt = new Date(order.created_at);
    return createdAt >= yesterdayStart && createdAt < todayStart;
  });
  const billableToday = todayOrders.filter((order) => order.status !== "cancelled");
  const billableYesterday = yesterdayOrders.filter(
    (order) => order.status !== "cancelled",
  );
  const revenueToday = billableToday.reduce(
    (sum, order) => sum + Number(order.total),
    0,
  );
  const revenueYesterday = billableYesterday.reduce(
    (sum, order) => sum + Number(order.total),
    0,
  );
  const averageTicket = billableToday.length
    ? revenueToday / billableToday.length
    : 0;
  const preparationTimes = todayOrders
    .filter((order) => order.accepted_at && order.ready_at)
    .map(
      (order) =>
        (new Date(order.ready_at!).getTime() -
          new Date(order.accepted_at!).getTime()) /
        60_000,
    )
    .filter((minutes) => minutes >= 0);
  const averagePreparation = preparationTimes.length
    ? Math.round(
        preparationTimes.reduce((sum, value) => sum + value, 0) /
          preparationTimes.length,
      )
    : 0;
  const activeOrders = todayOrders.filter((order) =>
    ["new", "confirmed", "preparing", "ready", "awaiting_driver", "out_for_delivery"].includes(
      order.status,
    ),
  );
  const kitchenOrders = activeOrders.filter((order) =>
    ["confirmed", "preparing"].includes(order.status),
  );
  const todayReservations = reservations.filter(
    (reservation) => reservation.reservation_date === todayDate,
  );
  const expectedGuests = todayReservations.reduce(
    (sum, reservation) => sum + reservation.party_size,
    0,
  );
  const availableDrivers = drivers.filter(
    (driver) => driver.is_active && driver.status === "available",
  ).length;
  const nextReservation = reservations[0] ?? null;
  const completedToday = todayOrders.filter(
    (order) => order.status === "completed",
  ).length;
  const acceptanceRate = todayOrders.length
    ? Math.round(
        (todayOrders.filter((order) => order.status !== "cancelled").length /
          todayOrders.length) *
          100,
      )
    : 100;
  const operatingStatus = getRestaurantOperatingStatus(
    hoursResult.data ?? [],
    restaurant.timezone,
  );
  const displayName =
    profileResult.data?.full_name?.split(" ")[0] ||
    user.user_metadata?.full_name?.split(" ")[0] ||
    "equipa";
  const hour = Number(
    new Intl.DateTimeFormat("pt-PT", {
      timeZone: restaurant.timezone,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  );
  const greeting = hour < 12 ? "Bom dia" : hour < 19 ? "Boa tarde" : "Boa noite";
  const revenueChange = percentChange(revenueToday, revenueYesterday);
  const orderChange = todayOrders.length - yesterdayOrders.length;

  const metrics = [
    {
      title: "Vendas de hoje",
      value: formatCurrency(revenueToday, restaurant.currency_code),
      change: `${revenueChange >= 0 ? "+" : ""}${revenueChange.toFixed(1)}%`,
      positive: revenueChange >= 0,
      detail: "comparado com ontem",
      icon: Euro,
    },
    {
      title: "Pedidos de hoje",
      value: String(todayOrders.length),
      change: `${orderChange >= 0 ? "+" : ""}${orderChange}`,
      positive: orderChange >= 0,
      detail: "comparado com ontem",
      icon: ShoppingBag,
    },
    {
      title: "Ticket médio",
      value: formatCurrency(averageTicket, restaurant.currency_code),
      change: `${billableToday.length} pagos`,
      positive: true,
      detail: "pedidos não cancelados",
      icon: Sparkles,
    },
    {
      title: "Tempo médio",
      value: averagePreparation ? `${averagePreparation} min` : "—",
      change: `${preparationTimes.length}`,
      positive: averagePreparation <= 30,
      detail: "pedidos com tempo medido",
      icon: Timer,
    },
  ];

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8">
      <section className="relative overflow-hidden rounded-3xl bg-zinc-950 px-6 py-7 text-white shadow-sm lg:px-8">
        <div className="absolute -right-20 -top-24 size-72 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="absolute bottom-0 right-32 size-40 rounded-full bg-white/5 blur-2xl" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm text-zinc-400">
              <span
                className={`size-2 rounded-full ${operatingStatus.isOpen ? "bg-emerald-400" : "bg-zinc-500"}`}
              />
              {operatingStatus.label}
            </div>
            <h1 className="text-3xl font-semibold tracking-tight lg:text-4xl">
              {greeting}, {displayName}.
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">
              {restaurant.name} tem {activeOrders.length} pedido{activeOrders.length === 1 ? "" : "s"} ativo{activeOrders.length === 1 ? "" : "s"}
              {restaurant.accepts_reservations
                ? ` e ${todayReservations.length} reserva${todayReservations.length === 1 ? "" : "s"} para hoje.`
                : ". As reservas estão desativadas; delivery e takeaway continuam ativos."}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {restaurant.accepts_reservations ? (
              <Button
                render={<Link href="/restaurant/reservations" />}
                nativeButton={false}
                variant="outline"
                className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              >
                Ver reservas
              </Button>
            ) : null}
            <Button
              render={<Link href="/restaurant/orders" />}
              nativeButton={false}
              className="gap-2 bg-amber-400 text-zinc-950 hover:bg-amber-300"
            >
              Abrir modo operação
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          const ChangeIcon = metric.positive ? ArrowUpRight : ArrowDownRight;
          return (
            <Card key={metric.title} className="border-zinc-200 shadow-none transition hover:-translate-y-0.5 hover:shadow-md">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-zinc-500">{metric.title}</p>
                    <p className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">{metric.value}</p>
                  </div>
                  <div className="rounded-2xl bg-zinc-100 p-3"><Icon className="size-5 text-zinc-700" /></div>
                </div>
                <div className="mt-5 flex items-center gap-2 text-xs">
                  <span className={`flex items-center gap-1 font-semibold ${metric.positive ? "text-emerald-600" : "text-red-600"}`}>
                    <ChangeIcon className="size-3.5" />{metric.change}
                  </span>
                  <span className="text-zinc-400">{metric.detail}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card className="border-zinc-200 shadow-none">
          <CardHeader className="flex flex-row items-start justify-between border-b border-zinc-100">
            <div>
              <div className="flex items-center gap-2">
                {activeOrders.some((order) => order.status === "new") ? (
                  <span className="relative flex size-2.5">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
                  </span>
                ) : null}
                <CardTitle className="text-lg">Pedidos em tempo real</CardTitle>
              </div>
              <p className="mt-1 text-sm text-zinc-500">Pedidos mais recentes recebidos pelo restaurante.</p>
            </div>
            <Button render={<Link href="/restaurant/orders" />} nativeButton={false} variant="ghost" size="sm" className="gap-2">
              Ver todos<ChevronRight className="size-4" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {todayOrders.length === 0 ? (
              <div className="p-10 text-center text-sm text-zinc-500">Ainda não há pedidos hoje.</div>
            ) : (
              todayOrders.slice(0, 5).map((order, index) => (
                <div key={order.id}>
                  <Link href="/restaurant/orders" className="flex flex-col gap-4 p-5 transition hover:bg-zinc-50 sm:flex-row sm:items-center">
                    <Avatar className="size-11">
                      <AvatarFallback className="bg-zinc-100 text-xs font-semibold text-zinc-700">{initials(order.customer_name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-zinc-950">#{order.id.slice(0, 6).toUpperCase()} · {order.customer_name}</p>
                        <Badge variant="outline" className={statusClasses[order.status]}>{statusLabels[order.status]}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-zinc-500">
                        {order.type === "delivery" ? "Entrega" : order.type === "pickup" ? "Recolha" : "No local"} · {formatCurrency(Number(order.total), restaurant.currency_code)} · {formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: pt })}
                      </p>
                    </div>
                    <ChevronRight className="size-4 text-zinc-400" />
                  </Link>
                  {index < Math.min(todayOrders.length, 5) - 1 ? <Separator /> : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card className="border-zinc-200 shadow-none">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div><CardTitle className="text-lg">Operação agora</CardTitle><p className="mt-1 text-sm text-zinc-500">Estado atual do restaurante.</p></div>
                <div className="rounded-2xl bg-emerald-50 p-3"><CheckCircle2 className="size-5 text-emerald-600" /></div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {[
                { icon: ChefHat, label: "Em preparação", detail: "Cozinha ativa", value: kitchenOrders.length },
                { icon: Bike, label: "Estafetas online", detail: "Disponíveis agora", value: availableDrivers },
                { icon: CalendarDays, label: "Reservas hoje", detail: `${expectedGuests} pessoas previstas`, value: todayReservations.length },
              ].filter((item) => restaurant.accepts_reservations || item.label !== "Reservas hoje").map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-zinc-100 p-2"><item.icon className="size-4 text-zinc-600" /></div>
                    <div><p className="text-sm font-medium">{item.label}</p><p className="text-xs text-zinc-500">{item.detail}</p></div>
                  </div>
                  <span className="text-lg font-semibold">{item.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {restaurant.accepts_reservations ? <Card className="border-zinc-200 bg-amber-50 shadow-none">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl bg-amber-400 p-3 text-zinc-950"><UtensilsCrossed className="size-5" /></div>
                <div>
                  <p className="font-semibold text-zinc-950">Próxima reserva</p>
                  {nextReservation ? (
                    <><p className="mt-1 text-sm text-zinc-600">{nextReservation.customer_name} · {nextReservation.reservation_date === todayDate ? "Hoje" : nextReservation.reservation_date} às {nextReservation.reservation_time.slice(0, 5)}</p><p className="mt-1 text-sm text-zinc-600">Mesa para {nextReservation.party_size} pessoa{nextReservation.party_size === 1 ? "" : "s"}</p></>
                  ) : (
                    <p className="mt-1 text-sm text-zinc-600">Sem reservas futuras por confirmar.</p>
                  )}
                </div>
              </div>
              <Button render={<Link href="/restaurant/reservations" />} nativeButton={false} variant="outline" className="mt-5 w-full border-amber-300 bg-white/70">Ver reservas</Button>
            </CardContent>
          </Card> : null}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Card className="border-zinc-200 shadow-none">
          <CardHeader className="flex flex-row items-center justify-between">
            <div><CardTitle className="text-lg">Cozinha</CardTitle><p className="mt-1 text-sm text-zinc-500">Progresso dos pedidos em preparação.</p></div>
            <Button render={<Link href="/restaurant/kitchen" />} nativeButton={false} variant="outline" size="sm">Abrir cozinha</Button>
          </CardHeader>
          <CardContent className="space-y-5">
            {kitchenOrders.length === 0 ? (
              <div className="rounded-2xl bg-zinc-50 p-8 text-center text-sm text-zinc-500">A cozinha está sem pedidos ativos.</div>
            ) : kitchenOrders.slice(0, 5).map((order) => {
              const elapsed = Math.max(0, Math.round((now.getTime() - new Date(order.accepted_at ?? order.created_at).getTime()) / 60_000));
              const estimate = order.estimated_minutes ?? 30;
              const progress = Math.min(100, Math.max(8, Math.round((elapsed / estimate) * 100)));
              const itemNames = order.order_items.map((item) => `${item.quantity}× ${item.product_name}`).join(" · ");
              return (
                <div key={order.id}>
                  <div className="mb-2 flex items-center justify-between gap-4">
                    <div><p className="text-sm font-semibold text-zinc-950">#{order.id.slice(0, 6).toUpperCase()} · {itemNames || "Pedido"}</p><p className="mt-1 flex items-center gap-1 text-xs text-zinc-500"><Clock3 className="size-3.5" />Em preparação há {elapsed} min</p></div>
                    <span className="text-sm font-semibold text-zinc-600">{progress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-zinc-100"><div className="h-full rounded-full bg-amber-400" style={{ width: `${progress}%` }} /></div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-zinc-200 shadow-none">
          <CardHeader><CardTitle className="text-lg">Desempenho de hoje</CardTitle><p className="mt-1 text-sm text-zinc-500">Indicadores calculados com os pedidos reais.</p></CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="mb-2 flex justify-between text-sm"><span className="text-zinc-500">Pedidos concluídos</span><span className="font-semibold">{completedToday} de {todayOrders.length}</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-100"><div className="h-full rounded-full bg-zinc-950" style={{ width: `${todayOrders.length ? Math.round((completedToday / todayOrders.length) * 100) : 0}%` }} /></div>
            </div>
            <Separator />
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl bg-zinc-50 p-4"><p className="text-xl font-semibold">{acceptanceRate}%</p><p className="mt-1 text-xs text-zinc-500">Aceitação</p></div>
              <div className="rounded-2xl bg-zinc-50 p-4"><p className="text-xl font-semibold">{completedToday}</p><p className="mt-1 text-xs text-zinc-500">Concluídos</p></div>
              <div className="rounded-2xl bg-zinc-50 p-4"><p className="text-xl font-semibold">{averagePreparation ? `${averagePreparation}m` : "—"}</p><p className="mt-1 text-xs text-zinc-500">Preparação</p></div>
            </div>
            <Button render={<Link href="/restaurant/reports" />} nativeButton={false} variant="outline" className="w-full">Abrir relatórios</Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
