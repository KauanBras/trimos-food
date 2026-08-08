import { OrdersClient } from "@/features/orders/components/orders-client";
import { getCurrentRestaurant } from "@/lib/restaurants/get-current-restaurant";
import { createClient } from "@/lib/supabase/server";

export default async function OrdersPage() {
  const { restaurantId, restaurant } = await getCurrentRestaurant();
  const supabase = await createClient();

  const { data: orders, error } = await supabase
    .from("orders")
    .select(`
      id,
      customer_name,
      customer_phone,
      type,
      status,
      subtotal,
      delivery_fee,
      total,
      payment_method,
      payment_status,
      cash_tendered_amount,
      estimated_minutes,
      created_at,
      order_items (
        id,
        product_name,
        quantity,
        unit_price,
        notes,
        variant_name,
        selected_modifiers
      )
    `)
    .eq("restaurant_id", restaurantId)
    .neq("status", "pending_payment")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Não foi possível carregar os pedidos: ${error.message}`);
  }

  return (
    <OrdersClient
      restaurantId={restaurantId}
      initialOrders={orders ?? []}
      currencyCode={restaurant.currency_code}
    />
  );
}
