import { ModifierGroupsManager } from "@/features/products/components/modifier-groups-manager";
import { getCurrentRestaurant } from "@/lib/restaurants/get-current-restaurant";
import { createClient } from "@/lib/supabase/server";

export default async function ModifierGroupsPage() {
  const { restaurantId } = await getCurrentRestaurant();
  const supabase = await createClient();
  const { data: groups, error } = await supabase.from("modifier_groups").select("id, name, min_selections, max_selections, is_active, modifier_options (id, name, price_delta, max_quantity, is_active, sort_order)").eq("restaurant_id", restaurantId).order("sort_order");
  if (error) throw new Error(`Não foi possível carregar os complementos: ${error.message}`);
  return <div className="space-y-6 p-4 sm:p-6 lg:p-8"><div><h1 className="text-3xl font-semibold">Grupos de complementos</h1><p className="mt-1 text-sm text-zinc-500">Altere uma vez e todos os produtos associados recebem a atualização.</p></div><ModifierGroupsManager initialGroups={(groups ?? []).map((group) => ({ id: group.id, name: group.name, minSelections: group.min_selections, maxSelections: group.max_selections, isActive: group.is_active, options: [...group.modifier_options].sort((a, b) => a.sort_order - b.sort_order).map((option) => ({ id: option.id, name: option.name, priceDelta: option.price_delta, maxQuantity: option.max_quantity, isActive: option.is_active })) }))} /></div>;
}
