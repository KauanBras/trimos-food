import KitchenClient from "./kitchen-client";
import { getCurrentRestaurant } from "@/lib/restaurants/get-current-restaurant";
import { createClient } from "@/lib/supabase/server";

export default async function KitchenServerPage() {
  const { restaurantId } = await getCurrentRestaurant();
  const supabase = await createClient();

  const { data: orders, error } = await supabase
    .from("orders")
    .select(`
      id,
      customer_name,
      status,
      estimated_minutes,
      accepted_at,
      ready_at,
      created_at,
      order_items (
        id,
        product_name,
        quantity,
        notes,
        variant_name,
        selected_modifiers
      )
    `)
    .eq("restaurant_id", restaurantId)
    .in("status", ["preparing", "ready"])
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Não foi possível carregar a cozinha: ${error.message}`);
  }

  return (
    <KitchenClient
      restaurantId={restaurantId}
      initialOrders={orders ?? []}
    />
  );
}
