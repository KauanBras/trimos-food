"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BellRing } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  startNotificationAlarm,
  stopNotificationAlarm,
  unlockNotificationAudio,
  isNotificationAudioReady,
} from "@/lib/audio/notification-alarm";
import { createClient } from "@/lib/supabase/client";

type RestaurantAudioProviderProps = {
  restaurantId: string;
  initialNewOrders: number;
  enabled?: boolean;
};

export function RestaurantAudioProvider({
  restaurantId,
  initialNewOrders,
  enabled = true,
}: RestaurantAudioProviderProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const audioUnlockedRef = useRef(false);
  const newOrdersCountRef = useRef(initialNewOrders);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  const syncAlarm = useCallback((count: number) => {
    newOrdersCountRef.current = count;

    if (!enabled || count <= 0) {
      stopNotificationAlarm();
      return;
    }

    if (!audioUnlockedRef.current) {
      return;
    }

    startNotificationAlarm("restaurant");
  }, [enabled]);

  const fetchNewOrdersCount = useCallback(async () => {
    if (!enabled) {
      stopNotificationAlarm();
      return;
    }

    const { count, error } = await supabase
      .from("orders")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("restaurant_id", restaurantId)
      .eq("status", "new");

    if (error) {
      console.error(
        "Não foi possível consultar os novos pedidos:",
        error.message,
      );
      return;
    }

    syncAlarm(count ?? 0);
  }, [enabled, restaurantId, supabase, syncAlarm]);

  const unlockAudio = useCallback(async () => {
    try {
      setAudioError(null);
      const ready = await unlockNotificationAudio();
      if (!ready) throw new Error("O navegador manteve o áudio suspenso.");

      audioUnlockedRef.current = true;
      setAudioEnabled(true);

      window.sessionStorage.setItem("trimos-restaurant-audio-unlocked", "true");

      if ("Notification" in window && Notification.permission === "default") {
        try {
          await Notification.requestPermission();
        } catch (notificationError) {
          console.warn("Não foi possível pedir permissão de notificações:", notificationError);
        }
      }

      if (newOrdersCountRef.current > 0) {
        startNotificationAlarm("restaurant");
      }
    } catch (error) {
      console.warn("Não foi possível desbloquear o áudio:", error);
      setAudioError(
        "O Safari não liberou o som. Toque novamente em Ativar som.",
      );
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      stopNotificationAlarm();
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (!isNotificationAudioReady()) {
          audioUnlockedRef.current = false;
          setAudioEnabled(false);
        }
        void fetchNewOrdersCount();
      }
    };

    const handleFocus = () => {
      if (!isNotificationAudioReady()) {
        audioUnlockedRef.current = false;
        setAudioEnabled(false);
      }
      void fetchNewOrdersCount();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, fetchNewOrdersCount]);

  useEffect(() => {
    if (!enabled) {
      stopNotificationAlarm();
      return;
    }

    void fetchNewOrdersCount();

    const pollingId = window.setInterval(() => {
      void fetchNewOrdersCount();
    }, 4000);

    const channel = supabase
      .channel(`restaurant-global-audio-${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          if ("Notification" in window && Notification.permission === "granted") {
            const orderId = String(payload.new.id ?? "novo");
            const notification = new Notification("Novo pedido recebido", {
              body: "Abra o painel para aceitar ou recusar o pedido.",
              tag: `trimos-order-${orderId}`,
            });
            notification.onclick = () => {
              window.focus();
              router.push("/restaurant/orders");
              notification.close();
            };
          }
          void fetchNewOrdersCount();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          void fetchNewOrdersCount();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          void fetchNewOrdersCount();
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void fetchNewOrdersCount();
        }
      });

    return () => {
      window.clearInterval(pollingId);
      stopNotificationAlarm();
      void supabase.removeChannel(channel);
    };
  }, [enabled, fetchNewOrdersCount, restaurantId, router, supabase]);

  if (!enabled) {
    return null;
  }

  if (audioEnabled) {
    return null;
  }

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-xl">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-amber-100 p-2 text-amber-700">
          <BellRing className="size-5" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-semibold text-amber-950">
            Ativar e testar som dos pedidos
          </p>
          <p className="text-sm text-amber-800">
            {audioError ??
              "Necessário para o alarme tocar até o pedido ser aceite."}
          </p>
        </div>

        <Button
          type="button"
          className="shrink-0 bg-amber-500 text-zinc-950 hover:bg-amber-400"
          onClick={() => void unlockAudio()}
        >
          Ativar e testar
        </Button>
      </div>
    </div>
  );
}
