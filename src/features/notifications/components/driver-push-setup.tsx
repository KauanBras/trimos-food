"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { urlBase64ToUint8Array } from "@/features/notifications/push/utils";
import { createClient } from "@/lib/supabase/client";

type DriverPushSetupProps = {
  driverId: string;
  restaurantId: string;
  userId: string;
};

export function DriverPushSetup({
  driverId,
  restaurantId,
  userId,
}: DriverPushSetupProps) {
  const [supported, setSupported] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  const saveSubscription = useCallback(
    async (subscription: PushSubscription) => {
      const subscriptionJson = subscription.toJSON();
      const supabase = createClient();

      const { error } = await supabase
        .from("push_subscriptions")
        .upsert(
          {
            user_id: userId,
            restaurant_id: restaurantId,
            driver_id: driverId,
            endpoint: subscription.endpoint,
            p256dh: subscriptionJson.keys?.p256dh ?? "",
            auth_key: subscriptionJson.keys?.auth ?? "",
            user_agent: navigator.userAgent,
            device_name: navigator.platform,
            is_active: true,
            last_used_at: new Date().toISOString(),
          },
          {
            onConflict: "endpoint",
          }
        );

      if (error) {
        throw error;
      }
    },
    [driverId, restaurantId, userId]
  );

  useEffect(() => {
    let cancelled = false;

    async function initialisePush() {
      const isSupported =
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;

      if (!isSupported) {
        if (!cancelled) {
          setSupported(false);
          setLoading(false);
        }

        return;
      }

      try {
        const registration =
          await navigator.serviceWorker.register("/sw.js");

        const subscription =
          await registration.pushManager.getSubscription();

        if (!subscription) {
          if (!cancelled) {
            setEnabled(false);
          }

          return;
        }

        /*
         * Uma subscrição pode continuar guardada localmente mesmo
         * depois de outro utilizador iniciar sessão neste dispositivo.
         * Sincronizamos sempre o endpoint com a conta atual.
         */
        await saveSubscription(subscription);

        if (!cancelled) {
          setEnabled(true);
        }
      } catch (error) {
        console.error(
          "Não foi possível sincronizar a subscrição Push:",
          error
        );

        /*
         * Caso o endpoint esteja associado a outra conta e a RLS
         * impeça a atualização, removemos a subscrição local antiga.
         * O botão Ativar será exibido para criar uma nova.
         */
        try {
          const registration =
            await navigator.serviceWorker.ready;

          const oldSubscription =
            await registration.pushManager.getSubscription();

          if (oldSubscription) {
            await oldSubscription.unsubscribe();
          }
        } catch (unsubscribeError) {
          console.error(
            "Não foi possível remover a subscrição antiga:",
            unsubscribeError
          );
        }

        if (!cancelled) {
          setEnabled(false);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void initialisePush();

    return () => {
      cancelled = true;
    };
  }, [saveSubscription]);

  async function enablePush() {
    setLoading(true);

    try {
      const permission =
        await Notification.requestPermission();

      if (permission !== "granted") {
        toast.error("Permissão de notificações recusada.");
        return;
      }

      const publicKey =
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!publicKey) {
        throw new Error(
          "Chave VAPID pública não configurada."
        );
      }

      const registration =
        await navigator.serviceWorker.ready;

      let subscription =
        await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription =
          await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey:
              urlBase64ToUint8Array(publicKey),
          });
      }

      await saveSubscription(subscription);

      setEnabled(true);

      await registration.showNotification(
        "Notificações ativadas",
        {
          body: "Receberá as novas entregas neste dispositivo.",
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          tag: "trimos-push-enabled",
        }
      );

      toast.success("Notificações push ativadas.");
    } catch (error) {
      setEnabled(false);

      console.error("PUSH ERROR:", error);

      const details =
        error instanceof Error
          ? error.message
          : typeof error === "object" && error !== null
            ? JSON.stringify(error, Object.getOwnPropertyNames(error))
            : String(error);

      toast.error(
        "Não foi possível ativar as notificações",
        {
          description: details || "Erro sem detalhes.",
        }
      );
    } finally {
      setLoading(false);
    }
  }

  if (!supported) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold">
            Notificações de entregas
          </p>

          <p className="mt-1 text-sm text-zinc-500">
            {enabled
              ? "Este dispositivo está pronto para receber entregas."
              : "Ative para receber chamadas mesmo em segundo plano."}
          </p>
        </div>

        <Button
          type="button"
          variant={enabled ? "outline" : "default"}
          disabled={loading || enabled}
          onClick={() => void enablePush()}
          className="shrink-0"
        >
          {loading ? (
            <LoaderCircle className="mr-2 size-4 animate-spin" />
          ) : enabled ? (
            <Bell className="mr-2 size-4" />
          ) : (
            <BellOff className="mr-2 size-4" />
          )}

          {loading
            ? "A verificar"
            : enabled
              ? "Ativadas"
              : "Ativar"}
        </Button>
      </div>
    </div>
  );
}
