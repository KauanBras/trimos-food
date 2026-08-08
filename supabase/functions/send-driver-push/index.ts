import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT")!,
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

serve(async (request) => {
  if (request.method !== "POST") {
    return json({ success: false }, 405);
  }

  try {
    const payload = (await request.json().catch(() => null)) as {
      delivery_id?: string;
    } | null;
    const deliveryId = payload?.delivery_id;

    if (!deliveryId || !uuidPattern.test(deliveryId)) {
      return json({ success: false }, 400);
    }

    const { data: delivery, error: claimError } = await supabase
      .from("deliveries")
      .update({ push_notified_at: new Date().toISOString() })
      .eq("id", deliveryId)
      .eq("status", "offered")
      .is("push_notified_at", null)
      .select("id, order_id, offered_driver_id")
      .maybeSingle();

    if (claimError) throw claimError;

    if (!delivery?.offered_driver_id) {
      return json({ success: true, ignored: true });
    }

    const [
      { data: order, error: orderError },
      { data: subscriptions, error: subscriptionError },
    ] = await Promise.all([
      supabase
        .from("orders")
        .select("total, customer_name, restaurant_id")
        .eq("id", delivery.order_id)
        .single(),
      supabase
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth_key")
        .eq("driver_id", delivery.offered_driver_id)
        .eq("is_active", true),
    ]);

    if (orderError || !order)
      throw orderError ?? new Error("Order unavailable");
    if (subscriptionError) throw subscriptionError;

    const { data: restaurant, error: restaurantError } = await supabase
      .from("restaurants")
      .select("name, currency_code")
      .eq("id", order.restaurant_id)
      .single();

    if (restaurantError || !restaurant) {
      throw restaurantError ?? new Error("Restaurant unavailable");
    }

    const amount = new Intl.NumberFormat("pt-PT", {
      style: "currency",
      currency: restaurant.currency_code ?? "EUR",
    }).format(Number(order.total));
    const notification = JSON.stringify({
      title: `Nova entrega · ${restaurant.name}`,
      body: `${order.customer_name} · ${amount}`,
      url: "/driver/dashboard",
      tag: `delivery-${delivery.id}`,
    });

    let delivered = 0;

    for (const subscription of subscriptions ?? []) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth_key,
            },
          },
          notification,
        );
        delivered += 1;
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabase
            .from("push_subscriptions")
            .update({ is_active: false })
            .eq("id", subscription.id);
        }
        console.error("Push delivery failed", error);
      }
    }

    return json({ success: true, delivered });
  } catch (error) {
    console.error("Driver push failed", error);
    return json({ success: false }, 500);
  }
});
