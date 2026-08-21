"use client";

import { useCallback, useEffect, useRef } from "react";

import {
  primeRestaurantAudio,
  startNotificationAlarm,
  stopNotificationAlarm,
} from "@/lib/audio/notification-alarm";
import { createClient } from "@/lib/supabase/client";

type RestaurantAudioProviderProps = {
  restaurantId: string;
  initialNewOrders: number;
  enabled: boolean;
};

const AUDIO_PERMISSION_KEY = "trimos-restaurant-audio-permission";

export function RestaurantAudioProvider({
  restaurantId,
  initialNewOrders,
  enabled,
}: RestaurantAudioProviderProps) {
  const pendingOrderIdsRef = useRef<Set<string>>(new Set());
  const activatingRef = useRef(false);
  const enabledRef = useRef(enabled);

  enabledRef.current = enabled;

  const syncAlarm = useCallback(() => {
    if (!enabledRef.current) {
      stopNotificationAlarm();
      return;
    }

    if (pendingOrderIdsRef.current.size > 0) {
      startNotificationAlarm("restaurant");
      return;
    }

    stopNotificationAlarm();
  }, []);

  const replacePendingOrders = useCallback(
    (orderIds: string[]) => {
      pendingOrderIdsRef.current = new Set(orderIds);
      syncAlarm();
    },
    [syncAlarm],
  );

  const updatePendingOrder = useCallback(
    (orderId: string, isPending: boolean) => {
      if (isPending) {
        pendingOrderIdsRef.current.add(orderId);
      } else {
        pendingOrderIdsRef.current.delete(orderId);
      }

      syncAlarm();
    },
    [syncAlarm],
  );

  const activateAudio = useCallback(async () => {
    if (!enabledRef.current || activatingRef.current) return;

    activatingRef.current = true;

    try {
      /*
       * IMPORTANTE:
       * primeRestaurantAudio() precisa de ser chamado a partir de uma
       * interação real do utilizador em browsers que aplicam autoplay policy.
       */
      const activated = await primeRestaurantAudio();

      if (!activated) return;

      try {
        window.localStorage.setItem(AUDIO_PERMISSION_KEY, "true");
      } catch {
        // O áudio continua a funcionar mesmo sem localStorage.
      }

      syncAlarm();
    } finally {
      activatingRef.current = false;
    }
  }, [syncAlarm]);

  useEffect(() => {
    if (!enabled) {
      pendingOrderIdsRef.current.clear();
      stopNotificationAlarm();
      return;
    }

    syncAlarm();
  }, [enabled, syncAlarm]);

  useEffect(() => {
    if (!enabled) return;

    /*
     * Se o utilizador já desbloqueou o áudio anteriormente,
     * tentamos restaurá-lo automaticamente.
     *
     * Chromium pode permitir esta reprodução dependendo das políticas
     * de autoplay / media engagement. Safari pode continuar a exigir
     * uma interação depois de um reload completo.
     */
    try {
      const wasPreviouslyActivated =
        window.localStorage.getItem(AUDIO_PERMISSION_KEY) === "true";

      if (wasPreviouslyActivated) {
        void primeRestaurantAudio().then((activated: boolean) => {
          if (activated) {
            syncAlarm();
          }
        });
      }
    } catch {
      // Ignora browsers/modos onde localStorage não está disponível.
    }
  }, [enabled, syncAlarm]);

  useEffect(() => {
    if (!enabled) return;

    const supabase = createClient();

    let disposed = false;

    const fetchPendingOrders = async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id")
        .eq("restaurant_id", restaurantId)
        .eq("status", "new");

      if (disposed) return;

      if (error) {
        console.warn(
          "Não foi possível atualizar os pedidos pendentes.",
          error,
        );
        return;
      }

      replacePendingOrders(
        (data ?? []).map(({ id }) => String(id)),
      );
    };

    /*
     * Se o servidor informou que já existem pedidos novos,
     * fazemos imediatamente a leitura completa.
     *
     * Mesmo quando initialNewOrders é zero fazemos a sincronização,
     * porque um pedido pode ter chegado entre o render do servidor e
     * a montagem deste componente.
     */
    void fetchPendingOrders();

    const channel = supabase
      .channel(`restaurant-orders-audio-${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          const newOrder = payload.new as {
            id?: string;
            status?: string;
          };

          const oldOrder = payload.old as {
            id?: string;
            status?: string;
          };

          const orderId = String(
            newOrder.id ?? oldOrder.id ?? "",
          );

          if (orderId) {
            updatePendingOrder(
              orderId,
              newOrder.status === "new",
            );
          }

          if (
            payload.eventType === "INSERT" &&
            newOrder.status === "new" &&
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            new Notification("Novo pedido", {
              body: "Há um novo pedido à espera de aceitação.",
              tag: `restaurant-order-${orderId}`,
            });
          }

          /*
           * Fazemos também uma confirmação no banco.
           * Assim o som não depende exclusivamente do Realtime.
           */
          void fetchPendingOrders();
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void fetchPendingOrders();
        }
      });

    /*
     * Polling de segurança.
     *
     * Mesmo se o WebSocket cair silenciosamente, no máximo alguns
     * segundos depois o restaurante vê/toca o novo pedido.
     */
    const poll = window.setInterval(() => {
      void fetchPendingOrders();
    }, 3000);

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void fetchPendingOrders();
      }
    };

    const refreshWhenOnline = () => {
      void fetchPendingOrders();
    };

    document.addEventListener(
      "visibilitychange",
      refreshWhenVisible,
    );

    window.addEventListener(
      "focus",
      refreshWhenVisible,
    );

    window.addEventListener(
      "online",
      refreshWhenOnline,
    );

    return () => {
      disposed = true;

      window.clearInterval(poll);

      document.removeEventListener(
        "visibilitychange",
        refreshWhenVisible,
      );

      window.removeEventListener(
        "focus",
        refreshWhenVisible,
      );

      window.removeEventListener(
        "online",
        refreshWhenOnline,
      );

      void supabase.removeChannel(channel);

      stopNotificationAlarm();
    };
  }, [
    enabled,
    initialNewOrders,
    replacePendingOrders,
    restaurantId,
    updatePendingOrder,
  ]);

  useEffect(() => {
    if (!enabled) return;

    /*
     * Primeira interação no painel desbloqueia o áudio.
     *
     * Não precisamos de botão "Ativar som". Qualquer clique/toque/tecla
     * utilizado normalmente no dashboard serve para desbloquear.
     */
    const unlock = () => {
      void activateAudio();
    };

    window.addEventListener(
      "pointerdown",
      unlock,
      { capture: true },
    );

    window.addEventListener(
      "keydown",
      unlock,
      { capture: true },
    );

    return () => {
      window.removeEventListener(
        "pointerdown",
        unlock,
        { capture: true },
      );

      window.removeEventListener(
        "keydown",
        unlock,
        { capture: true },
      );
    };
  }, [activateAudio, enabled]);

  return null;
}
