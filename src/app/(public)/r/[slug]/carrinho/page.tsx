import { notFound } from "next/navigation";

import { PublicCheckoutClient } from "@/features/cart/components/public-checkout-client";
import { createClient } from "@/lib/supabase/server";
import { getRestaurantOperatingStatus } from "@/lib/restaurants/operating-status";
import type { Json } from "@/types/database";

type Props = { params: Promise<{ slug: string }> };
type Settings = { minimumOrderAmount: number; defaultDeliveryFee: number; freeDeliveryFrom: number | null; defaultPreparationMinutes: number };

export default async function PublicCartPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: restaurant } = await supabase.from("restaurants").select("id, name, slug, currency_code, accepts_delivery, accepts_pickup, timezone").eq("slug", slug).eq("status", "active").maybeSingle();
  if (!restaurant || (!restaurant.accepts_delivery && !restaurant.accepts_pickup)) notFound();
  const [{ data }, { data: businessHours }] = await Promise.all([
    supabase.rpc("get_public_checkout_settings", { requested_restaurant_id: restaurant.id }),
    supabase.from("business_hours").select("day_of_week, opens_at, closes_at, is_closed").eq("restaurant_id", restaurant.id),
  ]);
  const settings = (data ?? {}) as Json as Settings;
  const operatingStatus = getRestaurantOperatingStatus(businessHours ?? [], restaurant.timezone);
  return <PublicCheckoutClient restaurant={{ id: restaurant.id, name: restaurant.name, slug: restaurant.slug, currencyCode: restaurant.currency_code, acceptsDelivery: restaurant.accepts_delivery, acceptsPickup: restaurant.accepts_pickup, isOpen: operatingStatus.isOpen, operatingLabel: operatingStatus.label }} settings={{ minimumOrderAmount: Number(settings.minimumOrderAmount ?? 0), defaultDeliveryFee: Number(settings.defaultDeliveryFee ?? 0), freeDeliveryFrom: settings.freeDeliveryFrom === null ? null : Number(settings.freeDeliveryFrom), defaultPreparationMinutes: Number(settings.defaultPreparationMinutes ?? 30) }} />;
}
