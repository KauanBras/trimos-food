import { notFound } from "next/navigation";

import { PublicCheckoutClient } from "@/features/cart/components/public-checkout-client";
import { createClient } from "@/lib/supabase/server";
import { getRestaurantOperatingStatus } from "@/lib/restaurants/operating-status";
import type { Json } from "@/types/database";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ table?: string }>;
};
type Settings = {
  minimumOrderAmount: number;
  defaultDeliveryFee: number;
  deliveryFeePerKm: number;
  deliveryRadiusKm: number;
  deliveryOriginLatitude: number | null;
  deliveryOriginLongitude: number | null;
  freeDeliveryFrom: number | null;
  defaultPreparationMinutes: number;
  acceptsCash: boolean;
  acceptsTerminal: boolean;
  acceptsMbWay: boolean;
};

export default async function PublicCartPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { table } = await searchParams;
  const tableCode = table?.trim().toUpperCase().slice(0, 40) ?? "";
  const supabase = await createClient();
  const { data: restaurant } = await supabase.from("public_restaurants").select("id, name, slug, currency_code, accepts_delivery, accepts_pickup, accepts_dine_in, timezone, is_demo").eq("slug", slug).eq("status", "active").maybeSingle();
  if (!restaurant) notFound();
  const [{ data }, { data: businessHours }, { data: tableData }] = await Promise.all([
    supabase.rpc("get_public_checkout_settings", { requested_restaurant_id: restaurant.id }),
    supabase.from("business_hours").select("day_of_week, opens_at, closes_at, is_closed").eq("restaurant_id", restaurant.id),
    tableCode
      ? supabase.rpc("resolve_public_table", { requested_restaurant_slug: slug, requested_table_code: tableCode })
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (tableCode && !tableData) notFound();
  const tableContext = tableData as { name?: string; code?: string } | null;
  if (!restaurant.accepts_delivery && !restaurant.accepts_pickup && !(restaurant.accepts_dine_in && tableContext)) notFound();
  const settings = (data ?? {}) as Json as Settings;
  const operatingStatus = getRestaurantOperatingStatus(businessHours ?? [], restaurant.timezone);
  return <PublicCheckoutClient restaurant={{ id: restaurant.id, name: restaurant.name, slug: restaurant.slug, currencyCode: restaurant.currency_code, acceptsDelivery: restaurant.accepts_delivery, acceptsPickup: restaurant.accepts_pickup, acceptsDineIn: restaurant.accepts_dine_in, isOpen: restaurant.is_demo || operatingStatus.isOpen, operatingLabel: restaurant.is_demo ? "Aberto para demonstração" : operatingStatus.label, isDemo: restaurant.is_demo }} table={tableContext?.name && tableContext.code ? { name: tableContext.name, code: tableContext.code } : null} settings={{ minimumOrderAmount: Number(settings.minimumOrderAmount ?? 0), defaultDeliveryFee: Number(settings.defaultDeliveryFee ?? 0), deliveryFeePerKm: Number(settings.deliveryFeePerKm ?? 0), deliveryRadiusKm: Number(settings.deliveryRadiusKm ?? 0), deliveryOriginLatitude: settings.deliveryOriginLatitude === null || settings.deliveryOriginLatitude === undefined ? null : Number(settings.deliveryOriginLatitude), deliveryOriginLongitude: settings.deliveryOriginLongitude === null || settings.deliveryOriginLongitude === undefined ? null : Number(settings.deliveryOriginLongitude), freeDeliveryFrom: settings.freeDeliveryFrom === null || settings.freeDeliveryFrom === undefined ? null : Number(settings.freeDeliveryFrom), defaultPreparationMinutes: Number(settings.defaultPreparationMinutes ?? 30), acceptsCash: Boolean(settings.acceptsCash), acceptsTerminal: Boolean(settings.acceptsTerminal), acceptsMbWay: restaurant.is_demo ? false : Boolean(settings.acceptsMbWay) }} />;
}
