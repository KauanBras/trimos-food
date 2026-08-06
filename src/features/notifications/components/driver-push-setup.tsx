"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { urlBase64ToUint8Array } from "@/features/notifications/push/utils";

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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const isSupported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    if (!isSupported) {
      queueMicrotask(() => setSupported(false));
      return;
    }

    void navigator.serviceWorker
      .register("/sw.js")
      .then(async (registration) => {
        const subscription =
          await registration.pushManager.getSubscription();

        setEnabled(Boolean(subscription));
      })
      .catch((error) => {
        console.error("Erro ao registar Service Worker:", error);
      });
  }, []);

  async function enablePush() {
    setLoading(true);

    try {
      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        toast.error("Permissão de notificações recusada.");
        return;
      }

      const publicKey =
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!publicKey) {
        throw new Error("Chave VAPID pública não configurada.");
      }

      const registration =
        await navigator.serviceWorker.ready;

      let subscription =
        await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey:
            urlBase64ToUint8Array(publicKey),
        });
      }

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
      toast.error("Não foi possível ativar as notificações", {
        description:
          error instanceof Error
            ? error.message
            : "Erro desconhecido.",
      });
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

          {enabled ? "Ativadas" : "Ativar"}
        </Button>
      </div>
    </div>
  );
}
