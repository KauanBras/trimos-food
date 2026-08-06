"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

import {
  startNotificationAlarm,
  stopNotificationAlarm,
  unlockNotificationAudio,
} from "@/lib/audio/notification-alarm";
import { createClient } from "@/lib/supabase/client";

type RestaurantAudioProviderProps = {
  restaurantId: string;
  initialNewOrders: number;
};

export function RestaurantAudioProvider({
  restaurantId,
  initialNewOrders,
}: RestaurantAudioProviderProps) {
  const supabase = useMemo(() => createClient(), []);

  const audioUnlockedRef = useRef(false);
  const newOrdersCountRef = useRef(initialNewOrders);

  const syncAlarm = useCallback((count: number) => {
    newOrdersCountRef.current = count;

    if (!audioUnlockedRef.current) {
      return;
    }

    if (count > 0) {
      startNotificationAlarm("restaurant");
    } else {
      stopNotificationAlarm();
    }
  }, []);

  const fetchNewOrdersCount = useCallback(async () => {
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
        error.message
      );
      return;
    }

    syncAlarm(count ?? 0);
  }, [restaurantId, supabase, syncAlarm]);

  const unlockAudio = useCallback(async () => {
    if (audioUnlockedRef.current) {
      return;
    }

    try {
      await unlockNotificationAudio();

      audioUnlockedRef.current = true;

      window.sessionStorage.setItem(
        "trimos-restaurant-audio-unlocked",
        "true"
      );

      if (newOrdersCountRef.current > 0) {
        startNotificationAlarm("restaurant");
      }
    } catch (error) {
      console.error("Não foi possível desbloquear o áudio:", error);
    }
  }, []);

  useEffect(() => {
    /*
     * O navegador exige uma interação após um carregamento completo.
     * Qualquer clique ou tecla no painel desbloqueia o áudio.
     */
    const handleInteraction = () => {
      void unlockAudio();
    };

    window.addEventListener("pointerdown", handleInteraction, {
      passive: true,
      capture: true,
    });

    window.addEventListener("keydown", handleInteraction, {
      capture: true,
    });

    return () => {
      window.removeEventListener(
        "pointerdown",
        handleInteraction,
        true
      );

      window.removeEventListener(
        "keydown",
        handleInteraction,
        true
      );
    };
  }, [unlockAudio]);

  useEffect(() => {
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
        () => {
          void fetchNewOrdersCount();
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
        () => {
          void fetchNewOrdersCount();
        }
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
        }
      )
      .subscribe();

    return () => {
      stopNotificationAlarm();
      void supabase.removeChannel(channel);
    };
  }, [fetchNewOrdersCount, restaurantId, supabase]);

  return null;
}
