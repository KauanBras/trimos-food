"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BellRing,
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
import {
  startNotificationAlarm,
  stopNotificationAlarm,
  unlockNotificationAudio,
  isNotificationAudioReady,
} from "@/lib/audio/notification-alarm";
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
  driver_fee: number;
  assignment_source: Database["public"]["Enums"]["driver_assignment_source"] | null;
  distance_km: number | null;
  offer_expires_at: string | null;
  created_at: string;
  orders: {
    customer_name: string;
    customer_phone: string | null;
    total: number;
    payment_method: Database["public"]["Enums"]["payment_method"];
    payment_status: Database["public"]["Enums"]["payment_status"];
    cash_tendered_amount: number | null;
  } | null;
  restaurants: { name: string; currency_code: string } | null;
};

type DriverDashboardClientProps = {
  driverId: string;
  initialStatus: DriverStatus;
  initialDeliveries: DriverDelivery[];
  initialRejectedDeliveryIds?: string[];
};

function formatMoney(value: number, currencyCode: string) {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: currencyCode,
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

function getRemainingOfferSeconds(expiresAt: string | null, now: number) {
  if (!expiresAt) {
    return 0;
  }

  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000));
}

export function DriverDashboardClient({
  driverId,
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

  const [now, setNow] = useState(() => Date.now());
  const [audioEnabled, setAudioEnabled] = useState(() =>
    isNotificationAudioReady(),
  );
  const [locationState, setLocationState] = useState<
    "idle" | "active" | "error"
  >("idle");

  const enableOfferAudio = useCallback(async () => {
    try {
      const enabled = await unlockNotificationAudio();

      setAudioEnabled(enabled);

    } catch (error) {
      toast.error("Não foi possível ativar o som", {
        description:
          error instanceof Error ? error.message : "Erro desconhecido.",
      });
    }
  }, []);

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
        driver_fee,
        assignment_source,
        distance_km,
        offer_expires_at,
        created_at,
        orders (
          customer_name,
          customer_phone,
          total,
          payment_method,
          payment_status,
          cash_tendered_amount
        ),
        restaurants (
          name,
          currency_code
        )
      `)
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

    setNow(Date.now());
    setDeliveries((data ?? []) as DriverDelivery[]);
  }, [supabase]);


  useEffect(() => {
    const channel = supabase
      .channel(`driver-dashboard-${driverId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "deliveries",
        },
        () => {
          void fetchDeliveries();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void fetchDeliveries();
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [driverId, fetchDeliveries, supabase]);

  useEffect(() => {
    const hasOffer = deliveries.some(
      (delivery) =>
        delivery.status === "offered" &&
        delivery.offered_driver_id === driverId
    );

    if (!hasOffer) {
      return;
    }

    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 250);

    return () => window.clearInterval(interval);
  }, [deliveries, driverId]);

  useEffect(() => {
    const hasActiveOffer = deliveries.some(
      (delivery) =>
        delivery.status === "offered" &&
        delivery.offered_driver_id === driverId
    );

    if (audioEnabled && hasActiveOffer) {
      startNotificationAlarm("driver");
    } else {
      stopNotificationAlarm();
    }

    return () => stopNotificationAlarm();
  }, [audioEnabled, deliveries, driverId]);

  useEffect(() => {
    if (driverStatus === "offline") {
      return;
    }

    if (!("geolocation" in navigator)) {
      const unsupportedTimer = window.setTimeout(() => {
        setLocationState("error");
      }, 0);

      return () => window.clearTimeout(unsupportedTimer);
    }

    let lastPersistedAt = 0;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLocationState("active");

        const observedAt = Date.now();
        if (observedAt - lastPersistedAt < 15_000) {
          return;
        }

        lastPersistedAt = observedAt;

        void supabase
          .from("drivers")
          .update({
            current_latitude: position.coords.latitude,
            current_longitude: position.coords.longitude,
            location_updated_at: new Date(observedAt).toISOString(),
          })
          .eq("id", driverId)
          .then(({ error }) => {
            if (error) {
              console.error(
                "Não foi possível atualizar a localização do estafeta:",
                error.message,
              );
            }
          });
      },
      () => {
        setLocationState("error");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10_000,
        timeout: 20_000,
      },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [driverId, driverStatus, supabase]);

  useEffect(() => {
    const expiredOffer = deliveries.find(
      (delivery) =>
        delivery.status === "offered" &&
        delivery.offered_driver_id === driverId &&
        getRemainingOfferSeconds(delivery.offer_expires_at, now) === 0
    );

    if (!expiredOffer || loadingAction) {
      return;
    }

    const expireOffer = async () => {
      setLoadingAction(`expire-${expiredOffer.id}`);

      try {
        const { error } = await supabase.rpc(
          "expire_my_delivery_offer",
          { requested_delivery_id: expiredOffer.id }
        );

        if (error) {
          console.error("Não foi possível expirar a oferta:", error.message);
        }

        await fetchDeliveries();
      } finally {
        setLoadingAction(null);
      }
    };

    void expireOffer();
  }, [deliveries, driverId, fetchDeliveries, loadingAction, now, supabase]);

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
      | "confirm_delivery_payment"
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

      if (action === "confirm_delivery_payment") {
        toast.success("Recebimento confirmado");
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
      {!audioEnabled && (
        <Card className="border-amber-200 bg-amber-50 shadow-none">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-xl bg-amber-100 p-2 text-amber-700">
              <BellRing className="size-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="font-semibold text-amber-950">
                Ativar som das ofertas
              </p>
              <p className="text-sm text-amber-800">
                O alarme tocará continuamente durante os 30 segundos.
              </p>
            </div>

            <Button
              type="button"
              className="shrink-0 bg-amber-500 text-zinc-950 hover:bg-amber-400"
              onClick={() => void enableOfferAudio()}
            >
              Ativar som
            </Button>
          </CardContent>
        </Card>
      )}

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

              {driverStatus !== "offline" && (
                <p
                  className={`mt-2 text-xs ${
                    locationState === "active"
                      ? "text-emerald-400"
                      : locationState === "error"
                        ? "text-amber-300"
                        : "text-zinc-500"
                  }`}
                >
                  {locationState === "active"
                    ? "Localização ativa para a operação."
                    : locationState === "error"
                      ? "Autorize a localização para melhorar a atribuição."
                      : "A obter a sua localização..."}
                </p>
              )}
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
              const currencyCode = delivery.restaurants?.currency_code ?? "EUR";
              const remainingSeconds =
                delivery.status === "offered"
                  ? getRemainingOfferSeconds(
                      delivery.offer_expires_at,
                      now
                    )
                  : null;
              const offerExpired = remainingSeconds === 0;

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

                        <p className="mb-2 text-sm font-medium text-zinc-700">
                          {delivery.restaurants?.name ?? "Restaurante"}
                          {delivery.assignment_source === "network" ? " · Rede Trimos" : " · Frota privada"}
                        </p>

                        <CardTitle className="text-xl">
                          {customer?.customer_name ?? "Cliente"}
                        </CardTitle>

                        <p className="mt-1 text-sm text-zinc-500">
                          Pedido #
                          {delivery.order_id.slice(0, 6).toUpperCase()}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-xs text-zinc-500">O seu ganho</p>
                        <p className="text-lg font-semibold text-emerald-700">
                          {formatMoney(delivery.driver_fee, currencyCode)}
                        </p>

                        <p className="mt-1 text-xs text-zinc-500">
                          Pedido: {formatMoney(customer?.total ?? 0, currencyCode)}
                        </p>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 p-5">
                    {remainingSeconds !== null && (
                      <div
                        className="rounded-2xl bg-amber-50 p-4"
                        role="timer"
                        aria-live="polite"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-amber-700">
                              Tempo para responder
                            </p>
                            <p className="mt-1 text-sm text-amber-800">
                              {offerExpired
                                ? "A redistribuir a oferta..."
                                : "Aceite antes que passe ao próximo estafeta."}
                            </p>
                          </div>

                          <span className="min-w-16 text-right text-3xl font-bold tabular-nums text-amber-700">
                            0:{String(remainingSeconds).padStart(2, "0")}
                          </span>
                        </div>
                      </div>
                    )}

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

                    {customer ? (
                      <div className="rounded-2xl border border-zinc-200 p-4 text-sm">
                        <p className="font-medium">
                          {customer.payment_method === "mb_way" ? "MB WAY online" : customer.payment_method === "terminal" ? "Levar terminal" : "Receber em dinheiro"}
                        </p>
                        <p className="mt-1 text-zinc-500">
                          {customer.payment_status === "paid" ? "Pagamento confirmado." : "Confirme o recebimento antes de concluir."}
                        </p>
                        {customer.payment_method === "cash" && customer.cash_tendered_amount !== null ? (
                          <p className="mt-2 font-medium text-amber-700">
                            Levar {formatMoney(Math.max(0, customer.cash_tendered_amount - customer.total), currencyCode)} de troco.
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    {(delivery.status === "searching_driver" ||
                      delivery.status === "offered") && (
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-12"
                          disabled={loadingAction !== null || offerExpired}
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
                          disabled={loadingAction !== null || offerExpired}
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

                    {delivery.status === "picked_up" && customer?.payment_status !== "paid" ? (
                      <Button type="button" className="h-12 w-full bg-amber-500 text-zinc-950 hover:bg-amber-400" disabled={loadingAction !== null} onClick={() => void executeDeliveryAction(delivery.id, "confirm_delivery_payment")}>
                        <Check className="mr-2 size-5" /> Confirmar recebimento
                      </Button>
                    ) : null}
                    {delivery.status === "picked_up" && customer?.payment_status === "paid" ? (
                      <Button type="button" className="h-12 w-full bg-emerald-600 hover:bg-emerald-500" disabled={loadingAction !== null} onClick={() => void executeDeliveryAction(delivery.id, "complete_delivery")}>
                        <Check className="mr-2 size-5" /> Confirmar entrega ao cliente
                      </Button>
                    ) : null}
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
