"use server";

import { revalidatePath } from "next/cache";

import { getWritableCurrentRestaurant } from "@/lib/restaurants/get-current-restaurant";
import { getStripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type OrderStatus = Database["public"]["Enums"]["order_status"];

export type OrderActionResult = {
  ok: boolean;
  message: string;
  paymentStatus?: Database["public"]["Enums"]["payment_status"];
};

const allowedTransitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
  new: ["preparing", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["completed", "cancelled"],
};

export async function updateRestaurantOrderStatusAction(
  orderId: string,
  status: OrderStatus,
): Promise<OrderActionResult> {
  try {
    const { restaurantId, role } = await getWritableCurrentRestaurant();
    if (!["owner", "admin", "manager", "staff", "kitchen"].includes(role)) {
      return { ok: false, message: "Não tem permissão para atualizar pedidos." };
    }

    const supabase = await createClient();
    const { data: order, error } = await supabase.from("orders")
      .select("id, type, status, payment_method, payment_status, provider_payment_id")
      .eq("id", orderId).eq("restaurant_id", restaurantId).single();
    if (error || !order) throw new Error(error?.message ?? "Pedido não encontrado.");
    if (order.status === "pending_payment") return { ok: false, message: "Aguarde a confirmação do pagamento." };
    if (!(allowedTransitions[order.status] ?? []).includes(status)) {
      return { ok: false, message: "Esta mudança de estado não é permitida." };
    }
    if (order.type === "delivery" && order.status === "ready" && status === "completed") {
      return { ok: false, message: "A entrega deve ser concluída pelo estafeta." };
    }

    if (status === "cancelled" && order.payment_method === "mb_way" && order.payment_status === "paid") {
      if (!order.provider_payment_id) throw new Error("A referência do pagamento não foi encontrada.");
      const { data: settings } = await supabase.from("restaurant_settings")
        .select("stripe_account_id").eq("restaurant_id", restaurantId).single();
      if (!settings?.stripe_account_id) throw new Error("A conta Stripe do restaurante não foi encontrada.");
      await getStripe().refunds.create(
        { payment_intent: order.provider_payment_id, reason: "requested_by_customer" },
        { stripeAccount: settings.stripe_account_id, idempotencyKey: `refund-order-${order.id}` },
      );
      const now = new Date().toISOString();
      const { error: updateError } = await createAdminClient()
        .from("orders")
        .update({
          status: "cancelled",
          payment_status: "refunded",
          cancelled_at: now,
          refunded_at: now,
        })
        .eq("id", orderId)
        .eq("restaurant_id", restaurantId);
      if (updateError) throw new Error(updateError.message);
    } else {
      const { data: transition, error: transitionError } = await supabase.rpc(
        "transition_restaurant_order_status",
        { requested_order_id: orderId, requested_status: status },
      );
      if (transitionError) throw new Error(transitionError.message);
      const result = transition as { paymentStatus?: Database["public"]["Enums"]["payment_status"] } | null;
      order.payment_status = result?.paymentStatus ?? order.payment_status;
    }

    revalidatePath("/restaurant/orders");
    revalidatePath("/restaurant/dashboard");
    return {
      ok: true,
      message: "Pedido atualizado.",
      paymentStatus:
        status === "cancelled" && order.payment_method === "mb_way"
          ? "refunded"
          : order.payment_status,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Não foi possível atualizar o pedido." };
  }
}
