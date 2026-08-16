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
  restoreNotificationAudio,
} from "@/lib/audio/notification-alarm";
import { createClient } from "@/lib/supabase/client";

type RestaurantAudioProviderProps = {
  restaurantId: string;
  initialNewOrders: number;
  enabled?: boolean;
};

const AUDIO_PREFERENCE_KEY = "trimos-restaurant-audio-unlocked";

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
  const [audioActivating, setAudioActivating] = useState(false);
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

  const unlockAudio = useCallback(async (requestNotifications = true) => {
    try {
      setAudioActivating(true);
      setAudioError(null);
      const ready = await unlockNotificationAudio();
      if (!ready) throw new Error("O navegador manteve o áudio suspenso.");

      audioUnlockedRef.current = true;
      setAudioEnabled(true);

      window.localStorage.setItem(AUDIO_PREFERENCE_KEY, "true");
      window.sessionStorage.setItem(AUDIO_PREFERENCE_KEY, "true");

      if (
        requestNotifications &&
        "Notification" in window &&
        Notification.permission === "default"
      ) {
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
    } finally {
      setAudioActivating(false);
    }
  }, []);

  const restoreAudio = useCallback(async () => {
    const ready = await restoreNotificationAudio();

    if (!ready) {
      return false;
    }

    audioUnlockedRef.current = true;
    setAudioEnabled(true);
    setAudioError(null);

    if (newOrdersCountRef.current > 0) {
      startNotificationAlarm("restaurant");
    }

    return true;
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const audioWasEnabled =
      window.localStorage.getItem(AUDIO_PREFERENCE_KEY) === "true" ||
      window.sessionStorage.getItem(AUDIO_PREFERENCE_KEY) === "true";

    const restoreTimer = audioWasEnabled
      ? window.setTimeout(() => void restoreAudio(), 0)
      : null;

    return () => {
      if (restoreTimer !== null) window.clearTimeout(restoreTimer);
    };
  }, [enabled, restoreAudio]);

  useEffect(() => {
    if (!enabled) {
      stopNotificationAlarm();
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (!isNotificationAudioReady()) void restoreAudio();
        void fetchNewOrdersCount();
      }
    };

    const handleFocus = () => {
      if (!isNotificationAudioReady()) void restoreAudio();
      void fetchNewOrdersCount();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, fetchNewOrdersCount, restoreAudio]);

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
          if (payload.new.status !== "new") return;
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

  return (
    <div
      className={`fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-2xl border p-4 shadow-xl ${
        audioEnabled
          ? "border-emerald-200 bg-emerald-50"
          : "border-amber-200 bg-amber-50"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div
          className={`rounded-xl p-2 ${
            audioEnabled
              ? "bg-emerald-100 text-emerald-700"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          <BellRing className="size-5" />
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={`font-semibold ${
              audioEnabled ? "text-emerald-950" : "text-amber-950"
            }`}
          >
            {audioEnabled
              ? "Som dos pedidos ativo"
              : "Ativar e testar som dos pedidos"}
          </p>
          <p
            className={`text-sm ${
              audioEnabled ? "text-emerald-800" : "text-amber-800"
            }`}
          >
            {audioError ??
              (audioEnabled
                ? "O alarme tocará até o pedido ser aceite ou rejeitado."
                : "Toque no botão para o navegador autorizar o alarme.")}
          </p>
        </div>

        <Button
          type="button"
          className={`w-full shrink-0 text-zinc-950 sm:w-auto ${
            audioEnabled
              ? "bg-emerald-500 hover:bg-emerald-400"
              : "bg-amber-500 hover:bg-amber-400"
          }`}
          onClick={() => void unlockAudio(true)}
          disabled={audioActivating}
        >
          {audioActivating
            ? "A testar..."
            : audioEnabled
              ? "Testar novamente"
              : "Ativar e testar"}
        </Button>
      </div>
    </div>
  );
}
