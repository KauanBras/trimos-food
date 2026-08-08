import { CategoriesManager } from "@/features/products/components/categories-manager";
import { getCurrentRestaurant } from "@/lib/restaurants/get-current-restaurant";
import { createClient } from "@/lib/supabase/server";

export default async function ProductCategoriesPage() {
  const { restaurantId } = await getCurrentRestaurant();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, description, is_active")
    .eq("restaurant_id", restaurantId)
    .order("sort_order");

  if (error) {
    throw new Error(`Não foi possível carregar as categorias: ${error.message}`);
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <p className="text-sm font-medium text-amber-600">Estrutura do menu</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Categorias</h1>
        <p className="mt-2 text-sm text-zinc-500">Crie, edite, ative e ordene as secções apresentadas no menu público.</p>
      </div>
      <CategoriesManager initialCategories={(data ?? []).map((category) => ({ id: category.id, name: category.name, description: category.description ?? "", isActive: category.is_active }))} />
    </div>
  );
}
