import { notFound } from "next/navigation";

import { ProductEditForm } from "@/features/products/components/product-edit-form";
import { getCurrentRestaurant } from "@/lib/restaurants/get-current-restaurant";
import { createClient } from "@/lib/supabase/server";

export default async function EditProductPage({ params }: PageProps<"/restaurant/products/[productId]/edit">) {
  const { productId } = await params;
  const { restaurantId } = await getCurrentRestaurant();
  const supabase = await createClient();

  const [{ data: product }, { data: categories }, { data: modifierGroups, error: modifiersError }, { data: links }, { data: variants, error: variantsError }] = await Promise.all([
    supabase.from("products").select("id, name, description, price, regular_price, promotion_enabled, promotion_label, category_id, image_url, is_active, is_available").eq("id", productId).eq("restaurant_id", restaurantId).maybeSingle(),
    supabase.from("categories").select("id, name").eq("restaurant_id", restaurantId).eq("is_active", true).order("sort_order"),
    supabase.from("modifier_groups").select("id, name, min_selections, max_selections, is_active, modifier_options (name, price_delta, max_quantity, sort_order)").eq("restaurant_id", restaurantId).order("sort_order"),
    supabase.from("product_modifier_groups").select("modifier_group_id, sort_order").eq("product_id", productId).order("sort_order"),
    supabase.from("product_variants").select("name, price, is_active, is_available").eq("product_id", productId).order("sort_order"),
  ]);

  if (!product) notFound();
  if (modifiersError) throw new Error(`Não foi possível carregar os complementos: ${modifiersError.message}`);
  if (variantsError) throw new Error(`Não foi possível carregar as variações: ${variantsError.message}`);

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-3xl font-semibold">Editar produto</h1>
        <p className="mt-1 text-sm text-zinc-500">Atualize a categoria, os dados e os complementos deste produto.</p>
      </div>
      <ProductEditForm
        product={product}
        categories={categories ?? []}
        initialModifierGroups={(links ?? []).flatMap((link) => {
          const group = (modifierGroups ?? []).find((candidate) => candidate.id === link.modifier_group_id);
          return group ? [{
          id: group.id,
          name: group.name,
          minSelections: group.min_selections,
          maxSelections: group.max_selections,
          options: [...group.modifier_options]
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((option) => ({ name: option.name, priceDelta: option.price_delta, maxQuantity: option.max_quantity })),
        }] : []})}
        availableModifierGroups={(modifierGroups ?? []).filter((group) => group.is_active).map((group) => ({
          id: group.id, name: group.name, minSelections: group.min_selections, maxSelections: group.max_selections,
          options: [...group.modifier_options].sort((a, b) => a.sort_order - b.sort_order).map((option) => ({ name: option.name, priceDelta: option.price_delta, maxQuantity: option.max_quantity })),
        }))}
        initialVariants={(variants ?? []).map((variant) => ({ name: variant.name, price: variant.price, isActive: variant.is_active, isAvailable: variant.is_available }))}
      />
    </div>
  );
}
