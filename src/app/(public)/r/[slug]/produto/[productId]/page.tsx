import { notFound } from "next/navigation";

import { PublicProductConfigurator } from "@/features/products/components/public-product-configurator";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ slug: string; productId: string }> };

export default async function PublicProductPage({ params }: Props) {
  const { slug, productId } = await params;
  const supabase = await createClient();
  const { data: restaurant } = await supabase.from("restaurants").select("id, slug, currency_code").eq("slug", slug).eq("status", "active").maybeSingle();
  if (!restaurant) notFound();
  const [{ data: product }, { data: variants }, { data: links }] = await Promise.all([
    supabase.from("products").select("id, name, description, image_url, price, categories(is_active)").eq("id", productId).eq("restaurant_id", restaurant.id).eq("is_active", true).eq("is_available", true).maybeSingle(),
    supabase.from("product_variants").select("id, name, price, sort_order").eq("product_id", productId).eq("is_active", true).eq("is_available", true).order("sort_order"),
    supabase.from("product_modifier_groups").select("modifier_group_id, sort_order").eq("product_id", productId).order("sort_order"),
  ]);
  if (!product || product.categories?.is_active === false) notFound();
  const groupIds = (links ?? []).map((link) => link.modifier_group_id);
  const { data: groups } = groupIds.length ? await supabase.from("modifier_groups").select("id, name, min_selections, max_selections, modifier_options (id, name, price_delta, max_quantity, is_active, sort_order)").in("id", groupIds).eq("is_active", true) : { data: [] };
  const orderedGroups = (links ?? []).flatMap((link) => { const group = (groups ?? []).find((candidate) => candidate.id === link.modifier_group_id); return group ? [{ id: group.id, name: group.name, minSelections: group.min_selections, maxSelections: group.max_selections, options: [...group.modifier_options].filter((option) => option.is_active).sort((a, b) => a.sort_order - b.sort_order).map((option) => ({ id: option.id, name: option.name, priceDelta: option.price_delta, maxQuantity: option.max_quantity })) }] : []; }).filter((group) => group.options.length > 0);
  return <PublicProductConfigurator restaurant={{ id: restaurant.id, slug: restaurant.slug, currencyCode: restaurant.currency_code }} product={{ id: product.id, name: product.name, description: product.description, imageUrl: product.image_url, price: product.price }} variants={(variants ?? []).map((variant) => ({ id: variant.id, name: variant.name, price: variant.price }))} groups={orderedGroups} />;
}
