"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";

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
      const ready = await unlockNotificationAudio();
      if (!ready) throw new Error("O navegador manteve o áudio suspenso.");

      audioUnlockedRef.current = true;

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
      return true;
    } catch (error) {
      console.warn("Não foi possível desbloquear o áudio:", error);
      return false;
    }
  }, []);

  const restoreAudio = useCallback(async () => {
    const ready = await restoreNotificationAudio();

    if (!ready) {
      return false;
    }

    audioUnlockedRef.current = true;

    if (newOrdersCountRef.current > 0) {
      startNotificationAlarm("restaurant");
    }

    return true;
  }, []);

  useEffect(() => {
    if (!enabled || audioUnlockedRef.current) return;

    let activating = false;

    const removeActivationListeners = () => {
      window.removeEventListener("pointerdown", activateFromGesture, true);
      window.removeEventListener("touchend", activateFromGesture, true);
      window.removeEventListener("keydown", activateFromGesture, true);
    };

    const activateFromGesture = () => {
      if (activating || audioUnlockedRef.current) return;
      activating = true;

      void unlockAudio(true).then((ready) => {
        activating = false;
        if (ready) removeActivationListeners();
      });
    };

    window.addEventListener("pointerdown", activateFromGesture, true);
    window.addEventListener("touchend", activateFromGesture, true);
    window.addEventListener("keydown", activateFromGesture, true);

    return removeActivationListeners;
  }, [enabled, unlockAudio]);

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

  return null;
}
