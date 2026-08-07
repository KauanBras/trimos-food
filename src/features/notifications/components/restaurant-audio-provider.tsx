"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BellRing } from "lucide-react";

import { Button } from "@/components/ui/button";
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
  const [audioEnabled, setAudioEnabled] = useState(false);

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
    try {
      await unlockNotificationAudio();

      audioUnlockedRef.current = true;
      setAudioEnabled(true);

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
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void fetchNewOrdersCount();
      }
    };

    window.addEventListener("focus", fetchNewOrdersCount);
    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      window.removeEventListener("focus", fetchNewOrdersCount);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, [fetchNewOrdersCount]);

  useEffect(() => {
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
  }, [fetchNewOrdersCount, restaurantId, supabase]);

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
            Ativar som dos pedidos
          </p>
          <p className="text-sm text-amber-800">
            Necessário para o alarme tocar até o pedido ser aceite.
          </p>
        </div>

        <Button
          type="button"
          className="shrink-0 bg-amber-500 text-zinc-950 hover:bg-amber-400"
          onClick={() => void unlockAudio()}
        >
          Ativar som
        </Button>
      </div>
    </div>
  );
}
