"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bike,
  Check,
  Clock3,
  MapPin,
  Navigation,
  PackageCheck,
  Power,
  X,
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
import type { Database } from "@/types/database";

type DriverStatus =
  Database["public"]["Enums"]["driver_status"];

type DeliveryStatus =
  Database["public"]["Enums"]["delivery_status"];

type DriverDelivery = {
  id: string;
  order_id: string;
  driver_id: string | null;
  offered_driver_id: string | null;
  status: DeliveryStatus;
  delivery_address: string;
  delivery_fee: number;
  distance_km: number | null;
  created_at: string;
  orders: {
    customer_name: string;
    customer_phone: string | null;
    total: number;
  } | null;
};

type DriverDashboardClientProps = {
  driverId: string;
  restaurantId: string;
  initialStatus: DriverStatus;
  initialDeliveries: DriverDelivery[];
  initialRejectedDeliveryIds?: string[];
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function deliveryStatusLabel(status: DeliveryStatus) {
  const labels: Record<DeliveryStatus, string> = {
    searching_driver: "Nova entrega",
    offered: "Oferta disponível",
    accepted: "Aceite",
    picked_up: "Em entrega",
    delivered: "Entregue",
    cancelled: "Cancelada",
  };

  return labels[status];
}

export function DriverDashboardClient({
  driverId,
  restaurantId,
  initialStatus,
  initialDeliveries,
  initialRejectedDeliveryIds = [],
}: DriverDashboardClientProps) {
  const supabase = useMemo(() => createClient(), []);

  const [driverStatus, setDriverStatus] =
    useState<DriverStatus>(initialStatus);

  const [deliveries, setDeliveries] =
    useState<DriverDelivery[]>(initialDeliveries);

  const [rejectedDeliveryIds, setRejectedDeliveryIds] =
    useState<string[]>(initialRejectedDeliveryIds ?? []);

  const [loadingAction, setLoadingAction] = useState<string | null>(
    null
  );

  const fetchDeliveries = useCallback(async () => {
    const { data, error } = await supabase
      .from("deliveries")
      .select(`
        id,
        order_id,
        driver_id,
        offered_driver_id,
        status,
        delivery_address,
        delivery_fee,
        distance_km,
        created_at,
        orders (
          customer_name,
          customer_phone,
          total
        )
      `)
      .eq("restaurant_id", restaurantId)
      .in("status", [
        "searching_driver",
        "offered",
        "accepted",
        "picked_up"
      ])
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Não foi possível atualizar as entregas", {
        description: error.message,
      });
      return;
    }

    setDeliveries((data ?? []) as DriverDelivery[]);
  }, [restaurantId, supabase]);


  useEffect(() => {
    const channel = supabase
      .channel(`driver-dashboard-${restaurantId}-${driverId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "deliveries",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          void fetchDeliveries();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [driverId, fetchDeliveries, restaurantId, supabase]);

  async function changeAvailability() {

    if (loadingAction) {
      return;
    }

    const nextStatus: DriverStatus =
      driverStatus === "available" ? "offline" : "available";

    setLoadingAction("availability");

    try {
      const { error } = await supabase
        .from("drivers")
        .update({ status: nextStatus })
        .eq("id", driverId);

      if (error) {
        toast.error("Não foi possível alterar o estado", {
          description: error.message,
        });
        return;
      }

      setDriverStatus(nextStatus);

      toast.success(
        nextStatus === "available"
          ? "Está disponível para entregas"
          : "Ficou offline"
      );
    } finally {
      setLoadingAction(null);
    }
  }

  async function rejectDelivery(deliveryId: string) {

    if (loadingAction) {
      return;
    }

    setLoadingAction(`reject-${deliveryId}`);

    try {
      const { error } = await supabase.rpc("reject_delivery", {
        requested_delivery_id: deliveryId,
      });

      if (error) {
        toast.error("Não foi possível recusar a entrega", {
          description: error.message,
        });
        return;
      }

      setRejectedDeliveryIds((current) => [
        ...new Set([...current, deliveryId]),
      ]);

      toast.success("Entrega recusada", {
        description:
          "A chamada continuará disponível para outros estafetas.",
      });
    } finally {
      setLoadingAction(null);
    }
  }

  async function executeDeliveryAction(
    deliveryId: string,
    action:
      | "accept_delivery"
      | "pick_up_delivery"
      | "complete_delivery"
  ) {

    if (loadingAction) {
      return;
    }

    setLoadingAction(`${action}-${deliveryId}`);

    try {
      const { error } = await supabase.rpc(action, {
        requested_delivery_id: deliveryId,
      });

      if (error) {
        toast.error("Não foi possível atualizar a entrega", {
          description: error.message,
        });
        return;
      }

      if (action === "accept_delivery") {
        setDriverStatus("busy");
        toast.success("Entrega aceite");
      }

      if (action === "pick_up_delivery") {
        toast.success("Pedido recolhido", {
          description: "Agora siga para a morada do cliente.",
        });
      }

      if (action === "complete_delivery") {
        setDriverStatus("available");
        toast.success("Entrega concluída");
      }

      await fetchDeliveries();
    } finally {
      setLoadingAction(null);
    }
  }

  const visibleDeliveries = deliveries.filter((delivery) => {
    if (rejectedDeliveryIds.includes(delivery.id)) {
      return false;
    }

    if (delivery.status === "offered") {
      return (
        driverStatus === "available" &&
        delivery.offered_driver_id === driverId
      );
    }

    if (delivery.status === "searching_driver") {
      return false;
    }

    return delivery.driver_id === driverId;
  });

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-0 bg-zinc-950 text-white shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-zinc-400">
                Estado do estafeta
              </p>

              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`size-3 rounded-full ${
                    driverStatus === "available"
                      ? "bg-emerald-400"
                      : driverStatus === "busy"
                        ? "bg-amber-400"
                        : "bg-zinc-500"
                  }`}
                />

                <h1 className="text-2xl font-semibold">
                  {driverStatus === "available"
                    ? "Disponível"
                    : driverStatus === "busy"
                      ? "Em entrega"
                      : "Offline"}
                </h1>
              </div>

              <p className="mt-2 text-sm text-zinc-400">
                {driverStatus === "available"
                  ? "Pode receber novas ofertas de entrega."
                  : driverStatus === "busy"
                    ? "Conclua a entrega atual antes de aceitar outra."
                    : "Fique disponível para receber entregas."}
              </p>
            </div>

            <div className="rounded-2xl bg-white/10 p-3">
              <Bike className="size-6 text-amber-400" />
            </div>
          </div>

          {driverStatus !== "busy" && (
            <Button
              type="button"
              className={`mt-6 h-12 w-full gap-2 ${
                driverStatus === "available"
                  ? "bg-white text-zinc-950 hover:bg-zinc-200"
                  : "bg-emerald-500 text-white hover:bg-emerald-400"
              }`}
              disabled={loadingAction === "availability"}
              onClick={changeAvailability}
            >
              <Power className="size-5" />

              {loadingAction === "availability"
                ? "A atualizar..."
                : driverStatus === "available"
                  ? "Ficar offline"
                  : "Ficar disponível"}
            </Button>
          )}
        </CardContent>
      </Card>

      <section>
        <div className="mb-4">
          <h2 className="text-xl font-semibold">
            {driverStatus === "busy"
              ? "Entrega atual"
              : "Entregas disponíveis"}
          </h2>

          <p className="mt-1 text-sm text-zinc-500">
            Atualizações recebidas em tempo real.
          </p>
        </div>

        {visibleDeliveries.length === 0 ? (
          <Card className="border-dashed shadow-none">
            <CardContent className="flex min-h-64 flex-col items-center justify-center text-center">
              <div className="rounded-2xl bg-zinc-100 p-4">
                <PackageCheck className="size-7 text-zinc-400" />
              </div>

              <p className="mt-4 font-medium">
                Nenhuma entrega disponível
              </p>

              <p className="mt-1 max-w-xs text-sm text-zinc-500">
                As novas chamadas aparecerão aqui automaticamente.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {visibleDeliveries.map((delivery) => {
              const customer = delivery.orders;

              return (
                <Card
                  key={delivery.id}
                  className="overflow-hidden border-zinc-200 shadow-none"
                >
                  <CardHeader className="border-b bg-white">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <Badge
                          variant="outline"
                          className="mb-3 border-amber-200 bg-amber-50 text-amber-700"
                        >
                          {deliveryStatusLabel(delivery.status)}
                        </Badge>

                        <CardTitle className="text-xl">
                          {customer?.customer_name ?? "Cliente"}
                        </CardTitle>

                        <p className="mt-1 text-sm text-zinc-500">
                          Pedido #
                          {delivery.order_id.slice(0, 6).toUpperCase()}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-lg font-semibold">
                          {formatMoney(customer?.total ?? 0)}
                        </p>

                        <p className="mt-1 text-xs text-zinc-500">
                          Taxa: {formatMoney(delivery.delivery_fee)}
                        </p>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 p-5">
                    <div className="flex gap-3 rounded-2xl bg-zinc-50 p-4">
                      <MapPin className="mt-0.5 size-5 shrink-0 text-zinc-500" />

                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                          Morada de entrega
                        </p>

                        <p className="mt-1 font-medium">
                          {delivery.delivery_address}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-zinc-50 p-4">
                        <Clock3 className="size-4 text-zinc-500" />
                        <p className="mt-2 text-xs text-zinc-500">
                          Estado
                        </p>
                        <p className="mt-1 font-semibold">
                          {deliveryStatusLabel(delivery.status)}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-zinc-50 p-4">
                        <Navigation className="size-4 text-zinc-500" />
                        <p className="mt-2 text-xs text-zinc-500">
                          Distância
                        </p>
                        <p className="mt-1 font-semibold">
                          {delivery.distance_km
                            ? `${delivery.distance_km} km`
                            : "A calcular"}
                        </p>
                      </div>
                    </div>

                    {(delivery.status === "searching_driver" ||
                      delivery.status === "offered") && (
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-12"
                          disabled={loadingAction !== null}
                          onClick={() =>
                            void rejectDelivery(delivery.id)
                          }
                        >
                          <X className="mr-2 size-4" />
                          Recusar
                        </Button>

                        <Button
                          type="button"
                          className="h-12 bg-zinc-950 hover:bg-zinc-800"
                          disabled={loadingAction !== null}
                          onClick={() =>
                            void executeDeliveryAction(
                              delivery.id,
                              "accept_delivery"
                            )
                          }
                        >
                          <Check className="mr-2 size-5" />
                          Aceitar
                        </Button>
                      </div>
                    )}

                    {delivery.status === "accepted" && (
                      <Button
                        type="button"
                        className="h-12 w-full bg-amber-500 text-zinc-950 hover:bg-amber-400"
                        disabled={loadingAction !== null}
                        onClick={() =>
                          void executeDeliveryAction(
                            delivery.id,
                            "pick_up_delivery"
                          )
                        }
                      >
                        <PackageCheck className="mr-2 size-5" />
                        Pedido recolhido
                      </Button>
                    )}

                    {delivery.status === "picked_up" && (
                      <Button
                        type="button"
                        className="h-12 w-full bg-emerald-600 hover:bg-emerald-500"
                        disabled={loadingAction !== null}
                        onClick={() =>
                          void executeDeliveryAction(
                            delivery.id,
                            "complete_delivery"
                          )
                        }
                      >
                        <Check className="mr-2 size-5" />
                        Confirmar entrega ao cliente
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
