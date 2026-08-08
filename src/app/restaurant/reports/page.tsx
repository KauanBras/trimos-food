import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ReportsDashboard } from "@/features/reports/components/reports-dashboard";
import { getCurrentRestaurant } from "@/lib/restaurants/get-current-restaurant";
import { createClient } from "@/lib/supabase/server";

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const query = await searchParams;
  const period = [7, 30, 90].includes(Number(query.period)) ? Number(query.period) : 30;
  const { restaurantId, restaurant } = await getCurrentRestaurant();
  const supabase = await createClient();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - period + 1);

  const [ordersResult, reservationsResult] = await Promise.all([
    supabase.from("orders").select("id, status, total, created_at, completed_at, order_items(product_name, quantity, unit_price)").eq("restaurant_id", restaurantId).gte("created_at", start.toISOString()).order("created_at"),
    supabase.from("reservations").select("id, status, party_size, reservation_date").eq("restaurant_id", restaurantId).gte("reservation_date", isoDate(start)).order("reservation_date"),
  ]);
  if (ordersResult.error) throw new Error(`Não foi possível gerar o relatório: ${ordersResult.error.message}`);
  if (reservationsResult.error) throw new Error(`Não foi possível gerar o relatório de reservas: ${reservationsResult.error.message}`);

  const orders = ordersResult.data ?? [];
  const reservations = reservationsResult.data ?? [];
  const validOrders = orders.filter((order) => order.status !== "cancelled");
  const revenue = validOrders.reduce((sum, order) => sum + order.total, 0);
  const completed = orders.filter((order) => order.status === "completed").length;

  const days = Array.from({ length: period }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = isoDate(date);
    const dayOrders = validOrders.filter((order) => order.created_at.slice(0, 10) === key);
    const dayReservations = reservations.filter((reservation) => reservation.reservation_date === key && !["cancelled", "no_show"].includes(reservation.status));
    return { date: key, label: new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short" }).format(date), revenue: dayOrders.reduce((sum, order) => sum + order.total, 0), orders: dayOrders.length, reservations: dayReservations.length };
  });

  const productMap = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const order of validOrders) {
    for (const item of order.order_items) {
      const current = productMap.get(item.product_name) ?? { name: item.product_name, quantity: 0, revenue: 0 };
      current.quantity += item.quantity;
      current.revenue += item.quantity * item.unit_price;
      productMap.set(item.product_name, current);
    }
  }
  const topProducts = [...productMap.values()].sort((a, b) => b.quantity - a.quantity);
  const validReservations = reservations.filter((reservation) => !["cancelled", "no_show"].includes(reservation.status));

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div><p className="text-sm font-medium text-amber-600">Inteligência do negócio</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Relatórios</h1><p className="mt-2 text-sm text-zinc-500">Vendas, procura, reservas e desempenho dos produtos com dados reais.</p></div>
        <div className="flex rounded-xl border border-zinc-200 bg-white p-1">{[7, 30, 90].map((value) => <Button key={value} render={<Link href={`/restaurant/reports?period=${value}`} />} nativeButton={false} size="sm" variant={period === value ? "default" : "ghost"}>{value} dias</Button>)}</div>
      </section>
      <ReportsDashboard currencyCode={restaurant.currency_code} days={days} topProducts={topProducts} metrics={{ revenue, orders: validOrders.length, averageTicket: validOrders.length ? revenue / validOrders.length : 0, completedRate: orders.length ? (completed / orders.length) * 100 : 0, reservations: validReservations.length, guests: validReservations.reduce((sum, item) => sum + item.party_size, 0) }} />
    </div>
  );
}
