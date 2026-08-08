import Link from "next/link";
import { CalendarDays, Search, ShoppingBag, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getCurrentRestaurant } from "@/lib/restaurants/get-current-restaurant";
import { createClient } from "@/lib/supabase/server";

export default async function RestaurantSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim().slice(0, 80) ?? "";
  const { restaurantId, restaurant } = await getCurrentRestaurant();
  const supabase = await createClient();

  const [ordersResult, customersResult, reservationsResult] = query
    ? await Promise.all([
        supabase
          .from("orders")
          .select("id, customer_name, status, type, total, created_at")
          .eq("restaurant_id", restaurantId)
          .ilike("customer_name", `%${query}%`)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("customers")
          .select("id, name, phone, email, is_blocked")
          .eq("restaurant_id", restaurantId)
          .ilike("name", `%${query}%`)
          .order("name")
          .limit(10),
        supabase
          .from("reservations")
          .select("id, customer_name, reservation_date, reservation_time, party_size, status")
          .eq("restaurant_id", restaurantId)
          .ilike("customer_name", `%${query}%`)
          .order("reservation_date", { ascending: false })
          .limit(10),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
      ];

  const orders = ordersResult.data ?? [];
  const customers = customersResult.data ?? [];
  const reservations = reservationsResult.data ?? [];
  const totalResults = orders.length + customers.length + reservations.length;

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <p className="text-sm font-medium text-amber-600">Pesquisa global</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Encontrar no restaurante
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Pesquise clientes, pedidos e reservas de {restaurant.name}.
        </p>
      </div>

      <form className="relative max-w-2xl">
        <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-zinc-400" />
        <Input
          autoFocus
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Nome do cliente..."
          className="h-12 rounded-2xl bg-white pl-12"
        />
      </form>

      {!query ? (
        <div className="rounded-3xl border border-dashed border-zinc-300 bg-white p-12 text-center text-zinc-500">
          Escreva o nome de um cliente para começar.
        </div>
      ) : totalResults === 0 ? (
        <div className="rounded-3xl border border-dashed border-zinc-300 bg-white p-12 text-center text-zinc-500">
          Nenhum resultado para “{query}”.
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-3">
          <Card className="border-zinc-200 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShoppingBag className="size-5" /> Pedidos ({orders.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {orders.length ? (
                orders.map((order) => (
                  <Link key={order.id} href="/restaurant/orders" className="block rounded-2xl bg-zinc-50 p-4 transition hover:bg-zinc-100">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{order.customer_name}</p>
                        <p className="mt-1 text-xs text-zinc-500">#{order.id.slice(0, 6).toUpperCase()} · {new Intl.DateTimeFormat("pt-PT", { dateStyle: "short" }).format(new Date(order.created_at))}</p>
                      </div>
                      <p className="font-semibold">{new Intl.NumberFormat("pt-PT", { style: "currency", currency: restaurant.currency_code }).format(Number(order.total))}</p>
                    </div>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-zinc-500">Sem pedidos encontrados.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-zinc-200 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><Users className="size-5" /> Clientes ({customers.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {customers.length ? customers.map((customer) => (
                <Link key={customer.id} href="/restaurant/customers" className="block rounded-2xl bg-zinc-50 p-4 transition hover:bg-zinc-100">
                  <div className="flex items-start justify-between gap-3"><div><p className="font-medium">{customer.name}</p><p className="mt-1 text-xs text-zinc-500">{customer.phone || customer.email || "Sem contacto"}</p></div>{customer.is_blocked ? <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">Bloqueado</Badge> : null}</div>
                </Link>
              )) : <p className="text-sm text-zinc-500">Sem clientes encontrados.</p>}
            </CardContent>
          </Card>

          <Card className="border-zinc-200 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><CalendarDays className="size-5" /> Reservas ({reservations.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {reservations.length ? reservations.map((reservation) => (
                <Link key={reservation.id} href="/restaurant/reservations" className="block rounded-2xl bg-zinc-50 p-4 transition hover:bg-zinc-100">
                  <div className="flex items-start justify-between gap-3"><div><p className="font-medium">{reservation.customer_name}</p><p className="mt-1 text-xs text-zinc-500">{reservation.reservation_date} às {reservation.reservation_time.slice(0, 5)} · {reservation.party_size} pessoas</p></div><Badge variant="outline">{reservation.status}</Badge></div>
                </Link>
              )) : <p className="text-sm text-zinc-500">Sem reservas encontradas.</p>}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
