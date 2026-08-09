/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChefHat,
  Clock3,
  Flame,
  PackageCheck,
  Timer,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/types/database";
import type { Database } from "@/types/database";

type OrderStatus = Database["public"]["Enums"]["order_status"];

type KitchenOrder = {
  id: string;
  customer_name: string;
  type: Database["public"]["Enums"]["order_type"];
  table_label: string | null;
  status: OrderStatus;
  estimated_minutes: number | null;
  accepted_at: string | null;
  ready_at: string | null;
  created_at: string;
  order_items: {
    id: string;
    product_name: string;
    quantity: number;
    notes: string | null;
    variant_name: string | null;
    selected_modifiers: Json;
  }[];
};

type KitchenPageProps = {
  initialOrders?: KitchenOrder[];
  restaurantId?: string;
};

function getElapsedMinutes(createdAt: string) {
  return Math.max(
    1,
    Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
  );
}

function getUrgency(elapsed: number, estimated: number) {
  const ratio = elapsed / estimated;

  if (ratio >= 0.9) {
    return {
      label: "Urgente",
      cardClass: "border-red-300 bg-red-50/50",
      badgeClass: "border-red-200 bg-red-100 text-red-700",
      progressClass: "bg-red-500",
    };
  }

  if (ratio >= 0.65) {
    return {
      label: "Atenção",
      cardClass: "border-amber-300 bg-amber-50/50",
      badgeClass: "border-amber-200 bg-amber-100 text-amber-700",
      progressClass: "bg-amber-500",
    };
  }

  return {
    label: "No tempo",
    cardClass: "border-zinc-200 bg-white",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    progressClass: "bg-emerald-500",
  };
}

