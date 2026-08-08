import { ProductForm } from "@/features/products/components/product-form";
import { getCurrentRestaurant } from "@/lib/restaurants/get-current-restaurant";
import { createClient } from "@/lib/supabase/server";

export default async function NewProductPage() {
  const { restaurantId } = await getCurrentRestaurant();

  const supabase = await createClient();

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name")
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true)
    .order("sort_order");

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-3xl font-semibold">
          Novo produto
        </h1>

        <p className="mt-1 text-sm text-zinc-500">
          Adicione um novo item ao menu.
        </p>
      </div>

      <ProductForm
        categories={categories ?? []}
      />
    </div>
  );
}
