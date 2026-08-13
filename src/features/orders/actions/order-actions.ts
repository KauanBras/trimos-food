"use server";

import { revalidatePath } from "next/cache";

import { getWritableCurrentRestaurant } from "@/lib/restaurants/get-current-restaurant";
import { getStripe } from "@/lib/stripe/server";
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

    let paymentStatus = order.payment_status;
    let refundedAt: string | null | undefined;

    if (status === "cancelled" && order.payment_method === "mb_way" && order.payment_status === "paid") {
      if (!order.provider_payment_id) throw new Error("A referência do pagamento não foi encontrada.");
      const { data: settings } = await supabase.from("restaurant_settings")
        .select("stripe_account_id").eq("restaurant_id", restaurantId).single();
      if (!settings?.stripe_account_id) throw new Error("A conta Stripe do restaurante não foi encontrada.");
      await getStripe().refunds.create(
        { payment_intent: order.provider_payment_id, reason: "requested_by_customer" },
        { stripeAccount: settings.stripe_account_id, idempotencyKey: `refund-order-${order.id}` },
      );
      paymentStatus = "refunded";
      refundedAt = new Date().toISOString();
    }

    if (status === "completed" && order.payment_status === "awaiting_collection") {
      paymentStatus = "paid";
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabase.from("orders").update({
      status,
      payment_status: paymentStatus,
      accepted_at: status === "confirmed" || status === "preparing" ? now : undefined,
      ready_at: status === "ready" ? now : undefined,
      completed_at: status === "completed" ? now : undefined,
      cancelled_at: status === "cancelled" ? now : undefined,
      paid_at: paymentStatus === "paid" ? now : undefined,
      refunded_at: refundedAt,
    }).eq("id", orderId).eq("restaurant_id", restaurantId);
    if (updateError) throw new Error(updateError.message);

    revalidatePath("/restaurant/orders");
    revalidatePath("/restaurant/dashboard");
    return { ok: true, message: "Pedido atualizado.", paymentStatus };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Não foi possível atualizar o pedido." };
  }
}