function KitchenClient({
  initialOrders = [],
  restaurantId = "",
}: KitchenPageProps) {
  const supabase = useMemo(() => createClient(), []);
  const [orders, setOrders] = useState(initialOrders);

  async function fetchKitchenOrder(orderId: string) {
    const { data, error } = await supabase
      .from("orders")
      .select(`
        id,
        customer_name,
        type,
        table_label,
        status,
        estimated_minutes,
        accepted_at,
        ready_at,
        created_at,
        order_items (
          id,
          product_name,
          quantity,
          notes,
          variant_name,
          selected_modifiers
        )
      `)
      .eq("id", orderId)
      .single();

    if (error || !data) {
      return null;
    }

    return data as KitchenOrder;
  }

  useEffect(() => {
    if (!restaurantId) {
      return;
    }

    const channel = supabase
      .channel(`kitchen-orders-${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        async (payload) => {
          const orderId =
            (payload.new as { id?: string })?.id ??
            (payload.old as { id?: string })?.id;

          if (!orderId) {
            return;
          }

          const order = await fetchKitchenOrder(orderId);

          if (!order) {
            return;
          }

          const belongsInKitchen = [
            "preparing",
            "ready",
          ].includes(order.status);

          setOrders((current) => {
            if (!belongsInKitchen) {
              return current.filter((item) => item.id !== order.id);
            }

            const exists = current.some((item) => item.id === order.id);

            if (exists) {
              return current.map((item) =>
                item.id === order.id ? order : item
              );
            }

            return [order, ...current];
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [restaurantId, supabase]);

  async function updateStatus(orderId: string, status: OrderStatus) {
    const { error } = await supabase
      .from("orders")
      .update({
        status,
        ready_at: status === "ready" ? new Date().toISOString() : undefined,
      })
      .eq("id", orderId)
      .eq("restaurant_id", restaurantId);

    if (error) {
      toast.error("Não foi possível atualizar o pedido", {
        description: error.message,
      });
      return;
    }

    setOrders((current) =>
      current.map((order) =>
        order.id === orderId ? { ...order, status } : order
      )
    );
  }

  const preparingOrders = orders.filter(
    (order) => order.status === "preparing"
  );

  const readyOrders = orders.filter((order) => order.status === "ready");
  const measuredTimes = orders
    .filter((order) => order.accepted_at && order.ready_at)
    .map((order) => {
      return Math.max(
        0,
        (new Date(order.ready_at!).getTime() -
          new Date(order.accepted_at!).getTime()) /
          60_000,
      );
    });
  const averageCurrentMinutes = measuredTimes.length
    ? Math.round(measuredTimes.reduce((sum, minutes) => sum + minutes, 0) / measuredTimes.length)
    : null;

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <div className="flex items-center gap-2 text-amber-600">
            <ChefHat className="size-4" />
            <span className="text-sm font-medium">
              Kitchen Display System
            </span>
          </div>

          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Cozinha
          </h1>

          <p className="mt-2 text-sm text-zinc-500">
            Pedidos reais do Supabase, atualizados em tempo real.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Badge
            variant="outline"
            className="h-10 gap-2 rounded-xl border-amber-200 bg-amber-50 px-4 text-amber-700"
          >
            <Flame className="size-4" />
            {preparingOrders.length} em preparação
          </Badge>

          <Badge
            variant="outline"
            className="h-10 gap-2 rounded-xl border-emerald-200 bg-emerald-50 px-4 text-emerald-700"
          >
            <PackageCheck className="size-4" />
            {readyOrders.length} prontos
          </Badge>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.8fr_1fr]">
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold">Em preparação</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Pedidos ativos na cozinha.
            </p>
          </div>

          {preparingOrders.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-300 bg-white text-center">
              <ChefHat className="size-8 text-zinc-400" />
              <p className="mt-4 font-medium">
                Nenhum pedido em preparação
              </p>
            </div>
          ) : (
            <div className="grid gap-5 2xl:grid-cols-2">
              {preparingOrders.map((order) => {
                const elapsed = getElapsedMinutes(order.accepted_at ?? order.created_at);
                const estimated = order.estimated_minutes ?? 30;
                const urgency = getUrgency(elapsed, estimated);
                const progress = Math.min(
                  100,
                  Math.round((elapsed / estimated) * 100)
                );

                return (
                  <Card
                    key={order.id}
                    className={`overflow-hidden shadow-none ${urgency.cardClass}`}
                  >
                    <CardHeader className="border-b border-black/5">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle>
                            #{order.id.slice(0, 6).toUpperCase()}
                          </CardTitle>
                          <p className="mt-1 text-sm text-zinc-500">
                            {order.customer_name}{order.table_label ? ` · ${order.table_label}` : ""}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={urgency.badgeClass}
                          >
                            {urgency.label}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-5 p-5">
                      <div className="space-y-3">
                        {order.order_items.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-2xl bg-white/80 p-4"
                          >
                            <p className="font-semibold">
                              {item.quantity}x {item.product_name}
                              {item.variant_name ? ` · ${item.variant_name}` : ""}
                            </p>

                            {item.notes && (
                              <p className="mt-1 text-sm font-medium text-amber-700">
                                Nota: {item.notes}
                              </p>
                            )}
                            {Array.isArray(item.selected_modifiers) && item.selected_modifiers.map((modifier) => typeof modifier === "object" && modifier && "option" in modifier ? `${"quantity" in modifier ? Number(modifier.quantity) : 1}x ${String(modifier.option)}` : "").filter(Boolean).length > 0 && <p className="mt-1 text-sm text-zinc-500">{item.selected_modifiers.map((modifier) => typeof modifier === "object" && modifier && "option" in modifier ? `${"quantity" in modifier ? Number(modifier.quantity) : 1}x ${String(modifier.option)}` : "").filter(Boolean).join(", ")}</p>}
                          </div>
                        ))}
                      </div>

                      <div>
                        <div className="mb-2 flex justify-between text-sm">
                          <span className="flex items-center gap-2 text-zinc-500">
                            <Clock3 className="size-4" />
                            {elapsed} min decorridos
                          </span>

                          <span className="font-semibold">
                            Meta: {estimated} min
                          </span>
                        </div>

                        <div className="h-2.5 overflow-hidden rounded-full bg-white">
                          <div
                            className={`h-full rounded-full ${urgency.progressClass}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>

                      <Button
                        className="h-12 w-full bg-zinc-950 hover:bg-zinc-800"
                        onClick={() => updateStatus(order.id, "ready")}
                      >
                        <Check className="mr-2 size-5" />
                        Pedido pronto
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Prontos para sair</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Aguardam recolha ou estafeta.
            </p>
          </div>

          <Card className="border-zinc-200 shadow-none">
            <CardContent className="space-y-4 p-4">
              {readyOrders.length === 0 ? (
                <div className="flex min-h-56 flex-col items-center justify-center text-center">
                  <PackageCheck className="size-7 text-zinc-400" />
                  <p className="mt-4 font-medium">Nenhum pedido pronto</p>
                </div>
              ) : (
                readyOrders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"
                  >
                    <div className="flex justify-between gap-4">
                      <div>
                        <p className="font-semibold">
                          #{order.id.slice(0, 6).toUpperCase()}
                        </p>
                        <p className="mt-1 text-sm text-zinc-600">
                          {order.customer_name}{order.table_label ? ` · ${order.table_label}` : ""}
                        </p>
                      </div>

                      <Badge className="bg-emerald-600 text-white">
                        Pronto
                      </Badge>
                    </div>

                    <div className="mt-4 space-y-1">
                      {order.order_items.map((item) => (
                        <p key={item.id} className="text-sm">
                          {item.quantity}x {item.product_name}
                          {item.variant_name ? ` · ${item.variant_name}` : ""}
                          {Array.isArray(item.selected_modifiers) && item.selected_modifiers.length > 0 ? ` · ${item.selected_modifiers.map((modifier) => typeof modifier === "object" && modifier && "option" in modifier ? `${"quantity" in modifier ? Number(modifier.quantity) : 1}x ${String(modifier.option)}` : "").filter(Boolean).join(", ")}` : ""}
                        </p>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="mt-6 bg-zinc-950 text-white shadow-none">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl bg-white/10 p-3">
                  <Timer className="size-5 text-amber-400" />
                </div>

                <div>
                  <p className="font-semibold">Tempo médio atual</p>
                  <p className="mt-1 text-3xl font-semibold">
                    {averageCurrentMinutes === null ? "—" : `${averageCurrentMinutes} min`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

export default KitchenClient;
