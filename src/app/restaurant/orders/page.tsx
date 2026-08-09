import { OrdersClient } from "@/features/orders/components/orders-client";
import { getCurrentRestaurant } from "@/lib/restaurants/get-current-restaurant";
import { createClient } from "@/lib/supabase/server";

export default async function OrdersPage() {
  const { restaurantId, restaurant } = await getCurrentRestaurant();
  const supabase = await createClient();

  const [ordersResult, printerSettingsResult] = await Promise.all([
    supabase
      .from("orders")
      .select(`
        id,
        customer_name,
        customer_phone,
        table_label,
        type,
        status,
        subtotal,
        delivery_fee,
        total,
        payment_method,
        payment_status,
        cash_tendered_amount,
        delivery_address,
        delivery_distance_km,
        notes,
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
      .order("created_at", { ascending: false }),
    supabase
      .from("restaurant_settings")
      .select("receipt_printer_enabled, receipt_paper_width, receipt_print_copies, auto_print_orders")
      .eq("restaurant_id", restaurantId)
      .single(),
  ]);

  if (ordersResult.error) {
    throw new Error(`Não foi possível carregar os pedidos: ${ordersResult.error.message}`);
  }
  if (printerSettingsResult.error || !printerSettingsResult.data) {
    throw new Error(printerSettingsResult.error?.message ?? "Não foi possível carregar a impressão.");
  }

  return (
    <OrdersClient
      restaurantId={restaurantId}
      initialOrders={ordersResult.data ?? []}
      currencyCode={restaurant.currency_code}
      receiptRestaurant={{
        name: restaurant.name,
        addressLine: restaurant.address_line,
        city: restaurant.city,
        postalCode: restaurant.postal_code,
        phone: restaurant.phone,
      }}
      printerSettings={{
        enabled: printerSettingsResult.data.receipt_printer_enabled,
        paperWidth: printerSettingsResult.data.receipt_paper_width === 58 ? 58 : 80,
        copies: printerSettingsResult.data.receipt_print_copies,
        autoPrint: printerSettingsResult.data.auto_print_orders,
      }}
    />
  );
}
