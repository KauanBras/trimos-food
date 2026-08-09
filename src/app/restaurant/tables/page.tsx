import { headers } from "next/headers";
import QRCode from "qrcode";

import { TableQrManager } from "@/features/tables/components/table-qr-manager";
import { getCurrentRestaurant } from "@/lib/restaurants/get-current-restaurant";
import { createClient } from "@/lib/supabase/server";

export default async function RestaurantTablesPage() {
  const { restaurantId, restaurant } = await getCurrentRestaurant();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("restaurant_tables")
    .select("id, name, code, seats, sort_order, is_active")
    .eq("restaurant_id", restaurantId)
    .order("sort_order")
    .order("name");
  if (error) throw new Error(`Não foi possível carregar as mesas: ${error.message}`);
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");
  const origin = host ? `${protocol}://${host}` : process.env.NEXT_PUBLIC_SITE_URL ?? "https://trimos-food.vercel.app";
  const tables = await Promise.all((data ?? []).map(async (table) => {
    const menuUrl = `${origin}/r/${restaurant.slug}?table=${encodeURIComponent(table.code)}`;
    const qrDataUrl = await QRCode.toDataURL(menuUrl, {
      errorCorrectionLevel: "H",
      margin: 2,
      width: 720,
      color: { dark: "#18181b", light: "#ffffff" },
    });
    return { ...table, menuUrl, qrDataUrl };
  }));
  return <TableQrManager restaurantName={restaurant.name} tables={tables} />;
}
