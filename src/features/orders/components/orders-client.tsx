/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bike,
  Check,
  Clock3,
  PackageCheck,
  Printer,
  Search,
  ShoppingBag,
  Utensils,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { updateRestaurantOrderStatusAction } from "@/features/orders/actions/order-actions";
import {
  printThermalReceipt,
  type ThermalReceiptRestaurant,
} from "@/lib/printing/thermal-receipt";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import type { Json } from "@/types/database";

type DatabaseOrderStatus =
  Database["public"]["Enums"]["order_status"];

type OrderItem = {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  notes: string | null;
  variant_name: string | null;
  selected_modifiers: Json;
};

export type RestaurantOrder = {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  table_label: string | null;
  type: Database["public"]["Enums"]["order_type"];
  status: DatabaseOrderStatus;
  subtotal: number;
  delivery_fee: number;
  total: number;
  payment_method: Database["public"]["Enums"]["payment_method"];
  payment_status: Database["public"]["Enums"]["payment_status"];
  cash_tendered_amount: number | null;
  delivery_address: string | null;
  delivery_distance_km: number | null;
  notes: string | null;
  estimated_minutes: number | null;
  created_at: string;
  order_items: OrderItem[];
};

type OrdersClientProps = {
  restaurantId: string;
  initialOrders: RestaurantOrder[];
  currencyCode: string;
  receiptRestaurant: ThermalReceiptRestaurant;
  printerSettings: {
    enabled: boolean;
    paperWidth: 58 | 80;
    copies: number;
    autoPrint: boolean;
  };
};

const statusConfig: Record<
  DatabaseOrderStatus,
  {
    label: string;
    className: string;
    icon: typeof ShoppingBag;
  }
> = {
  pending_payment: {
    label: "Aguarda pagamento",
    className: "border-violet-200 bg-violet-50 text-violet-700",
    icon: Clock3,
  },
  new: {
    label: "Novo pedido",
    className: "border-red-200 bg-red-50 text-red-700",
    icon: ShoppingBag,
  },
  confirmed: {
    label: "Confirmado",
    className: "border-orange-200 bg-orange-50 text-orange-700",
    icon: Check,
  },
  preparing: {
    label: "Em preparação",
    className: "border-amber-200 bg-amber-50 text-amber-700",
    icon: Utensils,
  },
  ready: {
    label: "Pronto",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: PackageCheck,
  },
  awaiting_driver: {
    label: "Aguarda estafeta",
    className: "border-violet-200 bg-violet-50 text-violet-700",
    icon: Bike,
  },
  out_for_delivery: {
    label: "Em entrega",
    className: "border-blue-200 bg-blue-50 text-blue-700",
    icon: Bike,
  },
  completed: {
    label: "Concluído",
    className: "border-zinc-200 bg-zinc-100 text-zinc-700",
    icon: Check,
  },
  cancelled: {
    label: "Cancelado",
    className: "border-zinc-200 bg-zinc-100 text-zinc-500",
    icon: X,
  },
};

function formatMoney(value: number, currencyCode: string) {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: currencyCode,
  }).format(value);
}

function formatOrderNumber(id: string) {
  return `#${id.slice(0, 6).toUpperCase()}`;
}

