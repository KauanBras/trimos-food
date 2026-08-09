import { ProductsClient } from "@/features/products/components/products-client";
import { getCurrentRestaurant } from "@/lib/restaurants/get-current-restaurant";
import { createClient } from "@/lib/supabase/server";

export default async function ProductsPage() {
  const { restaurantId } = await getCurrentRestaurant();

  const supabase = await createClient();

  const { data: products, error } = await supabase
    .from("products")
    .select(`
      id,
      name,
      description,
      price,
      regular_price,
      promotion_enabled,
      promotion_label,
      image_url,
      is_active,
      is_available,
      category_id,
      categories (
        name,
        sort_order
      )
    `)
    .eq("restaurant_id", restaurantId)
    .is("archived_at", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(
      `Não foi possível carregar os produtos: ${error.message}`
    );
  }

  return (
    <ProductsClient
      restaurantId={restaurantId}
      initialProducts={products ?? []}
    />
  );
}
