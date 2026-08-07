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
      image_url,
      is_active,
      is_available,
      category_id,
      categories (
        name
      )
    `)
    .eq("restaurant_id", restaurantId)
    .order("created_at", {
      ascending: false,
    });

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