function formatCreatedAt(value: string) {
  return new Intl.DateTimeFormat("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Lisbon",
  }).format(new Date(value));
}

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function OrdersClient({
  restaurantId,
  initialOrders,
  currencyCode,
  receiptRestaurant,
  printerSettings,
}: OrdersClientProps) {
  const supabase = useMemo(() => createClient(), []);
  const [orders, setOrders] = useState(initialOrders);
  const [search, setSearch] = useState("");
  const knownOrderIds = useRef(new Set(initialOrders.map((order) => order.id)));

  async function fetchOrder(orderId: string) {
    const { data, error } = await supabase
      .from("orders")
      .select(`
        id,
        customer_name,
        customer_phone,
        table_label,
        type,
        status,
        subtotal,
        delivery_fee,
        total,
        payment_method,
        payment_status,
        cash_tendered_amount,
        delivery_address,
        delivery_distance_km,
        notes,
        estimated_minutes,
        created_at,
        order_items (
          id,
          product_name,
          quantity,
          unit_price,
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

    return data as RestaurantOrder;
  }

  function printOrder(order: RestaurantOrder, automatic = false) {
    if (!printerSettings.enabled) return;

    const storageKey = `trimos-auto-printed-${restaurantId}-${order.id}`;
    if (automatic) {
      try {
        if (window.localStorage.getItem(storageKey)) return;
      } catch {
        // A impressão continua disponível quando o armazenamento do navegador está bloqueado.
      }
    }

    const started = printThermalReceipt({
      order,
      restaurant: receiptRestaurant,
      currencyCode,
      paperWidth: printerSettings.paperWidth,
      copies: printerSettings.copies,
    });

    if (!started) {
      toast.error("Não foi possível abrir a impressão neste dispositivo.");
      return;
    }

    if (automatic) {
      try {
        window.localStorage.setItem(storageKey, new Date().toISOString());
      } catch {
        // Alguns modos privados bloqueiam o armazenamento local.
      }
    }
  }

  useEffect(() => {
    const channel = supabase
      .channel(`restaurant-orders-${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        async (payload) => {
          const order = await fetchOrder(payload.new.id as string);

          if (!order) {
            return;
          }

          if (order.status === "pending_payment") return;
          knownOrderIds.current.add(order.id);

          setOrders((current) => [
            order,
            ...current.filter((item) => item.id !== order.id),
          ]);

          toast.success("Novo pedido recebido", {
            description: `${order.customer_name} · ${formatMoney(order.total, currencyCode)}`,
          });

          if (printerSettings.enabled && printerSettings.autoPrint) {
            printOrder(order, true);
          }

        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        async (payload) => {
          const order = await fetchOrder(payload.new.id as string);

          if (!order) {
            return;
          }

          const isNewToPanel = !knownOrderIds.current.has(order.id);
          if (order.status !== "pending_payment") knownOrderIds.current.add(order.id);

          setOrders((current) => {
            if (order.status === "pending_payment") return current.filter((item) => item.id !== order.id);
            return current.some((item) => item.id === order.id)
              ? current.map((item) => (item.id === order.id ? order : item))
              : [order, ...current];
          });

          if (
            isNewToPanel &&
            order.status !== "pending_payment" &&
            printerSettings.enabled &&
            printerSettings.autoPrint
          ) {
            printOrder(order, true);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [restaurantId, supabase]);

  async function updateStatus(
    orderId: string,
    status: DatabaseOrderStatus
  ) {
    const currentOrder = orders.find((order) => order.id === orderId);
    const result = await updateRestaurantOrderStatusAction(orderId, status);
    if (!result.ok) {
      toast.error("Não foi possível atualizar o pedido", {
        description: result.message,
      });
      return;
    }

    setOrders((current) =>
      current.map((order) =>
        order.id === orderId ? { ...order, status, payment_status: result.paymentStatus ?? order.payment_status } : order
      )
    );

    if (
      status === "preparing" &&
      currentOrder &&
      printerSettings.enabled &&
      printerSettings.autoPrint
    ) {
      printOrder(currentOrder, true);
    }
  }

  const filteredOrders = orders.filter((order) => {
    const term = search.toLowerCase();

    return (
      order.customer_name.toLowerCase().includes(term) ||
      order.table_label?.toLowerCase().includes(term) ||
      order.id.toLowerCase().includes(term)
    );
  });

  function renderOrders(status?: DatabaseOrderStatus) {
    const visibleOrders = status
      ? filteredOrders.filter((order) => order.status === status)
      : filteredOrders;

    if (visibleOrders.length === 0) {
      return (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white text-center">
          <div className="rounded-2xl bg-zinc-100 p-4">
            <ShoppingBag className="size-6 text-zinc-400" />
          </div>

          <p className="mt-4 font-medium text-zinc-800">
            Nenhum pedido nesta etapa
          </p>

          <p className="mt-1 text-sm text-zinc-500">
            Os pedidos aparecerão aqui automaticamente.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {visibleOrders.map((order) => {
          const config = statusConfig[order.status];
          const StatusIcon = config.icon;

          return (
            <Card
              key={order.id}
              className="overflow-hidden border-zinc-200 shadow-none"
            >
              <CardContent className="p-0">
                <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-start">
                  <Avatar className="size-12">
                    <AvatarFallback className="bg-zinc-100 text-sm font-semibold">
                      {getInitials(order.customer_name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-zinc-950">
                        {formatOrderNumber(order.id)} · {order.customer_name}
                      </p>

                      <Badge
                        variant="outline"
                        className={config.className}
                      >
                        <StatusIcon className="mr-1 size-3.5" />
                        {config.label}
                      </Badge>
                    </div>

                    <p className="mt-1 text-sm text-zinc-500">
                      {order.type === "delivery"
                        ? "Entrega"
                        : order.type === "pickup"
                          ? "Recolha"
                          : order.table_label ?? "Mesa"}
                      {" · "}
                      {formatMoney(order.total, currencyCode)}
                      {" · "}
                      {formatCreatedAt(order.created_at)}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <Badge variant="outline">
                        {order.payment_method === "mb_way" ? "MB WAY" : order.payment_method === "terminal" ? "Terminal" : "Dinheiro"}
                        {order.payment_status === "paid" ? " · Pago" : order.payment_status === "refunded" ? " · Reembolsado" : " · A receber"}
                      </Badge>
                      {order.payment_method === "cash" && order.cash_tendered_amount !== null ? (
                        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                          Troco: {formatMoney(Math.max(0, order.cash_tendered_amount - order.total), currencyCode)}
                        </Badge>
                      ) : null}
                    </div>

                    <div className="mt-4 space-y-1.5">
                      {order.order_items.map((item) => (
                        <p key={item.id} className="text-sm text-zinc-700">
                          {item.quantity}x {item.product_name}
                          {item.variant_name ? ` · ${item.variant_name}` : ""}
                          {Array.isArray(item.selected_modifiers) && item.selected_modifiers.map((modifier) => typeof modifier === "object" && modifier && "option" in modifier ? `${"quantity" in modifier ? Number(modifier.quantity) : 1}x ${String(modifier.option)}` : "").filter(Boolean).length > 0 ? ` · ${item.selected_modifiers.map((modifier) => typeof modifier === "object" && modifier && "option" in modifier ? `${"quantity" in modifier ? Number(modifier.quantity) : 1}x ${String(modifier.option)}` : "").filter(Boolean).join(", ")}` : ""}
                          {item.notes ? ` · ${item.notes}` : ""}
                        </p>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {printerSettings.enabled && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => printOrder(order)}
                      >
                        <Printer className="mr-2 size-4" />
                        Imprimir
                      </Button>
                    )}

                    {order.status === "new" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updateStatus(order.id, "cancelled")
                          }
                        >
                          <X className="mr-2 size-4" />
                          Recusar
                        </Button>

                        <Button
                          size="sm"
                          className="bg-zinc-950 hover:bg-zinc-800"
                          onClick={() =>
                            updateStatus(order.id, "preparing")
                          }
                        >
                          <Check className="mr-2 size-4" />
                          Aceitar
                        </Button>
</>
                    )}

                    {order.status === "confirmed" && (
                      <Button
                        size="sm"
                        onClick={() =>
                          updateStatus(order.id, "preparing")
                        }
                      >
                        Iniciar preparação
                      </Button>
                    )}

                    {order.status === "preparing" && (
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-500"
                        onClick={() => updateStatus(order.id, "ready")}
                      >
                        <PackageCheck className="mr-2 size-4" />
                        Marcar como pronto
                      </Button>
                    )}

                    {order.status === "ready" &&
                      order.type === "delivery" && (
                        <Badge
                          variant="outline"
                          className="h-9 border-violet-200 bg-violet-50 px-3 text-violet-700"
                        >
                          A distribuir automaticamente
                        </Badge>
                      )}

                    {order.status === "ready" &&
                      order.type !== "delivery" && (
                        <Button
                          size="sm"
                          onClick={() =>
                            updateStatus(order.id, "completed")
                          }
                        >
                          Entregue ao cliente
                        </Button>
                      )}

                    {order.status === "awaiting_driver" && (
                      <Badge
                        variant="outline"
                        className="h-9 border-violet-200 bg-violet-50 px-3 text-violet-700"
                      >
                        A aguardar aceitação ou recolha
                      </Badge>
                    )}

                    {order.status === "out_for_delivery" && (
                      <Badge
                        variant="outline"
                        className="h-9 border-blue-200 bg-blue-50 px-3 text-blue-700"
                      >
                        Estafeta a caminho
                      </Badge>
                    )}

                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between bg-zinc-50 px-5 py-3">
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <Clock3 className="size-3.5" />
                    Tempo estimado: {order.estimated_minutes ?? 30} minutos
                  </div>

                  <span className="text-xs text-zinc-400">
                    ID: {order.id}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  const countByStatus = (statuses: DatabaseOrderStatus[]) =>
    orders.filter((order) => statuses.includes(order.status)).length;

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-medium text-amber-600">
            Centro de operações
          </p>

          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Pedidos
          </h1>

          <p className="mt-2 text-sm text-zinc-500">
            Dados reais do Supabase com atualização em tempo real.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative sm:w-80">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />

            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Procurar pedido ou cliente..."
              className="h-11 bg-white pl-10"
            />
          </div>

        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-red-200 bg-red-50/60 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-red-700">
              Novos pedidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">
              {countByStatus(["new"])}
            </p>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/60 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-amber-700">
              Em preparação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">
              {countByStatus(["confirmed", "preparing"])}
            </p>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/60 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-emerald-700">
              Prontos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">
              {countByStatus(["ready", "awaiting_driver"])}
            </p>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/60 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-blue-700">
              Em entrega
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">
              {countByStatus(["out_for_delivery"])}
            </p>
          </CardContent>
        </Card>
      </section>

      <Tabs defaultValue="all">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="new">Novos</TabsTrigger>
          <TabsTrigger value="preparing">Em preparação</TabsTrigger>
          <TabsTrigger value="ready">Prontos</TabsTrigger>
          <TabsTrigger value="delivery">Em entrega</TabsTrigger>
          <TabsTrigger value="completed">Concluídos</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-5">
          {renderOrders()}
        </TabsContent>

        <TabsContent value="new" className="mt-5">
          {renderOrders("new")}
        </TabsContent>

        <TabsContent value="preparing" className="mt-5">
          {renderOrders("preparing")}
        </TabsContent>

        <TabsContent value="ready" className="mt-5">
          {renderOrders("ready")}
        </TabsContent>

        <TabsContent value="delivery" className="mt-5">
          {renderOrders("out_for_delivery")}
        </TabsContent>

        <TabsContent value="completed" className="mt-5">
          {renderOrders("completed")}
        </TabsContent>
      </Tabs>
    </div>
  );
}
